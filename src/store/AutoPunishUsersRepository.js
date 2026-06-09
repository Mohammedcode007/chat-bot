const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const autoPunishUsersStore = new JsonStore(
  path.join(__dirname, "../data/autoPunishUsers.json"),
  {}
);

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function roomKey(roomName) {
  return String(roomName || "").trim();
}

function uniqueByUsername(list) {
  const seen = new Set();
  const result = [];

  (Array.isArray(list) ? list : []).forEach((item) => {
    const username = String(item.username || item || "").trim();
    const key = normalizeForCheck(username);

    if (!username || !key || seen.has(key)) return;

    seen.add(key);

    if (typeof item === "string") {
      result.push({
        username,
        addedBy: "unknown",
        addedAt: new Date().toISOString(),
      });
      return;
    }

    result.push({
      username,
      addedBy: item.addedBy || "unknown",
      addedAt: item.addedAt || new Date().toISOString(),
    });
  });

  return result;
}

class AutoPunishUsersRepository {
  getAll() {
    const data = autoPunishUsersStore.read();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data;
  }

  saveAll(data) {
    return autoPunishUsersStore.write(data || {});
  }

  getRoomData(roomName) {
    const data = this.getAll();
    const key = roomKey(roomName);

    const room = data[key] || {};

    return {
      autoBan: uniqueByUsername(room.autoBan || []),
      autoKick: uniqueByUsername(room.autoKick || []),
    };
  }

  saveRoomData(roomName, roomData) {
    const data = this.getAll();
    const key = roomKey(roomName);

    data[key] = {
      autoBan: uniqueByUsername(roomData.autoBan || []),
      autoKick: uniqueByUsername(roomData.autoKick || []),
    };

    this.saveAll(data);

    return data[key];
  }

  addAutoBan(roomName, username, addedBy) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    const exists = room.autoBan.some((item) => {
      return normalizeForCheck(item.username) === target;
    });

    if (exists) {
      return {
        updated: false,
        alreadyExists: true,
      };
    }

    /*
      لو موجود في autoKick نحذفه منها حتى لا يحدث تضارب.
    */
    room.autoKick = room.autoKick.filter((item) => {
      return normalizeForCheck(item.username) !== target;
    });

    room.autoBan.push({
      username,
      addedBy,
      addedAt: new Date().toISOString(),
    });

    this.saveRoomData(roomName, room);

    return {
      updated: true,
      alreadyExists: false,
    };
  }

  removeAutoBan(roomName, username) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    const before = room.autoBan.length;

    room.autoBan = room.autoBan.filter((item) => {
      return normalizeForCheck(item.username) !== target;
    });

    this.saveRoomData(roomName, room);

    return before !== room.autoBan.length;
  }

  addAutoKick(roomName, username, addedBy) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    const exists = room.autoKick.some((item) => {
      return normalizeForCheck(item.username) === target;
    });

    if (exists) {
      return {
        updated: false,
        alreadyExists: true,
      };
    }

    /*
      لو موجود في autoBan نحذفه منها حتى لا يحدث تضارب.
    */
    room.autoBan = room.autoBan.filter((item) => {
      return normalizeForCheck(item.username) !== target;
    });

    room.autoKick.push({
      username,
      addedBy,
      addedAt: new Date().toISOString(),
    });

    this.saveRoomData(roomName, room);

    return {
      updated: true,
      alreadyExists: false,
    };
  }

  removeAutoKick(roomName, username) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    const before = room.autoKick.length;

    room.autoKick = room.autoKick.filter((item) => {
      return normalizeForCheck(item.username) !== target;
    });

    this.saveRoomData(roomName, room);

    return before !== room.autoKick.length;
  }

  isAutoBan(roomName, username) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    return room.autoBan.some((item) => {
      return normalizeForCheck(item.username) === target;
    });
  }

  isAutoKick(roomName, username) {
    const room = this.getRoomData(roomName);
    const target = normalizeForCheck(username);

    return room.autoKick.some((item) => {
      return normalizeForCheck(item.username) === target;
    });
  }

  listAutoBan(roomName) {
    return this.getRoomData(roomName).autoBan;
  }

  listAutoKick(roomName) {
    return this.getRoomData(roomName).autoKick;
  }
}

module.exports = {
  AutoPunishUsersRepository,
};
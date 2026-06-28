const fs = require("fs");
const path = require("path");
const { normalizeUsername } = require("../utils/text");

const ROOM_USERS_FILE = path.join(__dirname, "../data/roomUsers.json");

function ensureDir() {
  const dir = path.dirname(ROOM_USERS_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function safeReadJson() {
  ensureDir();

  if (!fs.existsSync(ROOM_USERS_FILE)) {
    fs.writeFileSync(ROOM_USERS_FILE, JSON.stringify({}, null, 2), "utf8");
    return {};
  }

  try {
    const raw = fs.readFileSync(ROOM_USERS_FILE, "utf8");
    const data = JSON.parse(raw || "{}");

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data;
  } catch (err) {
    console.log("❌ [ROOM_USERS_READ_FILE_ERROR]", {
      file: ROOM_USERS_FILE,
      message: err.message,
    });

    return {};
  }
}

function safeWriteJson(data) {
  ensureDir();

  try {
    fs.writeFileSync(
      ROOM_USERS_FILE,
      JSON.stringify(data || {}, null, 2),
      "utf8"
    );

    console.log("✅ [ROOM_USERS_FILE_WRITTEN]", {
      file: ROOM_USERS_FILE,
      roomsCount: Object.keys(data || {}).length,
    });

    return true;
  } catch (err) {
    console.log("❌ [ROOM_USERS_WRITE_FILE_ERROR]", {
      file: ROOM_USERS_FILE,
      message: err.message,
      stack: err.stack,
    });

    return false;
  }
}

class RoomUsersRepository {
  getAll() {
    const data = safeReadJson();

    console.log("📖 [ROOM_USERS_GET_ALL]", {
      file: ROOM_USERS_FILE,
      rooms: Object.keys(data || {}),
    });

    return data;
  }

  saveAll(data) {
    console.log("💾 [ROOM_USERS_SAVE_ALL_START]", {
      file: ROOM_USERS_FILE,
      rooms: Object.keys(data || {}),
    });

    const ok = safeWriteJson(data || {});

    const after = safeReadJson();

    console.log("💾 [ROOM_USERS_SAVE_ALL_AFTER]", {
      ok,
      rooms: Object.keys(after || {}),
      data: after,
    });

    return ok;
  }

  ensureRoom(data, roomName) {
    const key = String(roomName || "").trim();

    if (!key) {
      console.log("❌ [ROOM_USERS_EMPTY_ROOM_NAME]");
    }

    if (!data[key]) {
      data[key] = {
        current: [],
        recent: [],
      };
    }

    if (Array.isArray(data[key])) {
      data[key] = {
        current: data[key],
        recent: [],
      };
    }

    if (!Array.isArray(data[key].current)) {
      data[key].current = [];
    }

    if (!Array.isArray(data[key].recent)) {
      data[key].recent = [];
    }

    return data[key];
  }

  getRoomUsers(roomName) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    console.log("📦 [ROOM_USERS_GET_ROOM_USERS]", {
      roomName,
      count: room.current.length,
      users: room.current,
    });

    return room.current;
  }

  getRecentUsers(roomName) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    console.log("📦 [ROOM_USERS_GET_RECENT_USERS]", {
      roomName,
      count: room.recent.length,
    });

    return room.recent.slice(0, 100);
  }

  setRoomUsers(roomName, users) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    const safeUsers = Array.isArray(users) ? users : [];

    console.log("📝 [ROOM_USERS_SET_ROOM_USERS_START]", {
      roomName,
      beforeCount: room.current.length,
      nextCount: safeUsers.length,
      users: safeUsers,
    });

    room.current = safeUsers;

    this.saveAll(data);

    const afterData = this.getAll();
    const afterRoom = this.ensureRoom(afterData, roomName);

    console.log("🟢 [ROOM_USERS_SET_ROOM_USERS_AFTER]", {
      roomName,
      afterCount: afterRoom.current.length,
      users: afterRoom.current,
    });

    return afterRoom.current;
  }

  addUser(roomName, user) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    const username = String(
      user.username || user.name || user.user || user
    ).trim();

    if (!username) {
      console.log("❌ [ROOM_USERS_ADD_USER_EMPTY_USERNAME]", {
        roomName,
        user,
      });

      return room.current;
    }

    const index = room.current.findIndex((item) => {
      return normalizeUsername(item.username) === normalizeUsername(username);
    });

    const nextUser = {
      username,
      role: user.role || "",
      userId: user.userId || user.user_id || user.id || "",
      photoUrl: user.photoUrl || user.photo_url || "",
      joinedAt:
        index !== -1 && room.current[index].joinedAt
          ? room.current[index].joinedAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log("➕ [ROOM_USERS_ADD_OR_UPDATE_USER]", {
      roomName,
      username,
      index,
      nextUser,
    });

    if (index === -1) {
      room.current.push(nextUser);
    } else {
      room.current[index] = {
        ...room.current[index],
        ...nextUser,
      };
    }

    this.addRecentUserToData(room, {
      username,
      role: user.role || "",
      userId: user.userId || user.user_id || user.id || "",
      photoUrl: user.photoUrl || user.photo_url || "",
    });

    this.saveAll(data);

    const afterUsers = this.getRoomUsers(roomName);

    console.log("🟢 [ROOM_USERS_ADD_USER_AFTER]", {
      roomName,
      count: afterUsers.length,
      users: afterUsers,
    });

    return afterUsers;
  }

  addRecentUserToData(room, user) {
    const username = String(user.username || "").trim();

    if (!username) {
      return;
    }

    room.recent = room.recent.filter((item) => {
      return normalizeUsername(item.username) !== normalizeUsername(username);
    });

    room.recent.unshift({
      username,
      role: user.role || "",
      userId: user.userId || "",
      photoUrl: user.photoUrl || "",
      enteredAt: new Date().toISOString(),
    });

    room.recent = room.recent.slice(0, 100);
  }

  removeUser(roomName, username) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    const before = room.current.length;

    room.current = room.current.filter((item) => {
      return normalizeUsername(item.username) !== normalizeUsername(username);
    });

    this.saveAll(data);

    const afterUsers = this.getRoomUsers(roomName);

    console.log("🗑️ [ROOM_USERS_REMOVE_USER]", {
      roomName,
      username,
      before,
      after: afterUsers.length,
      removed: before !== afterUsers.length,
    });

    return before !== afterUsers.length;
  }

  replaceRoomUsers(roomName, usersList) {
    const safeUsers = Array.isArray(usersList) ? usersList : [];

    const users = safeUsers
      .map((user) => {
        const username = String(
          user.username || user.name || user.user || ""
        ).trim();

        if (!username) {
          return null;
        }

        return {
          username,
          role: user.role || "",
          userId: user.userId || user.user_id || user.id || "",
          photoUrl: user.photoUrl || user.photo_url || "",
          joinedAt: user.joinedAt || new Date().toISOString(),
          updatedAt: user.updatedAt || new Date().toISOString(),
        };
      })
      .filter(Boolean);

    console.log("🔁 [ROOM_USERS_REPLACE_ROOM_USERS]", {
      roomName,
      count: users.length,
      users,
    });

    return this.setRoomUsers(roomName, users);
  }

  clearRoom(roomName) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    delete data[key];

    this.saveAll(data);

    console.log("🧹 [ROOM_USERS_CLEAR_ROOM]", {
      roomName,
      key,
    });

    return true;
  }
}

module.exports = {
  RoomUsersRepository,
};
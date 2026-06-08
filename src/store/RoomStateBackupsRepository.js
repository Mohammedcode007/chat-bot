const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const roomStateBackupsStore = new JsonStore(
  path.join(__dirname, "../data/roomStateBackups.json"),
  {}
);

function normalizeRoomKey(roomName) {
  return String(roomName || "").trim().toLowerCase();
}

class RoomStateBackupsRepository {
  getAll() {
    const data = roomStateBackupsStore.read();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data;
  }

  saveAll(data) {
    return roomStateBackupsStore.write(data || {});
  }

  saveRoomBackup(roomName, backup) {
    const data = this.getAll();
    const key = normalizeRoomKey(roomName);

    data[key] = {
      roomName,
      savedAt: new Date().toISOString(),
      savedAtTimestamp: Date.now(),
      savedBy: backup.savedBy || "",
      data: backup.data || {},
    };

    this.saveAll(data);

    return data[key];
  }

  getRoomBackup(roomName) {
    const data = this.getAll();
    const key = normalizeRoomKey(roomName);

    return data[key] || null;
  }

  deleteRoomBackup(roomName) {
    const data = this.getAll();
    const key = normalizeRoomKey(roomName);

    if (!data[key]) {
      return false;
    }

    delete data[key];
    this.saveAll(data);

    return true;
  }
}

module.exports = {
  RoomStateBackupsRepository,
};
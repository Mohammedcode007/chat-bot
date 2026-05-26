const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const musicRoomsStore = new JsonStore(
  path.join(__dirname, "../data/musicRooms.json"),
  []
);

class MusicRoomsRepository {
  getRooms() {
    return musicRoomsStore.read();
  }

  saveRooms(rooms) {
    return musicRoomsStore.write(rooms);
  }

  hasRoom(roomName) {
    return this.getRooms().some(
      (room) => normalizeUsername(room.roomName || room) === normalizeUsername(roomName)
    );
  }

  addRoom(roomName, addedBy) {
    const rooms = this.getRooms();

    const exists = rooms.some(
      (room) => normalizeUsername(room.roomName || room) === normalizeUsername(roomName)
    );

    if (exists) {
      return {
        added: false,
        alreadyExists: true,
      };
    }

    rooms.push({
      roomName,
      addedBy,
      addedAt: new Date().toISOString(),
    });

    this.saveRooms(rooms);

    return {
      added: true,
      alreadyExists: false,
    };
  }

  removeRoom(roomName) {
    const rooms = this.getRooms();

    const nextRooms = rooms.filter(
      (room) => normalizeUsername(room.roomName || room) !== normalizeUsername(roomName)
    );

    this.saveRooms(nextRooms);

    return rooms.length !== nextRooms.length;
  }
}

module.exports = {
  MusicRoomsRepository,
};
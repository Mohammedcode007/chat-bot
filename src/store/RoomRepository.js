const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const roomsStore = new JsonStore(path.join(__dirname, "../data/rooms.json"), []);

class RoomRepository {
  getRooms() {
    return roomsStore.read();
  }

  saveRooms(rooms) {
    return roomsStore.write(rooms);
  }

  addRoom(room) {
    const rooms = this.getRooms();

    const exists = rooms.some(
      (item) => normalizeUsername(item.roomName) === normalizeUsername(room.roomName)
    );

    if (exists) {
      return room;
    }

    rooms.push(room);
    this.saveRooms(rooms);

    return room;
  }

  removeRoom(roomName) {
    const rooms = this.getRooms();

    const nextRooms = rooms.filter(
      (room) => normalizeUsername(room.roomName) !== normalizeUsername(roomName)
    );

    this.saveRooms(nextRooms);

    return rooms.length !== nextRooms.length;
  }
}

module.exports = {
  RoomRepository,
};
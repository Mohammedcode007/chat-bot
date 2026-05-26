const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const roomUsersStore = new JsonStore(
  path.join(__dirname, "../data/roomUsers.json"),
  {}
);

class RoomUsersRepository {
  getAll() {
    return roomUsersStore.read();
  }

  saveAll(data) {
    return roomUsersStore.write(data);
  }

  ensureRoom(data, roomName) {
    const key = String(roomName || "").trim();

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

    return room.current;
  }

  getRecentUsers(roomName) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    return room.recent.slice(0, 100);
  }

  setRoomUsers(roomName, users) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    room.current = users;

    this.saveAll(data);

    return room.current;
  }

  addUser(roomName, user) {
    const data = this.getAll();
    const room = this.ensureRoom(data, roomName);

    const username = String(user.username || user.name || user.user || user).trim();

    if (!username) {
      return room.current;
    }

    const exists = room.current.some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );

    if (!exists) {
      room.current.push({
        username,
        role: user.role || "",
        userId: user.userId || user.user_id || user.id || "",
        photoUrl: user.photoUrl || user.photo_url || "",
        joinedAt: new Date().toISOString(),
      });
    }

    this.addRecentUserToData(room, {
      username,
      role: user.role || "",
      userId: user.userId || user.user_id || user.id || "",
      photoUrl: user.photoUrl || user.photo_url || "",
    });

    this.saveAll(data);

    return room.current;
  }

  addRecentUserToData(room, user) {
    const username = String(user.username || "").trim();

    if (!username) {
      return;
    }

    room.recent = room.recent.filter(
      (item) => normalizeUsername(item.username) !== normalizeUsername(username)
    );

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

    room.current = room.current.filter(
      (item) => normalizeUsername(item.username) !== normalizeUsername(username)
    );

    this.saveAll(data);

    return before !== room.current.length;
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
        };
      })
      .filter(Boolean);

    return this.setRoomUsers(roomName, users);
  }

  clearRoom(roomName) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    delete data[key];

    this.saveAll(data);

    return true;
  }
}

module.exports = {
  RoomUsersRepository,
};
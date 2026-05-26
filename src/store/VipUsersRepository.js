const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const vipUsersStore = new JsonStore(
  path.join(__dirname, "../data/vipUsers.json"),
  {}
);

class VipUsersRepository {
  getAll() {
    return vipUsersStore.read();
  }

  saveAll(data) {
    return vipUsersStore.write(data);
  }

  getRoomVip(roomName) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    return data[key] || [];
  }

  isVip(roomName, username) {
    return this.getRoomVip(roomName).some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );
  }

  addVip(roomName, username, addedBy) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    if (!data[key]) {
      data[key] = [];
    }

    const exists = data[key].some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );

    if (exists) {
      return {
        updated: false,
        alreadyVip: true,
      };
    }

    data[key].push({
      username,
      addedBy,
      addedAt: new Date().toISOString(),
    });

    this.saveAll(data);

    return {
      updated: true,
      alreadyVip: false,
    };
  }

  removeVip(roomName, username) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    const users = data[key] || [];

    const nextUsers = users.filter(
      (item) => normalizeUsername(item.username) !== normalizeUsername(username)
    );

    data[key] = nextUsers;
    this.saveAll(data);

    return users.length !== nextUsers.length;
  }
}

module.exports = {
  VipUsersRepository,
};
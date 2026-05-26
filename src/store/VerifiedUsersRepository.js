const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const verifiedUsersStore = new JsonStore(
  path.join(__dirname, "../data/verifiedUsers.json"),
  {}
);

class VerifiedUsersRepository {
  getAll() {
    return verifiedUsersStore.read();
  }

  saveAll(data) {
    return verifiedUsersStore.write(data);
  }

  getRoomVerified(roomName) {
    const data = this.getAll();
    const key = String(roomName || "").trim();

    return data[key] || [];
  }

  isVerified(roomName, username) {
    return this.getRoomVerified(roomName).some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );
  }

  verifyUser(roomName, username, verifiedBy) {
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
        alreadyVerified: true,
      };
    }

    data[key].push({
      username,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });

    this.saveAll(data);

    return {
      updated: true,
      alreadyVerified: false,
    };
  }

  unverifyUser(roomName, username) {
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
  VerifiedUsersRepository,
};
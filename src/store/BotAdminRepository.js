const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const botAdminsStore = new JsonStore(
  path.join(__dirname, "../data/botAdmins.json"),
  []
);

class BotAdminRepository {
  getAdmins() {
    return botAdminsStore.read();
  }

  saveAdmins(admins) {
    return botAdminsStore.write(admins);
  }

  isAdmin(username) {
    return this.getAdmins().some(
      (admin) => normalizeUsername(admin.username || admin) === normalizeUsername(username)
    );
  }

  addAdmin(username, addedBy) {
    const admins = this.getAdmins();

    const exists = admins.some(
      (admin) => normalizeUsername(admin.username || admin) === normalizeUsername(username)
    );

    if (exists) {
      return {
        added: false,
        alreadyExists: true,
      };
    }

    admins.push({
      username,
      addedBy,
      addedAt: new Date().toISOString(),
    });

    this.saveAdmins(admins);

    return {
      added: true,
      alreadyExists: false,
    };
  }

  removeAdmin(username) {
    const admins = this.getAdmins();

    const nextAdmins = admins.filter(
      (admin) => normalizeUsername(admin.username || admin) !== normalizeUsername(username)
    );

    this.saveAdmins(nextAdmins);

    return admins.length !== nextAdmins.length;
  }
}

module.exports = {
  BotAdminRepository,
};
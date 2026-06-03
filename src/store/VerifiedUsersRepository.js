const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const verifiedUsersStore = new JsonStore(
  path.join(__dirname, "../data/verifiedUsers.json"),
  {}
);

function makeKey(username) {
  return normalizeUsername(username);
}

class VerifiedUsersRepository {
  getAll() {
    const data = verifiedUsersStore.read();
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  saveAll(data) {
    return verifiedUsersStore.write(data || {});
  }

  /*
    توثيق عام:
    لم نعد نستخدم roomName هنا.
  */
  isVerified(username) {
    const data = this.getAll();
    const key = makeKey(username);

    return Boolean(data[key] && data[key].verified === true);
  }

  verifyUser(username, verifiedBy = "system") {
    const data = this.getAll();
    const key = makeKey(username);

    if (data[key] && data[key].verified === true) {
      return {
        updated: false,
        alreadyVerified: true,
        user: data[key],
      };
    }

    data[key] = {
      username,
      verified: true,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    };

    this.saveAll(data);

    return {
      updated: true,
      alreadyVerified: false,
      user: data[key],
    };
  }

  unverifyUser(username) {
    const data = this.getAll();
    const key = makeKey(username);

    if (!data[key]) {
      return false;
    }

    delete data[key];
    this.saveAll(data);

    return true;
  }

  listVerified() {
    const data = this.getAll();

    return Object.values(data || {}).filter((item) => {
      return item && item.verified === true;
    });
  }

  /*
    دوال توافقية حتى لا يكسر الكود القديم فورًا.
    لو أي ملف قديم ما زال يستدعي:
    isVerified(roomName, username)
    verifyUser(roomName, username, verifiedBy)
    unverifyUser(roomName, username)

    سيتم التعامل معها.
  */
  isVerifiedInRoom(roomName, username) {
    return this.isVerified(username);
  }

  verifyUserInRoom(roomName, username, verifiedBy = "system") {
    return this.verifyUser(username, verifiedBy);
  }

  unverifyUserInRoom(roomName, username) {
    return this.unverifyUser(username);
  }

  getRoomVerified() {
    return this.listVerified();
  }
}

module.exports = {
  VerifiedUsersRepository,
};
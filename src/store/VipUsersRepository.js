const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const vipUsersStore = new JsonStore(
  path.join(__dirname, "../data/vipUsers.json"),
  {}
);

function makeKey(username) {
  return normalizeUsername(username);
}

function getUsernameFromArgs(arg1, arg2) {
  /*
    دعم الشكل الجديد:
    isVip(username)

    ودعم الشكل القديم:
    isVip(roomName, username)
  */
  if (typeof arg2 !== "undefined") {
    return String(arg2 || "").trim();
  }

  return String(arg1 || "").trim();
}

function getAddedByFromArgs(arg1, arg2, arg3) {
  /*
    الشكل الجديد:
    addVip(username, addedBy)

    الشكل القديم:
    addVip(roomName, username, addedBy)
  */
  if (typeof arg3 !== "undefined") {
    return String(arg3 || "system").trim();
  }

  if (typeof arg2 !== "undefined") {
    return String(arg2 || "system").trim();
  }

  return "system";
}

class VipUsersRepository {
  getAll() {
    const data = vipUsersStore.read();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return data;
  }

  saveAll(data) {
    return vipUsersStore.write(data || {});
  }

  /*
    VIP عام على مستوى البوت كله.

    يدعم:
    isVip(username)
    isVip(roomName, username)
  */
  isVip(arg1, arg2) {
    const username = getUsernameFromArgs(arg1, arg2);

    if (!username) {
      return false;
    }

    const data = this.getAll();
    const key = makeKey(username);

    return Boolean(data[key] && data[key].vip === true);
  }

  /*
    يدعم:
    addVip(username, addedBy)
    addVip(roomName, username, addedBy)
  */
  addVip(arg1, arg2, arg3) {
    const username = getUsernameFromArgs(arg1, arg2);
    const addedBy = getAddedByFromArgs(arg1, arg2, arg3);

    if (!username) {
      return {
        updated: false,
        alreadyVip: false,
        error: "missing_username",
      };
    }

    const data = this.getAll();
    const key = makeKey(username);

    if (data[key] && data[key].vip === true) {
      return {
        updated: false,
        alreadyVip: true,
        user: data[key],
      };
    }

    data[key] = {
      username,
      vip: true,
      addedBy,
      addedAt: new Date().toISOString(),
    };

    this.saveAll(data);

    return {
      updated: true,
      alreadyVip: false,
      user: data[key],
    };
  }

  /*
    يدعم:
    removeVip(username)
    removeVip(roomName, username)
  */
  removeVip(arg1, arg2) {
    const username = getUsernameFromArgs(arg1, arg2);

    if (!username) {
      return false;
    }

    const data = this.getAll();
    const key = makeKey(username);

    if (!data[key]) {
      return false;
    }

    delete data[key];

    this.saveAll(data);

    return true;
  }

  listVip() {
    const data = this.getAll();

    return Object.values(data || {}).filter((item) => {
      return item && item.vip === true;
    });
  }

  /*
    دوال توافقية مباشرة لمن يستخدم أسماء قديمة.
  */
  getRoomVip() {
    return this.listVip();
  }

  isVipInRoom(roomName, username) {
    return this.isVip(username);
  }

  addVipInRoom(roomName, username, addedBy = "system") {
    return this.addVip(username, addedBy);
  }

  removeVipInRoom(roomName, username) {
    return this.removeVip(username);
  }
}

module.exports = {
  VipUsersRepository,
};
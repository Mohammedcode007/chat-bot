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

function clean(value) {
  return String(value || "").trim();
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
    const username =
      typeof arg2 !== "undefined"
        ? clean(arg2) // old: isVip(roomName, username)
        : clean(arg1); // new: isVip(username)

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

    مهم:
    لو جاء 2 args => arg1 هو username و arg2 هو addedBy
    لو جاء 3 args => arg2 هو username و arg3 هو addedBy
  */
  addVip(arg1, arg2, arg3) {
    const username =
      typeof arg3 !== "undefined"
        ? clean(arg2) // old: addVip(roomName, username, addedBy)
        : clean(arg1); // new: addVip(username, addedBy)

    const addedBy =
      typeof arg3 !== "undefined"
        ? clean(arg3) || "system"
        : clean(arg2) || "system";

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
    const username =
      typeof arg2 !== "undefined"
        ? clean(arg2) // old: removeVip(roomName, username)
        : clean(arg1); // new: removeVip(username)

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
    دوال توافقية مباشرة لو عندك ملفات قديمة تستخدم أسماء قديمة.
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
const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const watchUsersStore = new JsonStore(
  path.join(__dirname, "../data/watchUsers.json"),
  {}
);

class WatchUsersRepository {
  getAll() {
    return watchUsersStore.read();
  }

  saveAll(data) {
    return watchUsersStore.write(data);
  }

  getWatcherList(watcherUsername) {
    const data = this.getAll();
    const key = normalizeUsername(watcherUsername);

    return data[key] || [];
  }

  isWatching(watcherUsername, targetUsername) {
    const target = normalizeUsername(targetUsername);

    return this.getWatcherList(watcherUsername).some((item) => {
      return normalizeUsername(item.username) === target;
    });
  }

  addWatch(watcherUsername, targetUsername, roomName) {
    const data = this.getAll();

    const watcherKey = normalizeUsername(watcherUsername);

    if (!data[watcherKey]) {
      data[watcherKey] = [];
    }

    const exists = data[watcherKey].some((item) => {
      return normalizeUsername(item.username) === normalizeUsername(targetUsername);
    });

    if (exists) {
      return {
        added: false,
        alreadyExists: true,
      };
    }

    data[watcherKey].push({
      username: targetUsername,
      addedFromRoom: roomName || "",
      addedAt: new Date().toISOString(),
    });

    this.saveAll(data);

    return {
      added: true,
      alreadyExists: false,
    };
  }

  removeWatch(watcherUsername, targetUsername) {
    const data = this.getAll();

    const watcherKey = normalizeUsername(watcherUsername);

    const list = data[watcherKey] || [];

    const nextList = list.filter((item) => {
      return normalizeUsername(item.username) !== normalizeUsername(targetUsername);
    });

    data[watcherKey] = nextList;

    this.saveAll(data);

    return list.length !== nextList.length;
  }

  findWatchersForTarget(targetUsername) {
    const data = this.getAll();

    const target = normalizeUsername(targetUsername);

    const watchers = [];

    Object.entries(data || {}).forEach(([watcherKey, list]) => {
      if (!Array.isArray(list)) {
        return;
      }

      const found = list.some((item) => {
        return normalizeUsername(item.username) === target;
      });

      if (found) {
        watchers.push(watcherKey);
      }
    });

    return watchers;
  }
}

module.exports = {
  WatchUsersRepository,
};
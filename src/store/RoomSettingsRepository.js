const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const roomSettingsStore = new JsonStore(
  path.join(__dirname, "../data/roomSettings.json"),
  {}
);

function makeDefaultSettings() {
  return {
    enabled: true,

    musicEnabled: true,
    lookupEnabled: true,
    profileEnabled: true,
    watchEnabled: true,
    inviteEnabled: true,
    logsEnabled: true,

    welcomeEnabled: false,
    welcomeText: "Welcome {user} to {room}",

    vipProtectionEnabled: true,

    autoBanRoleNoneEnabled: false,

    antiSpamEnabled: false,
    maxMessagesPer10Seconds: 5,
    repeatedMessageLimit: 3,

    badWordsEnabled: false,
    badWordsMode: "warn", // warn | kick | ban
    badWords: [],

    linksEnabled: true,

    updatedAt: new Date().toISOString(),
  };
}

function normalizeRoomKey(roomName) {
  return normalizeUsername(roomName);
}

class RoomSettingsRepository {
  getAll() {
    const data = roomSettingsStore.read();
    return data && typeof data === "object" ? data : {};
  }

  saveAll(data) {
    return roomSettingsStore.write(data || {});
  }

  getRoomSettings(roomName) {
    const data = this.getAll();
    const key = normalizeRoomKey(roomName);

    return {
      ...makeDefaultSettings(),
      ...(data[key] || {}),
    };
  }

  saveRoomSettings(roomName, settings) {
    const data = this.getAll();
    const key = normalizeRoomKey(roomName);

    data[key] = {
      ...makeDefaultSettings(),
      ...(settings || {}),
      updatedAt: new Date().toISOString(),
    };

    this.saveAll(data);

    return data[key];
  }

  updateRoomSettings(roomName, patch) {
    const current = this.getRoomSettings(roomName);

    return this.saveRoomSettings(roomName, {
      ...current,
      ...(patch || {}),
    });
  }

  setValue(roomName, key, value) {
    return this.updateRoomSettings(roomName, {
      [key]: value,
    });
  }

  addBadWord(roomName, word) {
    const cleanWord = String(word || "").trim();

    if (!cleanWord) {
      return {
        added: false,
        reason: "empty_word",
      };
    }

    const settings = this.getRoomSettings(roomName);
    const words = Array.isArray(settings.badWords) ? settings.badWords : [];

    const exists = words.some(
      (item) => normalizeUsername(item) === normalizeUsername(cleanWord)
    );

    if (exists) {
      return {
        added: false,
        alreadyExists: true,
        settings,
      };
    }

    const nextSettings = this.updateRoomSettings(roomName, {
      badWords: [...words, cleanWord],
    });

    return {
      added: true,
      alreadyExists: false,
      settings: nextSettings,
    };
  }

  removeBadWord(roomName, word) {
    const cleanWord = String(word || "").trim();
    const settings = this.getRoomSettings(roomName);
    const words = Array.isArray(settings.badWords) ? settings.badWords : [];

    const nextWords = words.filter(
      (item) => normalizeUsername(item) !== normalizeUsername(cleanWord)
    );

    const removed = nextWords.length !== words.length;

    const nextSettings = this.updateRoomSettings(roomName, {
      badWords: nextWords,
    });

    return {
      removed,
      settings: nextSettings,
    };
  }
}

module.exports = {
  RoomSettingsRepository,
  makeDefaultSettings,
};
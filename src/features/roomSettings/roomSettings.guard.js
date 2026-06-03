const { normalizeUsername } = require("../../utils/text");
const { RoomSettingsRepository } = require("../../store/RoomSettingsRepository");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const roomSettingsRepository = new RoomSettingsRepository();
const vipUsersRepository = new VipUsersRepository();

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function getRoomSettings(roomName) {
  return roomSettingsRepository.getRoomSettings(roomName);
}

function isRoomFeatureEnabled(roomName, featureKey) {
  const settings = getRoomSettings(roomName);

  if (settings.enabled === false) {
    return false;
  }

  return settings[featureKey] !== false;
}

function isVipAnywhere(username) {
  const target = normalizeForCheck(username);
  const data = vipUsersRepository.getAll();

  return Object.values(data || {}).some((roomVipList) => {
    if (!Array.isArray(roomVipList)) {
      return false;
    }

    return roomVipList.some((item) => {
      return normalizeForCheck(item.username) === target;
    });
  });
}

function handleAutoBanRoleNoneOnJoin({ socket, roomName, username, role }) {
  if (!username || !roomName || !socket) {
    return false;
  }

  const settings = getRoomSettings(roomName);

  if (!settings.autoBanRoleNoneEnabled) {
    return false;
  }

  const cleanRole = String(role || "").trim().toLowerCase();

  if (cleanRole !== "none") {
    return false;
  }

  if (settings.vipProtectionEnabled && isVipAnywhere(username)) {
    socket.sendRoomMessage(`Protected VIP entered with role none: ${username}`);
    return false;
  }

  if (typeof socket.sendRoomBan !== "function") {
    socket.sendRoomMessage("Auto ban failed: ban command is not supported.");
    return false;
  }

  const sent = socket.sendRoomBan(username, roomName);

  if (sent) {
    socket.sendRoomMessage(`Auto banned role none: ${username}`);
  }

  return sent;
}

function handleWelcomeOnJoin({ socket, roomName, username }) {
  if (!username || !roomName || !socket) {
    return false;
  }

  const settings = getRoomSettings(roomName);

  if (!settings.welcomeEnabled) {
    return false;
  }

  const text = String(settings.welcomeText || "Welcome {user} to {room}")
    .replaceAll("{user}", username)
    .replaceAll("{room}", roomName);

  socket.sendRoomMessage(text);

  return true;
}

function containsBadWord(roomName, text) {
  const settings = getRoomSettings(roomName);

  if (!settings.badWordsEnabled) {
    return {
      matched: false,
    };
  }

  const body = normalizeForCheck(text);

  const matchedWord = (settings.badWords || []).find((word) => {
    return body.includes(normalizeForCheck(word));
  });

  return {
    matched: Boolean(matchedWord),
    word: matchedWord || "",
    mode: settings.badWordsMode || "warn",
  };
}

module.exports = {
  getRoomSettings,
  isRoomFeatureEnabled,
  isVipAnywhere,
  handleAutoBanRoleNoneOnJoin,
  handleWelcomeOnJoin,
  containsBadWord,
};
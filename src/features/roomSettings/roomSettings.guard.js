const { normalizeUsername } = require("../../utils/text");
const { RoomSettingsRepository } = require("../../store/RoomSettingsRepository");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const roomSettingsRepository = new RoomSettingsRepository();
const vipUsersRepository = new VipUsersRepository();

/*
  ذاكرة مؤقتة للسبام فقط أثناء تشغيل البوت
*/
const spamMemory = new Map();

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

/*
  حظر تلقائي لمن يدخل برتبة none
  يعمل فقط إذا:
  set@autoban_none@on
*/
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

  /*
    لو حماية VIP مفعلة، لا يحظر VIP حتى لو role none
  */
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

/*
  رسالة الترحيب
  تعمل فقط إذا:
  set@welcome@on
*/
function handleWelcomeOnJoin({ socket, roomName, username }) {
  if (!username || !roomName || !socket) {
    return false;
  }

  const settings = getRoomSettings(roomName);

  if (!settings.welcomeEnabled) {
    return false;
  }

  const text = String(settings.welcomeText || "Welcome $")
    .replaceAll("$", username)
    .replaceAll("{user}", username)
    .replaceAll("{room}", roomName);

  socket.sendRoomMessage(text);

  return true;
}

/*
  فحص الكلمات الممنوعة
  يعمل فقط إذا:
  set@badwords@on
*/
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

/*
  فحص الروابط
  إذا linksEnabled = false
  يمنع الروابط.
*/
function hasLink(text) {
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|discord\.gg\/|chat\.whatsapp\.com\/)/i.test(
    String(text || "")
  );
}

function shouldBlockLink(roomName, text) {
  const settings = getRoomSettings(roomName);

  /*
    linksEnabled = true يعني الروابط مسموحة
    linksEnabled = false يعني الروابط ممنوعة
  */
  if (settings.linksEnabled !== false) {
    return false;
  }

  return hasLink(text);
}

/*
  فحص السبام
  يعمل فقط إذا:
  set@antispam@on
*/
function makeSpamKey(roomName, username) {
  return `${normalizeForCheck(roomName)}::${normalizeForCheck(username)}`;
}

function checkAntiSpam({ roomName, username, text }) {
  const settings = getRoomSettings(roomName);

  if (!settings.antiSpamEnabled) {
    return {
      blocked: false,
    };
  }

  if (!roomName || !username) {
    return {
      blocked: false,
    };
  }

  /*
    لا تطبق antispam على VIP لو حماية VIP مفعلة
  */
  if (settings.vipProtectionEnabled && isVipAnywhere(username)) {
    return {
      blocked: false,
      vipProtected: true,
    };
  }

  const key = makeSpamKey(roomName, username);
  const now = Date.now();

  const oldData = spamMemory.get(key) || {
    messages: [],
  };

  /*
    نحتفظ برسائل آخر 10 ثواني فقط
  */
  const messages = oldData.messages.filter((item) => {
    return now - item.time <= 10 * 1000;
  });

  const cleanText = String(text || "").trim();

  messages.push({
    text: cleanText,
    time: now,
  });

  spamMemory.set(key, {
    messages,
  });

  const maxMessages = Number(settings.maxMessagesPer10Seconds || 5);

  if (messages.length > maxMessages) {
    return {
      blocked: true,
      reason: "too_many_messages",
      count: messages.length,
      max: maxMessages,
    };
  }

  const repeatedMessageLimit = Number(settings.repeatedMessageLimit || 3);

  const repeatedCount = messages.filter((item) => {
    return item.text === cleanText;
  }).length;

  if (repeatedCount >= repeatedMessageLimit) {
    return {
      blocked: true,
      reason: "repeated_message",
      count: repeatedCount,
      max: repeatedMessageLimit,
    };
  }

  return {
    blocked: false,
  };
}

function clearAntiSpamForUser(roomName, username) {
  const key = makeSpamKey(roomName, username);
  spamMemory.delete(key);
}

module.exports = {
  getRoomSettings,
  isRoomFeatureEnabled,
  isVipAnywhere,

  handleAutoBanRoleNoneOnJoin,
  handleWelcomeOnJoin,

  containsBadWord,
  hasLink,
  shouldBlockLink,

  checkAntiSpam,
  clearAntiSpamForUser,
};
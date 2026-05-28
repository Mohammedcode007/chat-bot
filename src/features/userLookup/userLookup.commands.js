const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const roomUsersRepository = new RoomUsersRepository();
const vipUsersRepository = new VipUsersRepository();

function isUserLookupCommand(command) {
  return command === "user_lookup";
}

function normalizeForSearch(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function getCurrentUsersFromRoomData(roomData) {
  if (Array.isArray(roomData)) {
    return roomData;
  }

  if (roomData && Array.isArray(roomData.current)) {
    return roomData.current;
  }

  return [];
}

function getUserDisplayName(user) {
  return String(
    user.username ||
      user.name ||
      user.user ||
      user.from ||
      ""
  ).trim();
}

function getUserId(user) {
  return String(
    user.userId ||
      user.user_id ||
      user.id ||
      ""
  ).trim();
}

function userMatches(user, searchText) {
  const target = normalizeForSearch(searchText);

  if (!target) {
    return false;
  }

  const username = normalizeForSearch(getUserDisplayName(user));
  const userId = normalizeForSearch(getUserId(user));

  return (
    username === target ||
    username.includes(target) ||
    target.includes(username) ||
    userId === target
  );
}

function findUserRoomsAndUser(searchText) {
  const data = roomUsersRepository.getAll();

  const roomsMap = new Map();
  let foundRealUser = null;

  Object.entries(data || {}).forEach(([roomName, roomData]) => {
    const users = getCurrentUsersFromRoomData(roomData);

    const foundUser = users.find((user) => userMatches(user, searchText));

    if (!foundUser) {
      return;
    }

    const cleanRoomName = String(roomName || "").trim();

    if (cleanRoomName) {
      roomsMap.set(normalizeUsername(cleanRoomName), cleanRoomName);
    }

    /*
      نحفظ أول نسخة حقيقية من المستخدم من roomUsers.json
      حتى نرسل الخاص للاسم الكامل الصحيح.
    */
    if (!foundRealUser) {
      foundRealUser = foundUser;
    }
  });

  return {
    rooms: Array.from(roomsMap.values()),
    user: foundRealUser,
  };
}

function isVipAnywhere(username) {
  const target = normalizeForSearch(username);
  const data = vipUsersRepository.getAll();

  return Object.values(data || {}).some((roomVipList) => {
    if (!Array.isArray(roomVipList)) {
      return false;
    }

    return roomVipList.some((item) => {
      return normalizeForSearch(item.username) === target;
    });
  });
}

function formatLookupResult(searchText, rooms, realUsername) {
  if (!rooms.length) {
    return [
      "User lookup result",
      `Search: ${searchText}`,
      "Status: not found in active rooms.",
    ].join("\n");
  }

  const lines = rooms.map((roomName, index) => {
    return `${index + 1}. ${roomName}`;
  });

  return [
    "User lookup result",
    `User: ${realUsername || searchText}`,
    `Rooms found: ${rooms.length}`,
    "",
    ...lines,
  ].join("\n");
}

function buildNotifyText({ isVip, sender }) {
  if (isVip) {
    return [
      "Search notification",
      "Someone searched for you.",
      `Searched by: ${sender}`,
    ].join("\n");
  }

  return [
    "Search notification",
    "Someone searched for you.",
    `To know who searched for you, message the bot owner: ${
      BOT_OWNER_USERNAME || "bot owner"
    }`,
  ].join("\n");
}

function notifyTargetUser({ socket, targetUser, sender, isVip }) {
  const realUsername = getUserDisplayName(targetUser);

  if (!realUsername) {
    console.log("⚠️ [LOOKUP_PRIVATE_SKIP]", {
      reason: "missing_real_username",
      targetUser,
      sender,
    });

    return false;
  }

  if (normalizeUsername(realUsername) === normalizeUsername(sender)) {
    console.log("⚠️ [LOOKUP_PRIVATE_SKIP]", {
      reason: "sender_is_target",
      realUsername,
      sender,
    });

    return false;
  }

  const text = buildNotifyText({
    isVip,
    sender,
  });

  console.log("📤 [LOOKUP_PRIVATE_TRY]", {
    to: realUsername,
    sender,
    isVip,
    text,
  });

  const sent = socket.sendPrivate(realUsername, text);

  console.log("📤 [LOOKUP_PRIVATE_SENT]", {
    to: realUsername,
    sent,
  });

  return sent;
}

function handleUserLookupCommand(context) {
  const { sender, socket, parsed } = context;

  const searchText = parsed.args[0];

  if (!searchText) {
    socket.sendRoomMessage("Use: is@username");
    return;
  }

  const result = findUserRoomsAndUser(searchText);

  const realUsername = result.user ? getUserDisplayName(result.user) : "";

  socket.sendRoomMessage(
    formatLookupResult(searchText, result.rooms, realUsername)
  );

  /*
    لو لم يتم العثور على المستخدم في roomUsers.json
    لا نرسل خاص لأنه لا يوجد اسم حقيقي كامل.
  */
  if (!result.user || !realUsername) {
    console.log("⚠️ [USER_LOOKUP_NOTIFY_SKIPPED]", {
      reason: "target_not_found_or_missing_real_username",
      searchText,
      sender,
    });

    return;
  }

  const targetIsVip = isVipAnywhere(realUsername);

  const sent = notifyTargetUser({
    socket,
    targetUser: result.user,
    sender,
    isVip: targetIsVip,
  });

  console.log("📩 [USER_LOOKUP_NOTIFY_RESULT]", {
    searchText,
    realUsername,
    sender,
    isVip: targetIsVip,
    sent,
  });
}

module.exports = {
  isUserLookupCommand,
  handleUserLookupCommand,
};
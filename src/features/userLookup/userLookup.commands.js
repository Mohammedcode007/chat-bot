const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const roomUsersRepository = new RoomUsersRepository();
const vipUsersRepository = new VipUsersRepository();

function isUserLookupCommand(command) {
  return command === "user_lookup";
}

function getRoomNameFromRoomData(roomDataKey) {
  return String(roomDataKey || "").trim();
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

function findUserRooms(username) {
  const target = normalizeUsername(username);
  const data = roomUsersRepository.getAll();

  const roomsMap = new Map();

  Object.entries(data || {}).forEach(([roomName, roomData]) => {
    const users = getCurrentUsersFromRoomData(roomData);

    const found = users.some((user) => {
      return normalizeUsername(user.username || user.name || user.user) === target;
    });

    if (found) {
      const cleanRoomName = getRoomNameFromRoomData(roomName);

      if (cleanRoomName) {
        roomsMap.set(normalizeUsername(cleanRoomName), cleanRoomName);
      }
    }
  });

  return Array.from(roomsMap.values());
}

function isVipAnywhere(username) {
  const target = normalizeUsername(username);
  const data = vipUsersRepository.getAll();

  return Object.values(data || {}).some((roomVipList) => {
    if (!Array.isArray(roomVipList)) {
      return false;
    }

    return roomVipList.some((item) => {
      return normalizeUsername(item.username) === target;
    });
  });
}

function formatLookupResult(username, rooms) {
  if (!rooms.length) {
    return [
      "User lookup result",
      `User: ${username}`,
      "Status: not found in active rooms.",
    ].join("\n");
  }

  const lines = rooms.map((roomName, index) => {
    return `${index + 1}. ${roomName}`;
  });

  return [
    "User lookup result",
    `User: ${username}`,
    `Rooms found: ${rooms.length}`,
    "",
    ...lines,
  ].join("\n");
}

function notifyTargetUser({ socket, targetUsername, sender, isVip }) {
  if (!targetUsername) {
    return;
  }

  if (normalizeUsername(targetUsername) === normalizeUsername(sender)) {
    return;
  }

  if (isVip) {
    socket.sendPrivate(
      targetUsername,
      [
        "Search notification",
        `Someone searched for you.`,
        `Searched by: ${sender}`,
      ].join("\n")
    );

    return;
  }

  socket.sendPrivate(
    targetUsername,
    [
      "Search notification",
      "Someone searched for you.",
      `To know who searched for you, message the bot owner: ${BOT_OWNER_USERNAME || "bot owner"}`,
    ].join("\n")
  );
}

function handleUserLookupCommand(context) {
  const { sender, socket, parsed } = context;

  const username = parsed.args[0];

  if (!username) {
    socket.sendRoomMessage("Use: is@username");
    return;
  }

  const rooms = findUserRooms(username);
  const targetIsVip = isVipAnywhere(username);

  socket.sendRoomMessage(formatLookupResult(username, rooms));

  notifyTargetUser({
    socket,
    targetUsername: username,
    sender,
    isVip: targetIsVip,
  });
}

module.exports = {
  isUserLookupCommand,
  handleUserLookupCommand,
};
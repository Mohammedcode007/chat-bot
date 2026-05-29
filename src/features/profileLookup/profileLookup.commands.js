const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function findUserInRoomStorage(roomName, username) {
  const roomUsersRepository = new RoomUsersRepository();

  const currentUsers = roomUsersRepository.getRoomUsers(roomName);
  const recentUsers = roomUsersRepository.getRecentUsers(roomName);

  const allUsers = [...currentUsers, ...recentUsers];

  const target = allUsers.find(
    (user) =>
      normalizeUsername(user.username) === normalizeUsername(username)
  );

  return target || null;
}

function formatProfileMessage({ username, user, isCurrent }) {
  const lines = [];

  lines.push("👤 Profile Lookup");
  lines.push("");
  lines.push(`Username: ${user?.username || username}`);

  if (user?.role) {
    lines.push(`Role: ${user.role}`);
  }

  if (user?.userId) {
    lines.push(`User ID: ${user.userId}`);
  }

  if (user?.photoUrl) {
    lines.push(`Photo: ${user.photoUrl}`);
  }

  lines.push(`Status: ${isCurrent ? "In room now" : "Recent room user"}`);

  return lines.join("\n");
}

function notifyTargetUser({ socket, roomName, targetUsername, searchedBy }) {
  const vipUsersRepository = new VipUsersRepository();

  const isVip = vipUsersRepository.isVip(roomName, targetUsername);

  if (isVip) {
    socket.sendPrivate(
      targetUsername,
      `🔍 ${searchedBy} searched for your profile in ${roomName}.`
    );
    return;
  }

  const ownerUsername = String(BOT_OWNER_USERNAME || "").trim();

  socket.sendPrivate(
    targetUsername,
    [
      "🔍 Someone searched for your profile.",
      ownerUsername
        ? `To know who searched, contact: ${ownerUsername}`
        : "To know who searched, contact the bot owner.",
    ].join("\n")
  );
}

function handleProfileLookupCommand(context) {
  const { parsed, socket, bot, sender } = context;

  const username = getTargetUsername(parsed);

  if (!username) {
    socket.sendRoomMessage("Usage: p@username");
    return;
  }

  const roomName = bot.roomName;

  const roomUsersRepository = new RoomUsersRepository();

  const currentUsers = roomUsersRepository.getRoomUsers(roomName);

  const user = findUserInRoomStorage(roomName, username);

  if (!user) {
    socket.sendRoomMessage(
      [
        "👤 Profile Lookup",
        "",
        `Username: ${username}`,
        "Status: Not found in saved room users.",
      ].join("\n")
    );

    notifyTargetUser({
      socket,
      roomName,
      targetUsername: username,
      searchedBy: sender,
    });

    return;
  }

  const isCurrent = currentUsers.some(
    (item) =>
      normalizeUsername(item.username) === normalizeUsername(username)
  );

  socket.sendRoomMessage(
    formatProfileMessage({
      username,
      user,
      isCurrent,
    })
  );

  notifyTargetUser({
    socket,
    roomName,
    targetUsername: username,
    searchedBy: sender,
  });
}

module.exports = {
  handleProfileLookupCommand,
};
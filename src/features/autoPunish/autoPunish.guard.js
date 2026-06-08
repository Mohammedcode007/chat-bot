const { normalizeUsername } = require("../../utils/text");
const { AutoPunishUsersRepository } = require("../../store/AutoPunishUsersRepository");

const autoPunishUsersRepository = new AutoPunishUsersRepository();

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function handleAutoPunishOnJoin({ socket, roomName, username }) {
  if (!socket || !roomName || !username) {
    return false;
  }

  /*
    الأولوية للحظر.
    لو موجود في autoBan يتحظر ولا يتم تنفيذ kick.
  */
  if (autoPunishUsersRepository.isAutoBan(roomName, username)) {
    if (typeof socket.sendRoomBan !== "function") {
      socket.sendRoomMessage("Auto ban failed: ban command is not supported.");
      return false;
    }

    const sent = socket.sendRoomBan(username, roomName);

    if (sent !== false) {
      socket.sendRoomMessage(`🚫 Auto banned: ${username}`);
    }

    console.log("🚫 [AUTO_BAN_ON_JOIN]", {
      roomName,
      username,
    });

    return true;
  }

  if (autoPunishUsersRepository.isAutoKick(roomName, username)) {
    if (typeof socket.sendRoomKick !== "function") {
      socket.sendRoomMessage("Auto kick failed: kick command is not supported.");
      return false;
    }

    const sent = socket.sendRoomKick(username, roomName);

    if (sent !== false) {
      socket.sendRoomMessage(`👢 Auto kicked: ${username}`);
    }

    console.log("👢 [AUTO_KICK_ON_JOIN]", {
      roomName,
      username,
    });

    return true;
  }

  return false;
}

module.exports = {
  handleAutoPunishOnJoin,
};
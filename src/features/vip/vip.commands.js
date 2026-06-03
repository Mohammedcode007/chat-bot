const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const vipUsersRepository = new VipUsersRepository();

function isBotOwner(username) {
  return normalizeUsername(username) === normalizeUsername(BOT_OWNER_USERNAME);
}

function handleVipCommand(context) {
  const { sender, socket, parsed } = context;

  const username = String(parsed.args[0] || "").trim();

  if (!username) {
    socket.sendRoomMessage("Use: vip@username or unvip@username");
    return;
  }

  if (!isBotOwner(sender)) {
    socket.sendRoomMessage("Only bot owner can manage VIP users.");
    return;
  }

  if (parsed.command === "vip") {
    const result = vipUsersRepository.addVip(username, sender);

    if (result.alreadyVip) {
      socket.sendRoomMessage(`Already VIP: ${username}`);
      return;
    }

    socket.sendRoomMessage(`VIP added globally: ${username}`);
    return;
  }

  if (parsed.command === "unvip") {
    const removed = vipUsersRepository.removeVip(username);

    if (!removed) {
      socket.sendRoomMessage(`This user is not VIP: ${username}`);
      return;
    }

    socket.sendRoomMessage(`VIP removed globally: ${username}`);
    return;
  }
}

module.exports = {
  handleVipCommand,
  isBotOwner,
};
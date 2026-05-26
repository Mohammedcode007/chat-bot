const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { VipUsersRepository } = require("../../store/VipUsersRepository");

const vipUsersRepository = new VipUsersRepository();

function isBotOwner(username) {
  return normalizeUsername(username) === normalizeUsername(BOT_OWNER_USERNAME);
}

function handleVipCommand(context) {
  const { bot, sender, socket, parsed } = context;

  const username = parsed.args[0];

  if (!username) {
    socket.sendRoomMessage("Use: vip@username or unvip@username");
    return;
  }

  if (!isBotOwner(sender)) {
    socket.sendRoomMessage("Only bot owner can manage VIP users.");
    return;
  }

  if (parsed.command === "vip") {
    const result = vipUsersRepository.addVip(
      bot.roomName,
      username,
      sender
    );

    if (result.alreadyVip) {
      socket.sendRoomMessage(`Already VIP: ${username}`);
      return;
    }

    socket.sendRoomMessage(`VIP added: ${username}`);
    return;
  }

  if (parsed.command === "unvip") {
    const removed = vipUsersRepository.removeVip(
      bot.roomName,
      username
    );

    if (!removed) {
      socket.sendRoomMessage(`This user is not VIP: ${username}`);
      return;
    }

    socket.sendRoomMessage(`VIP removed: ${username}`);
  }
}

module.exports = {
  handleVipCommand,
  isBotOwner,
};
const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { BotAdminRepository } = require("../../store/BotAdminRepository");

const botAdminRepository = new BotAdminRepository();

function isBotOwner(username) {
  return normalizeUsername(username) === normalizeUsername(BOT_OWNER_USERNAME);
}

function handleBotAdminCommand(context) {
  const { sender, socket, parsed } = context;

  const username = parsed.args[0];

  if (!username) {
    socket.sendRoomMessage("Use: admin@username or radmin@username");
    return;
  }

  if (!isBotOwner(sender)) {
    socket.sendRoomMessage("Only bot owner can manage admins.");
    return;
  }

  if (parsed.command === "adminadd") {
    const result = botAdminRepository.addAdmin(username, sender);

    if (result.alreadyExists) {
      socket.sendRoomMessage(`Already bot admin: ${username}`);
      return;
    }

    socket.sendRoomMessage(`Bot admin added: ${username}`);
    return;
  }

  if (parsed.command === "adminremove") {
    const removed = botAdminRepository.removeAdmin(username);

    if (!removed) {
      socket.sendRoomMessage(`This user is not bot admin: ${username}`);
      return;
    }

    socket.sendRoomMessage(`Bot admin removed: ${username}`);
  }
}

module.exports = {
  handleBotAdminCommand,
  isBotOwner,
};
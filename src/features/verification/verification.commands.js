const { BotAdminRepository } = require("../../store/BotAdminRepository");
const { VerifiedUsersRepository } = require("../../store/VerifiedUsersRepository");

const botAdminRepository = new BotAdminRepository();
const verifiedUsersRepository = new VerifiedUsersRepository();

function canVerify(sender) {
  return botAdminRepository.isAdmin(sender);
}

function handleVerificationCommand(context) {
  const { bot, sender, socket, parsed } = context;

  const username = parsed.args[0];

  if (!username) {
    socket.sendRoomMessage("Use: v@username or unver@username");
    return;
  }

  if (!canVerify(sender)) {
    socket.sendRoomMessage("Only bot admins can verify users.");
    return;
  }

  if (parsed.command === "verify") {
    const result = verifiedUsersRepository.verifyUser(
      bot.roomName,
      username,
      sender
    );

    if (result.alreadyVerified) {
      socket.sendRoomMessage(`Already verified: ${username}`);
      return;
    }

    socket.sendRoomMessage(`Verified: ${username}`);
    return;
  }

  if (parsed.command === "unverify") {
    const removed = verifiedUsersRepository.unverifyUser(
      bot.roomName,
      username
    );

    if (!removed) {
      socket.sendRoomMessage(`This user is not verified: ${username}`);
      return;
    }

    socket.sendRoomMessage(`Unverified: ${username}`);
  }
}

module.exports = {
  handleVerificationCommand,
};
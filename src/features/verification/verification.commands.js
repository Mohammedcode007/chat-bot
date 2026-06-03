const { VerifiedUsersRepository } = require("../../store/VerifiedUsersRepository");

const verifiedUsersRepository = new VerifiedUsersRepository();

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function handleVerificationCommand(context) {
  const { sender, socket, parsed } = context;

  const username = getTargetUsername(parsed);

  if (!username) {
    socket.sendRoomMessage("Use: v@username or unver@username");
    return;
  }

  if (parsed.command === "verify") {
    const result = verifiedUsersRepository.verifyUser(username, sender);

    if (result.alreadyVerified) {
      socket.sendRoomMessage(`Already verified: ${username}`);
      return;
    }

    socket.sendRoomMessage(`Verified: ${username}`);
    return;
  }

  if (parsed.command === "unverify") {
    const removed = verifiedUsersRepository.unverifyUser(username);

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
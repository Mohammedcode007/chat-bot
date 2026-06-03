const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { VerifiedUsersRepository } = require("../../store/VerifiedUsersRepository");
const { BotAdminRepository } = require("../../store/BotAdminRepository");

const verifiedUsersRepository = new VerifiedUsersRepository();
const botAdminRepository = new BotAdminRepository();

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function isBotOwner(username) {
  return normalizeForCheck(username) === normalizeForCheck(BOT_OWNER_USERNAME);
}

function isBotAdmin(username) {
  const target = normalizeForCheck(username);

  /*
    دعم أكثر من شكل محتمل داخل BotAdminRepository
    حتى لا يتعطل لو عندك اسم الدالة مختلف.
  */

  if (typeof botAdminRepository.isAdmin === "function") {
    return botAdminRepository.isAdmin(username);
  }

  if (typeof botAdminRepository.isBotAdmin === "function") {
    return botAdminRepository.isBotAdmin(username);
  }

  if (typeof botAdminRepository.hasAdmin === "function") {
    return botAdminRepository.hasAdmin(username);
  }

  if (typeof botAdminRepository.getAdmins === "function") {
    const admins = botAdminRepository.getAdmins();

    return (admins || []).some((item) => {
      const adminUsername =
        typeof item === "string"
          ? item
          : item.username || item.name || item.user || "";

      return normalizeForCheck(adminUsername) === target;
    });
  }

  if (typeof botAdminRepository.listAdmins === "function") {
    const admins = botAdminRepository.listAdmins();

    return (admins || []).some((item) => {
      const adminUsername =
        typeof item === "string"
          ? item
          : item.username || item.name || item.user || "";

      return normalizeForCheck(adminUsername) === target;
    });
  }

  if (typeof botAdminRepository.getAll === "function") {
    const data = botAdminRepository.getAll();

    if (Array.isArray(data)) {
      return data.some((item) => {
        const adminUsername =
          typeof item === "string"
            ? item
            : item.username || item.name || item.user || "";

        return normalizeForCheck(adminUsername) === target;
      });
    }

    if (data && typeof data === "object") {
      return Object.values(data).some((item) => {
        const adminUsername =
          typeof item === "string"
            ? item
            : item.username || item.name || item.user || "";

        return normalizeForCheck(adminUsername) === target;
      });
    }
  }

  return false;
}

function canManageVerification(username) {
  return isBotOwner(username) || isBotAdmin(username);
}

function handleVerificationCommand(context) {
  const { sender, socket, parsed } = context;

  const username = getTargetUsername(parsed);

  if (!username) {
    socket.sendRoomMessage("Use: v@username or unver@username");
    return;
  }

  /*
    السماح فقط لمالك البوت أو أدمن البوت العام.
  */
  if (!canManageVerification(sender)) {
    socket.sendRoomMessage("Only bot owner or bot admin can verify users.");
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
    return;
  }

  socket.sendRoomMessage("Unknown verification command.");
}

module.exports = {
  handleVerificationCommand,
};
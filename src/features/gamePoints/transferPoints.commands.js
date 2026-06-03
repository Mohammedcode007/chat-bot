const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { GamePlayersRepository } = require("../../store/GamePlayersRepository");
const { VerifiedUsersRepository } = require("../../store/VerifiedUsersRepository");
const { BotAdminRepository } = require("../../store/BotAdminRepository");

const gamePlayersRepository = new GamePlayersRepository();
const verifiedUsersRepository = new VerifiedUsersRepository();
const botAdminRepository = new BotAdminRepository();

const ADMIN_DAILY_TRANSFER_LIMIT = 1000000;

const adminDailyTransfers = new Map();

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function isTransferPointsCommand(command) {
  return command === "transfer_points";
}

function isBotOwner(username) {
  return normalizeForCheck(username) === normalizeForCheck(BOT_OWNER_USERNAME);
}

function isBotAdmin(username) {
  const target = normalizeForCheck(username);

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

function canTransferPoints(username) {
  return isBotOwner(username) || isBotAdmin(username);
}

function getTodayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function getAdminTransferKey(username) {
  return `${normalizeForCheck(username)}::${getTodayKey()}`;
}

function getAdminTransferredToday(username) {
  const key = getAdminTransferKey(username);

  return Number(adminDailyTransfers.get(key) || 0);
}

function addAdminTransferredToday(username, amount) {
  const key = getAdminTransferKey(username);
  const current = getAdminTransferredToday(username);

  adminDailyTransfers.set(key, current + Number(amount || 0));

  return current + Number(amount || 0);
}

function parsePoints(value) {
  const points = Number(String(value || "").replace(/,/g, "").trim());

  if (!Number.isFinite(points)) {
    return 0;
  }

  if (points <= 0) {
    return 0;
  }

  return Math.floor(points);
}

function handleTransferPointsCommand(context) {
  const { sender, socket, parsed } = context;

  const targetUsername = String(parsed.args[0] || "").trim();
  const points = parsePoints(parsed.args[1]);

  if (!targetUsername || !points) {
    socket.sendRoomMessage("Use: tr@username@points");
    return;
  }

  if (!canTransferPoints(sender)) {
    socket.sendRoomMessage("Only bot owner or bot admin can transfer points.");
    return;
  }

  /*
    المستلم يجب أن يكون موثقًا بالتوثيق العام v@username.
  */
  if (!verifiedUsersRepository.isVerified(targetUsername)) {
    socket.sendRoomMessage(`User is not verified: ${targetUsername}`);
    return;
  }

  /*
    المالك تحويله مفتوح.
    الأدمن حد أقصى 1,000,000 يوميًا.
  */
  if (!isBotOwner(sender)) {
    const transferredToday = getAdminTransferredToday(sender);
    const remaining = ADMIN_DAILY_TRANSFER_LIMIT - transferredToday;

    if (remaining <= 0) {
      socket.sendRoomMessage(
        [
          "Daily transfer limit reached.",
          `Admin: ${sender}`,
          `Limit: ${ADMIN_DAILY_TRANSFER_LIMIT}`,
          "Try again tomorrow.",
        ].join("\n")
      );
      return;
    }

    if (points > remaining) {
      socket.sendRoomMessage(
        [
          "Transfer exceeds daily admin limit.",
          `Admin: ${sender}`,
          `Requested: ${points}`,
          `Remaining today: ${remaining}`,
          `Daily limit: ${ADMIN_DAILY_TRANSFER_LIMIT}`,
        ].join("\n")
      );
      return;
    }

    addAdminTransferredToday(sender, points);
  }

  const player = gamePlayersRepository.addPoints(targetUsername, points);

  socket.sendRoomMessage(
    [
      "✅ Points transferred",
      `To: ${targetUsername}`,
      `Amount: +${points}`,
      `Balance: ${player.points}`,
      `By: ${sender}`,
    ].join("\n")
  );
}

module.exports = {
  isTransferPointsCommand,
  handleTransferPointsCommand,
};
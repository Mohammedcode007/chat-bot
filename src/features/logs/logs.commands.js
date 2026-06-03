const { normalizeUsername } = require("../../utils/text");
const { VipUsersRepository } = require("../../store/VipUsersRepository");
const { ControlLogsRepository } = require("../../store/ControlLogsRepository");
const {
  isRoomFeatureEnabled,
} = require("../roomSettings/roomSettings.guard");
const {
  createLogSession,
  nextLogPage,
  formatLogPage,
} = require("./logSessions");

const vipUsersRepository = new VipUsersRepository();
const controlLogsRepository = new ControlLogsRepository();

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function isVipAnywhere(username) {
  const target = normalizeForCheck(username);
  const data = vipUsersRepository.getAll();

  return Object.values(data || {}).some((roomVipList) => {
    if (!Array.isArray(roomVipList)) {
      return false;
    }

    return roomVipList.some((item) => {
      return normalizeForCheck(item.username) === target;
    });
  });
}

function isOwnerOrMaster(bot, username) {
  const sender = normalizeUsername(username);

  if (normalizeUsername(bot.owner) === sender) {
    return true;
  }

  return (bot.masters || []).some((master) => {
    return normalizeUsername(master) === sender;
  });
}

function isPrivateMessage(data) {
  const handler = String(data.handler || "").toLowerCase();
  const type = String(data.type || "").toLowerCase();

  /*
    نسمح بها بشكل مرن لأن شكل الخاص قد يختلف.
  */
  if (handler === "chat_message") return true;
  if (handler === "chat_event") return true;
  if (type === "private") return true;
  if (data.to && data.from && data.body) return true;

  return false;
}

function extractPrivateCommand(data) {
  const text = String(
    data.body ||
      data.message ||
      data.text ||
      data.msg ||
      ""
  ).trim();

  const sender = String(
    data.from ||
      data.username ||
      data.sender ||
      data.user ||
      ""
  ).trim();

  return {
    text,
    sender,
  };
}

function handleLogsPrivateCommand({ bot, socket, data }) {
  if (!isPrivateMessage(data)) {
    return false;
  }

  const incoming = extractPrivateCommand(data);

  if (!incoming.text || !incoming.sender) {
    return false;
  }

  const command = incoming.text.toLowerCase();

  if (command !== "logs" && command !== "more") {
    return false;
  }

  /*
    مهم:
    لو logs مقفولة من إعدادات الغرفة، لا تعرض التقارير في الخاص.
    الأمر:
    set@logs@off
  */
  if (!isRoomFeatureEnabled(bot.roomName, "logsEnabled")) {
    socket.sendPrivate(
      incoming.sender,
      "Logs are disabled in this room."
    );
    return true;
  }

  if (!isOwnerOrMaster(bot, incoming.sender)) {
    socket.sendPrivate(incoming.sender, "No permission.");
    return true;
  }

  if (!isVipAnywhere(incoming.sender)) {
    socket.sendPrivate(incoming.sender, "Only VIP masters can view logs.");
    return true;
  }

  if (command === "logs") {
    const logs = controlLogsRepository.getLogsForMaster({
      roomName: bot.roomName,
    });

    const session = createLogSession({
      username: incoming.sender,
      logs,
    });

    socket.sendPrivate(incoming.sender, formatLogPage(session));
    return true;
  }

  if (command === "more") {
    const result = nextLogPage(incoming.sender);

    if (!result.ok) {
      if (result.reason === "expired") {
        socket.sendPrivate(
          incoming.sender,
          "Logs session expired. Send logs again."
        );
        return true;
      }

      if (result.reason === "last_page") {
        socket.sendPrivate(incoming.sender, "No more logs.");
        return true;
      }

      socket.sendPrivate(incoming.sender, "No active logs session.");
      return true;
    }

    socket.sendPrivate(incoming.sender, formatLogPage(result.session));
    return true;
  }

  return false;
}

module.exports = {
  handleLogsPrivateCommand,
};
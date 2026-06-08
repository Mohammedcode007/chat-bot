const { AutoPunishUsersRepository } = require("../../store/AutoPunishUsersRepository");
const { requirePermission } = require("../../commands/controllerCommands");

const autoPunishUsersRepository = new AutoPunishUsersRepository();

function isAutoPunishCommand(command) {
  return [
    "auto_ban_add",
    "auto_ban_remove",
    "auto_ban_list",
    "auto_kick_add",
    "auto_kick_remove",
    "auto_kick_list",
  ].includes(command);
}

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function formatList(title, list) {
  if (!list.length) {
    return `${title}\n\nEmpty.`;
  }

  const lines = list.slice(0, 30).map((item, index) => {
    return `${index + 1}. ${item.username}`;
  });

  return [
    title,
    `Total: ${list.length}`,
    "",
    ...lines,
    list.length > 30 ? "" : "",
    list.length > 30 ? `Showing first 30 only.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function handleAutoPunishCommand(context) {
  const { bot, sender, socket, parsed } = context;

  /*
    الإضافة والحذف والعرض للمالك والماستر فقط.
  */
  if (!requirePermission(context)) {
    return true;
  }

  if (parsed.command === "auto_ban_add") {
    const username = getTargetUsername(parsed);

    if (!username) {
      socket.sendRoomMessage("Use: ab@username");
      return true;
    }

    const result = autoPunishUsersRepository.addAutoBan(
      bot.roomName,
      username,
      sender
    );

    if (result.alreadyExists) {
      socket.sendRoomMessage(`Already in auto ban: ${username}`);
      return true;
    }

    /*
      يحظره فورًا لو دالة الحظر موجودة.
    */
    if (typeof socket.sendRoomBan === "function") {
      socket.sendRoomBan(username, bot.roomName);
    }

    socket.sendRoomMessage(`✅ Auto ban added: ${username}`);
    return true;
  }

  if (parsed.command === "auto_ban_remove") {
    const username = getTargetUsername(parsed);

    if (!username) {
      socket.sendRoomMessage("Use: rab@username");
      return true;
    }

    const removed = autoPunishUsersRepository.removeAutoBan(
      bot.roomName,
      username
    );

    if (!removed) {
      socket.sendRoomMessage(`Not in auto ban: ${username}`);
      return true;
    }

    socket.sendRoomMessage(`✅ Auto ban removed: ${username}`);
    return true;
  }

  if (parsed.command === "auto_ban_list") {
    const list = autoPunishUsersRepository.listAutoBan(bot.roomName);

    socket.sendRoomMessage(formatList("🚫 Auto ban list", list));
    return true;
  }

  if (parsed.command === "auto_kick_add") {
    const username = getTargetUsername(parsed);

    if (!username) {
      socket.sendRoomMessage("Use: ak@username");
      return true;
    }

    const result = autoPunishUsersRepository.addAutoKick(
      bot.roomName,
      username,
      sender
    );

    if (result.alreadyExists) {
      socket.sendRoomMessage(`Already in auto kick: ${username}`);
      return true;
    }

    /*
      يطرده فورًا لو دالة الطرد موجودة.
    */
    if (typeof socket.sendRoomKick === "function") {
      socket.sendRoomKick(username, bot.roomName);
    }

    socket.sendRoomMessage(`✅ Auto kick added: ${username}`);
    return true;
  }

  if (parsed.command === "auto_kick_remove") {
    const username = getTargetUsername(parsed);

    if (!username) {
      socket.sendRoomMessage("Use: rak@username");
      return true;
    }

    const removed = autoPunishUsersRepository.removeAutoKick(
      bot.roomName,
      username
    );

    if (!removed) {
      socket.sendRoomMessage(`Not in auto kick: ${username}`);
      return true;
    }

    socket.sendRoomMessage(`✅ Auto kick removed: ${username}`);
    return true;
  }

  if (parsed.command === "auto_kick_list") {
    const list = autoPunishUsersRepository.listAutoKick(bot.roomName);

    socket.sendRoomMessage(formatList("👢 Auto kick list", list));
    return true;
  }

  return false;
}

module.exports = {
  isAutoPunishCommand,
  handleAutoPunishCommand,
};
const { RoomSettingsRepository } = require("../../store/RoomSettingsRepository");

const roomSettingsRepository = new RoomSettingsRepository();

const SETTING_KEYS = {
  music: "musicEnabled",
  lookup: "lookupEnabled",
  profile: "profileEnabled",
  watch: "watchEnabled",
  invite: "inviteEnabled",
  logs: "logsEnabled",
  welcome: "welcomeEnabled",
  vipprotect: "vipProtectionEnabled",
  autoban_none: "autoBanRoleNoneEnabled",
  autobanrole: "autoBanRoleNoneEnabled",
  antispam: "antiSpamEnabled",
  badwords: "badWordsEnabled",
  links: "linksEnabled",
};

function isRoomSettingsCommand(command) {
  return [
    "room_settings_show",
    "room_setting_set",
    "room_badword_add",
    "room_badword_remove",
    "room_badword_list",
    "room_welcome_text",
  ].includes(command);
}

function parseBooleanValue(value) {
  const clean = String(value || "").trim().toLowerCase();

  if (["on", "true", "1", "yes", "open", "enable", "enabled"].includes(clean)) {
    return true;
  }

  if (["off", "false", "0", "no", "close", "disable", "disabled"].includes(clean)) {
    return false;
  }

  return null;
}

function formatOnOff(value) {
  return value ? "on" : "off";
}

function formatRoomSettings(roomName, settings) {
  return [
    "Room settings",
    `Room: ${roomName}`,
    "",
    `Music: ${formatOnOff(settings.musicEnabled)}`,
    `Lookup: ${formatOnOff(settings.lookupEnabled)}`,
    `Profile: ${formatOnOff(settings.profileEnabled)}`,
    `Watch: ${formatOnOff(settings.watchEnabled)}`,
    `Invite: ${formatOnOff(settings.inviteEnabled)}`,
    `Logs: ${formatOnOff(settings.logsEnabled)}`,
    "",
    `Welcome: ${formatOnOff(settings.welcomeEnabled)}`,
    `Welcome text: ${settings.welcomeText || "-"}`,
    "",
    `VIP Protect: ${formatOnOff(settings.vipProtectionEnabled)}`,
    `Auto ban role none: ${formatOnOff(settings.autoBanRoleNoneEnabled)}`,
    "",
    `Anti spam: ${formatOnOff(settings.antiSpamEnabled)}`,
    `Max messages / 10s: ${settings.maxMessagesPer10Seconds}`,
    `Repeat limit: ${settings.repeatedMessageLimit}`,
    "",
    `Bad words: ${formatOnOff(settings.badWordsEnabled)}`,
    `Bad words mode: ${settings.badWordsMode}`,
    `Bad words count: ${(settings.badWords || []).length}`,
    "",
    `Links: ${formatOnOff(settings.linksEnabled)}`,
    "",
    "Commands:",
    "set@music@on/off",
    "set@lookup@on/off",
    "set@profile@on/off",
    "set@watch@on/off",
    "set@invite@on/off",
    "set@logs@on/off",
    "set@welcome@on/off",
    "set@vipprotect@on/off",
    "set@autoban_none@on/off",
    "set@antispam@on/off",
    "set@badwords@on/off",
    "set@links@on/off",
    "welcome@message",
    "bad@word",
    "rbad@word",
    "badlist",
  ].join("\n");
}

function handleShowSettings(context) {
  const { bot, socket } = context;

  const settings = roomSettingsRepository.getRoomSettings(bot.roomName);

  socket.sendRoomMessage(formatRoomSettings(bot.roomName, settings));
}

function handleSetSetting(context) {
  const { bot, socket, parsed } = context;

  const keyRaw = String(parsed.args[0] || "").trim().toLowerCase();
  const valueRaw = String(parsed.args[1] || "").trim();

  if (!keyRaw || !valueRaw) {
    socket.sendRoomMessage("Use: set@setting@on/off");
    return;
  }

  const realKey = SETTING_KEYS[keyRaw];

  if (!realKey) {
    socket.sendRoomMessage(`Unknown setting: ${keyRaw}`);
    return;
  }

  const booleanValue = parseBooleanValue(valueRaw);

  if (booleanValue === null) {
    socket.sendRoomMessage("Value must be: on/off");
    return;
  }

  roomSettingsRepository.setValue(bot.roomName, realKey, booleanValue);

  socket.sendRoomMessage(`Setting updated: ${keyRaw} = ${formatOnOff(booleanValue)}`);
}

function handleWelcomeText(context) {
  const { bot, socket, parsed } = context;

  const text = String(parsed.args[0] || "").trim();

  if (!text) {
    socket.sendRoomMessage("Use: welcome@message");
    return;
  }

  roomSettingsRepository.setValue(bot.roomName, "welcomeText", text);

  socket.sendRoomMessage("Welcome text updated.");
}

function handleBadWordAdd(context) {
  const { bot, socket, parsed } = context;

  const word = String(parsed.args[0] || "").trim();

  if (!word) {
    socket.sendRoomMessage("Use: bad@word");
    return;
  }

  const result = roomSettingsRepository.addBadWord(bot.roomName, word);

  if (result.alreadyExists) {
    socket.sendRoomMessage(`Bad word already exists: ${word}`);
    return;
  }

  socket.sendRoomMessage(`Bad word added: ${word}`);
}

function handleBadWordRemove(context) {
  const { bot, socket, parsed } = context;

  const word = String(parsed.args[0] || "").trim();

  if (!word) {
    socket.sendRoomMessage("Use: rbad@word");
    return;
  }

  const result = roomSettingsRepository.removeBadWord(bot.roomName, word);

  if (!result.removed) {
    socket.sendRoomMessage(`Bad word not found: ${word}`);
    return;
  }

  socket.sendRoomMessage(`Bad word removed: ${word}`);
}

function handleBadWordList(context) {
  const { bot, socket } = context;

  const settings = roomSettingsRepository.getRoomSettings(bot.roomName);
  const words = settings.badWords || [];

  if (!words.length) {
    socket.sendRoomMessage("Bad words list is empty.");
    return;
  }

  socket.sendRoomMessage(["Bad words:", "", ...words.map((w, i) => `${i + 1}. ${w}`)].join("\n"));
}

function handleRoomSettingsCommand(context) {
  const command = context.parsed.command;

  if (command === "room_settings_show") {
    handleShowSettings(context);
    return;
  }

  if (command === "room_setting_set") {
    handleSetSetting(context);
    return;
  }

  if (command === "room_welcome_text") {
    handleWelcomeText(context);
    return;
  }

  if (command === "room_badword_add") {
    handleBadWordAdd(context);
    return;
  }

  if (command === "room_badword_remove") {
    handleBadWordRemove(context);
    return;
  }

  if (command === "room_badword_list") {
    handleBadWordList(context);
    return;
  }

  context.socket.sendRoomMessage("Unknown settings command.");
}

module.exports = {
  isRoomSettingsCommand,
  handleRoomSettingsCommand,
};
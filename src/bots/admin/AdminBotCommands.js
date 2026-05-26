const { MusicRoomsRepository } = require("../../store/MusicRoomsRepository");

function sendAdminHelp(socket, sender) {
  socket.sendPrivate(
    sender,
    [
      "📘 te-bot commands:",
      "",
      "1) Add controller:",
      "username@password@room",
      "",
      "2) Add silent:",
      "bot@username@password@room",
      "",
      "3) Disconnect controller:",
      "del@room",
      "",
      "4) Disconnect silent:",
      "delbot@username@room",
      "",
      "5) Join music bot:",
      "join@room",
      "",
      "Only owner/master can disconnect.",
    ].join("\n")
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isControllerOwnerOrMaster(bot, sender) {
  if (!bot) return false;

  const cleanSender = normalizeName(sender);

  if (normalizeName(bot.owner) === cleanSender) {
    return true;
  }

  return (bot.masters || []).some(
    (master) => normalizeName(master) === cleanSender
  );
}

function isSilentOwnerOrRoomMaster({ silentBot, controllerBot, sender }) {
  const cleanSender = normalizeName(sender);

  if (silentBot && normalizeName(silentBot.owner) === cleanSender) {
    return true;
  }

  if (controllerBot && isControllerOwnerOrMaster(controllerBot, sender)) {
    return true;
  }

  return false;
}

/* =====================================================
   Music Bot Join
   join@room
===================================================== */

function parseJoinMusicRoomCommand(text) {
  const cleanText = String(text || "").trim();

  if (!cleanText.toLowerCase().startsWith("join@")) {
    return null;
  }

  const roomName = cleanText.slice(5).trim();

  if (!roomName) {
    return null;
  }

  return {
    roomName,
  };
}

function handleJoinMusicRoom({ sender, text, socket, runtime }) {
  const parsed = parseJoinMusicRoomCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: join@room");
    return;
  }

  const musicRoomsRepository = new MusicRoomsRepository();

  try {
    const result = musicRoomsRepository.addRoom(parsed.roomName, sender);

    if (runtime && typeof runtime.connectMusicBot === "function") {
      runtime.connectMusicBot(parsed.roomName);
    }

    if (result.alreadyExists) {
      socket.sendPrivate(
        sender,
        `⚠️ Music bot already in room:\n${parsed.roomName}`
      );
      return;
    }

    socket.sendPrivate(
      sender,
      `✅ Music bot joined:\n${parsed.roomName}`
    );
  } catch (err) {
    socket.sendPrivate(sender, `❌ ${err.message}`);
  }
}

/* =====================================================
   Controller Bot
   username@password@room
===================================================== */

function parseControllerBotCommand(text) {
  const parts = String(text || "")
    .split("@")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    return null;
  }

  const first = parts[0].toLowerCase();

  if (first === "bot") return null;
  if (first === "del") return null;
  if (first === "delbot") return null;
  if (first === "join") return null;

  return {
    username: parts[0],
    password: parts[1],
    roomName: parts[2],
  };
}

/* =====================================================
   Silent Bot
   bot@username@password@room
===================================================== */

function parseSilentBotCommand(text) {
  const parts = String(text || "")
    .split("@")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return null;
  }

  if (parts[0].toLowerCase() !== "bot") {
    return null;
  }

  return {
    username: parts[1],
    password: parts[2],
    roomName: parts[3],
  };
}

/* =====================================================
   Delete Controller
   del@room
===================================================== */

function parseDeleteControllerCommand(text) {
  const cleanText = String(text || "").trim();

  if (!cleanText.toLowerCase().startsWith("del@")) {
    return null;
  }

  const roomName = cleanText.slice(4).trim();

  if (!roomName) {
    return null;
  }

  return {
    roomName,
  };
}

/* =====================================================
   Delete Silent
   delbot@username@room
===================================================== */

function parseDeleteSilentBotCommand(text) {
  const parts = String(text || "")
    .split("@")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    return null;
  }

  if (parts[0].toLowerCase() !== "delbot") {
    return null;
  }

  return {
    username: parts[1],
    roomName: parts[2],
  };
}

function createControllerBot({ username, password, roomName, owner }) {
  return {
    type: "controller",
    username,
    password,
    roomName,
    owner,
    masters: [],
    profile: {
      title: "Controller Bot",
      status: "ready",
    },
    settings: {
      commandsEnabled: true,
    },
    createdAt: new Date().toISOString(),
  };
}

function createSilentBot({ username, password, roomName, owner }) {
  return {
    type: "silent",
    username,
    password,
    roomName,
    owner,
    profile: {
      title: "Silent Bot",
      status: "connected silently",
    },
    settings: {
      enabled: true,
    },
    createdAt: new Date().toISOString(),
  };
}

function handleAddControllerBot({ sender, text, socket, repository, runtime }) {
  const parsed = parseControllerBotCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: username@password@room");
    return;
  }

  const { username, password, roomName } = parsed;

  const controllerBot = createControllerBot({
    username,
    password,
    roomName,
    owner: sender,
  });

  try {
    repository.addControllerBot(controllerBot);
    runtime.connectControllerBot(controllerBot);

    socket.sendPrivate(
      sender,
      `✅ Controller added\nUser: ${username}\nRoom: ${roomName}`
    );
  } catch (err) {
    socket.sendPrivate(sender, `❌ ${err.message}`);
  }
}

function handleAddSilentBot({ sender, text, socket, repository, runtime }) {
  const parsed = parseSilentBotCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: bot@username@password@room");
    return;
  }

  const { username, password, roomName } = parsed;

  const silentBot = createSilentBot({
    username,
    password,
    roomName,
    owner: sender,
  });

  try {
    repository.addSilentBot(silentBot);
    runtime.connectSilentBot(silentBot);

    socket.sendPrivate(
      sender,
      `✅ Silent added\nUser: ${username}\nRoom: ${roomName}`
    );
  } catch (err) {
    socket.sendPrivate(sender, `❌ ${err.message}`);
  }
}

function handleDeleteControllerBot({
  sender,
  text,
  socket,
  repository,
  runtime,
}) {
  const parsed = parseDeleteControllerCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: del@room");
    return;
  }

  const { roomName } = parsed;

  const controllerBot = repository.getControllerBotByRoom(roomName);

  if (!controllerBot) {
    socket.sendPrivate(sender, "⚠️ No controller bot found for this room.");
    return;
  }

  if (!isControllerOwnerOrMaster(controllerBot, sender)) {
    socket.sendPrivate(sender, "🚫 Only owner/master can disconnect this bot.");
    return;
  }

  const stopped = runtime.disconnectControllerBot(
    controllerBot.roomName,
    controllerBot.username
  );

  repository.removeControllerBot(controllerBot.roomName);

  socket.sendPrivate(
    sender,
    [
      "✅ Controller disconnected",
      `User: ${controllerBot.username}`,
      `Room: ${controllerBot.roomName}`,
      `Socket stopped: ${stopped ? "yes" : "not found"}`,
    ].join("\n")
  );
}

function handleDeleteSilentBot({
  sender,
  text,
  socket,
  repository,
  runtime,
}) {
  const parsed = parseDeleteSilentBotCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: delbot@username@room");
    return;
  }

  const { username, roomName } = parsed;

  const silentBot = repository.getSilentBotByRoomAndUsername(roomName, username);

  if (!silentBot) {
    socket.sendPrivate(sender, "⚠️ Silent bot not found.");
    return;
  }

  const controllerBot = repository.getControllerBotByRoom(roomName);

  const allowed = isSilentOwnerOrRoomMaster({
    silentBot,
    controllerBot,
    sender,
  });

  if (!allowed) {
    socket.sendPrivate(
      sender,
      "🚫 Only silent owner or room owner/master can disconnect this bot."
    );
    return;
  }

  const stopped = runtime.disconnectSilentBot(
    silentBot.roomName,
    silentBot.username
  );

  repository.removeSilentBot(silentBot.roomName, silentBot.username);

  socket.sendPrivate(
    sender,
    [
      "✅ Silent disconnected",
      `User: ${silentBot.username}`,
      `Room: ${silentBot.roomName}`,
      `Socket stopped: ${stopped ? "yes" : "not found"}`,
    ].join("\n")
  );
}

function handleAdminCommand({ sender, text, socket, repository, runtime }) {
  const cleanText = String(text || "").trim();
  const lowerText = cleanText.toLowerCase();

  if (!cleanText) {
    return;
  }

  if (lowerText === "help") {
    sendAdminHelp(socket, sender);
    return;
  }

  /*
    مهم:
    join@room لازم يكون قبل parseControllerBotCommand
    حتى لا يتم تفسيره كبوت تحكم.
  */
  if (lowerText.startsWith("join@")) {
    handleJoinMusicRoom({
      sender,
      text: cleanText,
      socket,
      runtime,
    });
    return;
  }

  if (lowerText.startsWith("delbot@")) {
    handleDeleteSilentBot({
      sender,
      text: cleanText,
      socket,
      repository,
      runtime,
    });
    return;
  }

  if (lowerText.startsWith("del@")) {
    handleDeleteControllerBot({
      sender,
      text: cleanText,
      socket,
      repository,
      runtime,
    });
    return;
  }

  if (lowerText.startsWith("bot@")) {
    handleAddSilentBot({
      sender,
      text: cleanText,
      socket,
      repository,
      runtime,
    });
    return;
  }

  const controllerCommand = parseControllerBotCommand(cleanText);

  if (controllerCommand) {
    handleAddControllerBot({
      sender,
      text: cleanText,
      socket,
      repository,
      runtime,
    });
    return;
  }

  socket.sendPrivate(sender, "❌ Unknown command. Send: help");
}

module.exports = {
  handleAdminCommand,
  sendAdminHelp,

  parseJoinMusicRoomCommand,
  handleJoinMusicRoom,

  parseControllerBotCommand,
  parseSilentBotCommand,
  parseDeleteControllerCommand,
  parseDeleteSilentBotCommand,

  createControllerBot,
  createSilentBot,

  handleAddControllerBot,
  handleAddSilentBot,
  handleDeleteControllerBot,
  handleDeleteSilentBot,
};
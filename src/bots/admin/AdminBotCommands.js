const { MusicRoomsRepository } = require("../../store/MusicRoomsRepository");
const { SocketClient } = require("../../core/SocketClient");

const {
  MUSIC_BOT_USERNAME,
  MUSIC_BOT_PASSWORD,
} = require("../../config/env");
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
function safeCloseTestSocket(testSocket) {
  try {
    if (testSocket && typeof testSocket.close === "function") {
      testSocket.close();
    }
  } catch {}
}

function getLoginFailReason(data) {
  const msg = String(
    data?.message ||
      data?.error ||
      data?.reason ||
      data?.type ||
      "login_failed"
  ).trim();

  const lower = msg.toLowerCase();

  if (
    lower.includes("password") ||
    lower.includes("invalid") ||
    lower.includes("wrong") ||
    lower.includes("unauthorized") ||
    lower.includes("login")
  ) {
    return "اسم المستخدم أو كلمة السر غير صحيحة.";
  }

  return `فشل تسجيل الدخول: ${msg}`;
}

function getRoomRejectReason(data) {
  const type = String(data?.type || data?.reason || data?.message || "").trim();
  const lower = type.toLowerCase();

  if (lower === "room_banned" || lower === "banned") {
    return "البوت محظور من هذه الغرفة.";
  }

  if (lower === "room_unauthorized") {
    return "البوت غير مصرح له بدخول هذه الغرفة.";
  }

  if (lower === "room_membership_required") {
    return "هذه الغرفة تتطلب عضوية أو صلاحية دخول.";
  }

  if (lower === "blocked" || lower === "outcast") {
    return "البوت مرفوض أو محظور داخل الغرفة.";
  }

  if (type) {
    return `تم رفض دخول الغرفة: ${type}`;
  }

  return "تم رفض دخول الغرفة لسبب غير معروف.";
}

function isJoinSuccessEvent(data, roomName) {
  if (!data || data.handler !== "room_event") {
    return false;
  }

  const type = String(data.type || "").trim().toLowerCase();

  if (type !== "you_joined") {
    return false;
  }

  const eventRoom = String(data.name || data.room || data.roomName || "").trim();

  if (!eventRoom) {
    return true;
  }

  return eventRoom.toLowerCase() === String(roomName || "").trim().toLowerCase();
}

function isRoomRejectEventLocal(data) {
  if (!data || data.handler !== "room_event") {
    return false;
  }

  const type = String(data.type || "").trim().toLowerCase();

  return [
    "room_unauthorized",
    "room_membership_required",
    "room_banned",
    "banned",
    "blocked",
    "outcast",
  ].includes(type);
}

function validateBotCanJoinRoom({
  username,
  password,
  roomName,
  type = "test",
  timeoutMs = 15000,
}) {
  return new Promise((resolve) => {
    let settled = false;
    let loginOk = false;
    let joinSent = false;

    const testSocket = new SocketClient({
      username,
      password,
      roomName,
      type: `validate_${type}`,
    });

    function finish(result) {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      safeCloseTestSocket(testSocket);

      resolve(result);
    }

    const timer = setTimeout(() => {
      if (!loginOk) {
        finish({
          ok: false,
          reason: "انتهت مهلة الاتصال قبل تسجيل الدخول. قد يكون السيرفر لا يستجيب.",
        });
        return;
      }

      if (!joinSent) {
        finish({
          ok: false,
          reason: "تم تسجيل الدخول لكن لم يتم إرسال أمر دخول الغرفة.",
        });
        return;
      }

      finish({
        ok: false,
        reason: "انتهت مهلة دخول الغرفة. قد تكون الغرفة غير موجودة أو السيرفر لم يرد.",
      });
    }, timeoutMs);

    testSocket.onOpen(() => {
      console.log("🧪 [BOT_VALIDATE_SOCKET_OPEN]", {
        username,
        roomName,
        type,
      });
    });

    testSocket.onMessage((data) => {
      if (settled) return;

      if (data?.handler === "login_event" && data?.type === "success") {
        loginOk = true;

        console.log("🧪 [BOT_VALIDATE_LOGIN_OK]", {
          username,
          roomName,
          type,
        });

        setTimeout(() => {
          if (settled) return;

          joinSent = true;
          testSocket.joinRoom(roomName);
        }, 500);

        return;
      }

      if (data?.handler === "login_event" && data?.type !== "success") {
        finish({
          ok: false,
          reason: getLoginFailReason(data),
          data,
        });
        return;
      }

      if (isRoomRejectEventLocal(data)) {
        finish({
          ok: false,
          reason: getRoomRejectReason(data),
          data,
        });
        return;
      }

      if (isJoinSuccessEvent(data, roomName)) {
        finish({
          ok: true,
          reason: "joined",
          data,
        });
        return;
      }

      if (
        data?.handler === "error" ||
        data?.type === "error" ||
        data?.error ||
        data?.message === "unauthorized"
      ) {
        finish({
          ok: false,
          reason: String(data.error || data.message || data.type || "server_error"),
          data,
        });
      }
    });

    testSocket.onError((error) => {
      finish({
        ok: false,
        reason: `فشل اتصال WebSocket: ${error.message}`,
      });
    });

    testSocket.onClose((code, reason) => {
      if (settled) return;

      finish({
        ok: false,
        reason: `تم إغلاق الاتصال قبل نجاح الدخول. code=${code} reason=${String(
          reason || ""
        )}`,
      });
    });

    try {
      testSocket.connect();
    } catch (err) {
      finish({
        ok: false,
        reason: `فشل بدء الاتصال: ${err.message}`,
      });
    }
  });
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

async function handleJoinMusicRoom({ sender, text, socket, runtime }) {
  const parsed = parseJoinMusicRoomCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: join@room");
    return;
  }

  const roomName = parsed.roomName;

  if (!MUSIC_BOT_USERNAME || !MUSIC_BOT_PASSWORD) {
    socket.sendPrivate(
      sender,
      "❌ Music bot credentials are missing in .env"
    );
    return;
  }

  const musicRoomsRepository = new MusicRoomsRepository();

  try {
    const rooms =
      typeof musicRoomsRepository.getRooms === "function"
        ? musicRoomsRepository.getRooms()
        : [];

    const alreadyExists = rooms.some((item) => {
      const savedRoom = typeof item === "string" ? item : item.roomName;
      return (
        String(savedRoom || "").trim().toLowerCase() ===
        String(roomName || "").trim().toLowerCase()
      );
    });

    if (alreadyExists) {
      socket.sendPrivate(sender, `⚠️ Music bot already in room:\n${roomName}`);
      return;
    }

    socket.sendPrivate(
      sender,
      `⏳ Testing music bot connection...\nRoom: ${roomName}`
    );

    const testResult = await validateBotCanJoinRoom({
      username: MUSIC_BOT_USERNAME,
      password: MUSIC_BOT_PASSWORD,
      roomName,
      type: "music",
      timeoutMs: 15000,
    });

    if (!testResult.ok) {
      socket.sendPrivate(
        sender,
        [
          "❌ Music bot was not added.",
          `Room: ${roomName}`,
          `Reason: ${testResult.reason}`,
        ].join("\n")
      );
      return;
    }

    const result = musicRoomsRepository.addRoom(roomName, sender);

    if (runtime && typeof runtime.connectMusicBot === "function") {
      runtime.connectMusicBot(roomName);
    }

    if (result.alreadyExists) {
      socket.sendPrivate(sender, `⚠️ Music bot already in room:\n${roomName}`);
      return;
    }

    socket.sendPrivate(sender, `✅ Music bot joined and saved:\n${roomName}`);
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

async function handleAddControllerBot({
  sender,
  text,
  socket,
  repository,
  runtime,
}) {
  const parsed = parseControllerBotCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: username@password@room");
    return;
  }

  const { username, password, roomName } = parsed;

  try {
    const exists =
      typeof repository.getControllerBotByRoom === "function"
        ? repository.getControllerBotByRoom(roomName)
        : null;

    if (exists) {
      socket.sendPrivate(
        sender,
        [
          "⚠️ Controller already exists for this room.",
          `User: ${exists.username}`,
          `Room: ${exists.roomName}`,
        ].join("\n")
      );
      return;
    }

    socket.sendPrivate(
      sender,
      [
        "⏳ Testing controller bot connection...",
        `User: ${username}`,
        `Room: ${roomName}`,
      ].join("\n")
    );

    const testResult = await validateBotCanJoinRoom({
      username,
      password,
      roomName,
      type: "controller",
      timeoutMs: 15000,
    });

    if (!testResult.ok) {
      socket.sendPrivate(
        sender,
        [
          "❌ Controller was not added.",
          `User: ${username}`,
          `Room: ${roomName}`,
          `Reason: ${testResult.reason}`,
        ].join("\n")
      );
      return;
    }

    const controllerBot = createControllerBot({
      username,
      password,
      roomName,
      owner: sender,
    });

    repository.addControllerBot(controllerBot);

    if (runtime && typeof runtime.connectControllerBot === "function") {
      runtime.connectControllerBot(controllerBot);
    }

    socket.sendPrivate(
      sender,
      [
        "✅ Controller added and saved.",
        `User: ${username}`,
        `Room: ${roomName}`,
      ].join("\n")
    );
  } catch (err) {
    socket.sendPrivate(sender, `❌ ${err.message}`);
  }
}

async function handleAddSilentBot({
  sender,
  text,
  socket,
  repository,
  runtime,
}) {
  const parsed = parseSilentBotCommand(text);

  if (!parsed) {
    socket.sendPrivate(sender, "❌ Use: bot@username@password@room");
    return;
  }

  const { username, password, roomName } = parsed;

  try {
    const exists =
      typeof repository.getSilentBotByRoomAndUsername === "function"
        ? repository.getSilentBotByRoomAndUsername(roomName, username)
        : null;

    if (exists) {
      socket.sendPrivate(
        sender,
        [
          "⚠️ Silent bot already exists.",
          `User: ${exists.username}`,
          `Room: ${exists.roomName}`,
        ].join("\n")
      );
      return;
    }

    socket.sendPrivate(
      sender,
      [
        "⏳ Testing silent bot connection...",
        `User: ${username}`,
        `Room: ${roomName}`,
      ].join("\n")
    );

    const testResult = await validateBotCanJoinRoom({
      username,
      password,
      roomName,
      type: "silent",
      timeoutMs: 15000,
    });

    if (!testResult.ok) {
      socket.sendPrivate(
        sender,
        [
          "❌ Silent bot was not added.",
          `User: ${username}`,
          `Room: ${roomName}`,
          `Reason: ${testResult.reason}`,
        ].join("\n")
      );
      return;
    }

    const silentBot = createSilentBot({
      username,
      password,
      roomName,
      owner: sender,
    });

    repository.addSilentBot(silentBot);

    if (runtime && typeof runtime.connectSilentBot === "function") {
      runtime.connectSilentBot(silentBot);
    }

    socket.sendPrivate(
      sender,
      [
        "✅ Silent bot added and saved.",
        `User: ${username}`,
        `Room: ${roomName}`,
      ].join("\n")
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
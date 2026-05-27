const { SongLikesRepository } = require("../../store/SongLikesRepository");
const { buildMusicReply } = require("./musicReply.service");

const songLikesRepository = new SongLikesRepository();

function getSenderName(sender) {
  if (!sender) return "unknown";

  if (typeof sender === "string") {
    return sender;
  }

  return (
    sender.username ||
    sender.name ||
    sender.userName ||
    sender.from ||
    sender.id ||
    "unknown"
  );
}

function isMusicCommand(command) {
  return [
    "play_song",
    "song_broadcast",
    "song_here",
    "song_private",
    "like_song",
    "comment_song",
    "song_likes",
  ].includes(command);
}

function getSongUrlFromResult(result) {
  if (!result) return "";

  const directUrl =
    result.publicUrl ||
    result.audioUrl ||
    result.mp3Url ||
    result.url ||
    result.songUrl ||
    "";

  if (directUrl) return String(directUrl).trim();

  const meta = result.meta || {};

  const metaUrl =
    meta.publicUrl ||
    meta.audioUrl ||
    meta.mp3Url ||
    meta.url ||
    meta.songUrl ||
    "";

  if (metaUrl) return String(metaUrl).trim();

  try {
    const fullText = JSON.stringify(result);

    const match = fullText.match(
      /https?:\/\/[^\s"'\\]+\/uploads\/audio-temp\/[^\s"'\\]+\.mp3/i
    );

    if (match && match[0]) {
      return match[0].trim();
    }
  } catch {}

  return "";
}

function formatSongDetails(song) {
  return [
    "🎵 Song ready",
    "",
    song.songName,
    "",
    `${song.requestedBy}@${song.roomName}`,
    "",
    song.url || "",
    "",
    `like@${song.id}`,
    "",
    `com@${song.id}@msg`,
  ]
    .filter((v) => v !== null && v !== undefined)
    .join("\n");
}

function sendRoomTextSafe(socket, text) {
  if (!socket || !text) return false;

  if (typeof socket.sendRoomMessage === "function") {
    socket.sendRoomMessage(text);
    return true;
  }

  if (typeof socket.send === "function") {
    socket.send(
      JSON.stringify({
        handler: "chat_message",
        id: Date.now().toString(),
        body: text,
        type: "text",
      })
    );
    return true;
  }

  return false;
}

function sendRoomAudioSafe(socket, url) {
  if (!socket || !url) return false;

  /*
    الحالة الأولى:
    socket نفسه فيه دالة إرسال الصوت
  */
  if (typeof socket.sendRoomAudioUrl === "function") {
    socket.sendRoomAudioUrl(url);
    return true;
  }

  /*
    الحالة الثانية:
    أحيانًا target.socket يكون MusicBot أو ControllerBot instance
    والـ socket الحقيقي داخله.
  */
  if (socket.socket && typeof socket.socket.sendRoomAudioUrl === "function") {
    socket.socket.sendRoomAudioUrl(url);
    return true;
  }

  if (socket.client && typeof socket.client.sendRoomAudioUrl === "function") {
    socket.client.sendRoomAudioUrl(url);
    return true;
  }

  if (socket.ws && typeof socket.ws.sendRoomAudioUrl === "function") {
    socket.ws.sendRoomAudioUrl(url);
    return true;
  }

  /*
    مهم:
    لا ترسل الرابط كنص نهائيًا.
    لو وصلنا هنا، فهذا يعني أن البوت الذي يرسل لا يملك دالة sendRoomAudioUrl.
  */
  console.log("❌ [AUDIO_SEND_FAILED] sendRoomAudioUrl not found", {
    url,
    socketKeys: socket ? Object.keys(socket) : [],
    innerSocketKeys: socket && socket.socket ? Object.keys(socket.socket) : [],
    clientKeys: socket && socket.client ? Object.keys(socket.client) : [],
    wsKeys: socket && socket.ws ? Object.keys(socket.ws) : [],
  });

  return false;
}

function sendPrivateSafe(socket, to, text) {
  if (!to) {
    console.log("⚠️ [MUSIC_PRIVATE] missing target");
    return false;
  }

  if (!text) {
    console.log("⚠️ [MUSIC_PRIVATE] missing text");
    return false;
  }

  if (!socket || typeof socket.sendPrivate !== "function") {
    console.log("❌ [MUSIC_PRIVATE] sendPrivate not available", {
      to,
      socketKeys: socket ? Object.keys(socket) : [],
    });
    return false;
  }

  console.log("📩 [MUSIC_PRIVATE_SEND]", {
    to,
    body: text,
  });

  const sent = socket.sendPrivate(to, text);

  console.log("📩 [MUSIC_PRIVATE_RESULT]", {
    to,
    sent,
  });

  return sent;
}

/*
  استخراج اسم الغرفة من مفتاح music.
  المفتاح عندك في BotRuntime يكون:
  music:roomName
*/
function getMusicRoomFromKey(key) {
  return String(key || "")
    .replace(/^music:/i, "")
    .trim();
}

/*
  استخراج اسم الغرفة من مفتاح controller.
  المفتاح غالبًا يكون:
  controller:roomName:username

  ولو ConnectionRegistry عندك يستخدم فاصل مختلف، عدّل هذه الدالة فقط.
*/
function getControllerRoomFromKey(key) {
  const raw = String(key || "").trim();

  if (!raw) return "";

  const parts = raw.split(":");

  if (parts.length >= 2) {
    return String(parts[1] || "").trim();
  }

  return "";
}

function normalizeRoomName(roomName) {
  return String(roomName || "").trim().toLowerCase();
}

function isMusicKey(key) {
  return String(key || "").toLowerCase().startsWith("music:");
}

function isControllerKey(key) {
  const value = String(key || "").toLowerCase();

  return (
    value.startsWith("controller:") ||
    value.startsWith("control:") ||
    value.startsWith("bot_controller:")
  );
}

/*
  هذه أهم دالة في الملف.

  المطلوب:
  - ترسل في كل الغرف.
  - لو يوجد MusicBot في الغرفة، يرسل هو.
  - لو لا يوجد MusicBot، يرسل ControllerBot.
  - تمنع التكرار في نفس الغرفة.
*/
function getBroadcastTargets(runtime, currentContext = {}) {
  const targetsByRoom = new Map();

  const connections =
    runtime &&
    runtime.registry &&
    runtime.registry.connections instanceof Map
      ? runtime.registry.connections
      : null;

  if (connections) {
    /*
      First priority: Music bots
    */
    for (const [key, instance] of connections.entries()) {
      if (!isMusicKey(key)) continue;

      if (!instance || typeof instance.sendRoomMessage !== "function") {
        continue;
      }

      const roomName = getMusicRoomFromKey(key);
      const normalizedRoomName = normalizeRoomName(roomName);

      if (!normalizedRoomName) continue;

      targetsByRoom.set(normalizedRoomName, {
        type: "music",
        roomName,
        socket: instance,
      });
    }

    /*
      Second priority: Controller bots
      يضاف فقط لو نفس الغرفة لا يوجد بها MusicBot
    */
    for (const [key, instance] of connections.entries()) {
      if (!isControllerKey(key)) continue;

      if (!instance || typeof instance.sendRoomMessage !== "function") {
        continue;
      }

      const roomName =
        getControllerRoomFromKey(key) ||
        instance?.bot?.roomName ||
        instance?.roomName ||
        "";

      const normalizedRoomName = normalizeRoomName(roomName);

      if (!normalizedRoomName) continue;

      if (targetsByRoom.has(normalizedRoomName)) {
        continue;
      }

      targetsByRoom.set(normalizedRoomName, {
        type: "controller",
        roomName,
        socket: instance,
      });
    }
  }

  /*
    حماية:
    لو لم نستطع قراءة registry، لا نفشل الأمر.
    نرسل من البوت الحالي فقط.
  */
  if (
    targetsByRoom.size === 0 &&
    currentContext &&
    currentContext.socket &&
    typeof currentContext.socket.sendRoomMessage === "function"
  ) {
    const roomName =
      currentContext?.bot?.roomName ||
      currentContext?.bot?.room ||
      "current-room";

    targetsByRoom.set(normalizeRoomName(roomName), {
      type: "current",
      roomName,
      socket: currentContext.socket,
    });
  }

  return Array.from(targetsByRoom.values());
}

async function prepareSong({ songName, sender, roomName }) {
  const result = await buildMusicReply(`تشغيل ${songName}`, {
    requestedBy: sender,
    roomName,
  });

  if (!result || !result.handled || result.success === false) {
    return {
      ok: false,
      error: "Song failed.",
    };
  }

  const songTitle =
    (result.meta && result.meta.youtubeTitle) ||
    (result.meta && result.meta.title) ||
    result.title ||
    songName;

  const songUrl = getSongUrlFromResult(result);

  return {
    ok: true,
    title: songTitle,
    url: songUrl,
  };
}

/*
  أمر تشغيل
  يرسل في الغرفة الحالية فقط.
*/
async function handlePlaySong(context) {
  const { bot, sender, socket, parsed } = context;

  const songName = parsed.args.join(" ").trim();

  if (!songName) {
    sendRoomTextSafe(socket, "Song name?");
    return;
  }

  sendRoomTextSafe(socket, `Loading: ${songName}`);

  const senderName = getSenderName(sender);

  const prepared = await prepareSong({
    songName,
    sender,
    roomName: bot.roomName,
  });

  if (!prepared.ok) {
    sendRoomTextSafe(socket, prepared.error || "Song failed.");
    return;
  }

  const song = songLikesRepository.createSong({
    songName: prepared.title,
    roomName: bot.roomName,
    requestedBy: senderName,
    url: prepared.url,
  });

  sendRoomTextSafe(socket, formatSongDetails(song));

  if (prepared.url) {
    sendRoomAudioSafe(socket, prepared.url);
  } else {
    sendRoomTextSafe(socket, "No audio URL.");
  }
}

/*
  أوامر:
  .ps
  .so
  .sh

  تعمل مثل تشغيل، لكن ترسل في كل الغرف.
*/
async function handleSongGlobal(context) {
  const { bot, sender, socket, parsed, runtime } = context;

  const songName = parsed.args.join(" ").trim();

  if (!songName) {
    sendRoomTextSafe(socket, "Song name?");
    return;
  }

  sendRoomTextSafe(socket, `Loading: ${songName}`);

  const senderName = getSenderName(sender);

  const prepared = await prepareSong({
    songName,
    sender,
    roomName: bot.roomName,
  });

  if (!prepared.ok) {
    sendRoomTextSafe(socket, prepared.error || "Song failed.");
    return;
  }

  const targets = getBroadcastTargets(runtime, context);

  if (!targets.length) {
    sendRoomTextSafe(socket, "No connected rooms.");
    return;
  }

  let sentCount = 0;
  let musicCount = 0;
  let controllerCount = 0;

  for (const target of targets) {
    const targetRoomName = target.roomName || bot.roomName;

    const song = songLikesRepository.createSong({
      songName: prepared.title,
      roomName: targetRoomName,
      requestedBy: senderName,
      url: prepared.url,
    });

    const text = formatSongDetails(song);

    const sentText = sendRoomTextSafe(target.socket, text);

  if (prepared.url) {
  const audioSent = sendRoomAudioSafe(target.socket, prepared.url);

  if (!audioSent) {
    console.log("❌ [GLOBAL_AUDIO_NOT_SENT]", {
      roomName: target.roomName,
      type: target.type,
      url: prepared.url,
    });
  }
}

    if (sentText) {
      sentCount += 1;

      if (target.type === "music") {
        musicCount += 1;
      }

      if (target.type === "controller") {
        controllerCount += 1;
      }
    }
  }

  console.log("🎵 [SONG_GLOBAL_DONE]", {
    command: parsed.command,
    songName,
    sentCount,
    musicCount,
    controllerCount,
  });

  sendRoomTextSafe(socket, `Sent: ${sentCount}`);
}

function handleLikeSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];

  if (!songId) {
    sendRoomTextSafe(socket, "Use: like@id");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.likeSong(songId, senderName);

  if (!result.ok && result.reason === "not_found") {
    sendRoomTextSafe(socket, "Not found.");
    return;
  }

  if (!result.ok && result.reason === "already_liked") {
    sendRoomTextSafe(socket, "Already liked.");
    return;
  }

  sendRoomTextSafe(
    socket,
    `Liked\n${result.song.songName}\nLikes: ${result.song.likesCount}`
  );

  if (result.song.requestedBy) {
    sendPrivateSafe(
      socket,
      result.song.requestedBy,
      [
        "New like",
        result.song.songName,
        `From: ${senderName}`,
        `Likes: ${result.song.likesCount}`,
      ].join("\n")
    );
  }
}

function handleCommentSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];
  const comment = parsed.args.slice(1).join("@").trim();

  if (!songId || !comment) {
    sendRoomTextSafe(socket, "Use: com@id@msg");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.commentSong(songId, senderName, comment);

  if (!result.ok && result.reason === "not_found") {
    sendRoomTextSafe(socket, "Not found.");
    return;
  }

  if (!result.ok && result.reason === "empty_comment") {
    sendRoomTextSafe(socket, "Empty comment.");
    return;
  }

  sendRoomTextSafe(socket, "Comment sent.");

  if (result.song.requestedBy) {
    sendPrivateSafe(
      socket,
      result.song.requestedBy,
      [
        "New comment",
        result.song.songName,
        `From: ${senderName}`,
        comment,
      ].join("\n")
    );
  }
}

function handleSongLikes(context) {
  const { socket } = context;

  const top = songLikesRepository.getTopSongs(10);

  if (!top.length) {
    sendRoomTextSafe(socket, "No likes.");
    return;
  }

  const lines = top.map((song, index) => {
    return `${index + 1}. ${song.songName} | ${song.id} | ${
      song.likesCount || 0
    } likes | ${song.commentsCount || 0} comments`;
  });

  sendRoomTextSafe(socket, lines.join("\n"));
}

async function handleMusicCommand(context) {
  const { parsed } = context;

  if (parsed.command === "play_song") {
    await handlePlaySong(context);
    return true;
  }

  if (
    parsed.command === "song_broadcast" ||
    parsed.command === "song_here" ||
    parsed.command === "song_private"
  ) {
    await handleSongGlobal(context);
    return true;
  }

  if (parsed.command === "like_song") {
    handleLikeSong(context);
    return true;
  }

  if (parsed.command === "comment_song") {
    handleCommentSong(context);
    return true;
  }

  if (parsed.command === "song_likes") {
    handleSongLikes(context);
    return true;
  }

  return false;
}

module.exports = {
  isMusicCommand,
  handleMusicCommand,
};
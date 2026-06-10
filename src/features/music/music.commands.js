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
  } catch { }

  return "";
}

function cleanShortSongName(value) {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6);

  return cleaned || "song";
}
// function formatSongDetails(song) {
//   const songName = String(song.songName || "Unknown song").trim();

//   const lines = [
//     songName,
//     "",
//     `${song.requestedBy}@${song.roomName}`,
//   ];

//   if (song.customMessage) {
//     lines.push(String(song.customMessage).trim());
//   }

//   lines.push(
//     "",
//     song.url || "",
//     "",
//     `like@${song.id}`,
//     "",
//     `com@${song.id}@msg`
//   );

//   return lines
//     .filter((v) => v !== null && v !== undefined)
//     .join("\n");
// }
function formatSongDetails(song) {
  const songName = String(song.songName || "Unknown song").trim();
  const customMessage = String(song.customMessage || "").trim();
  const shareTo = String(song.shareTo || "").trim();

  const lines = [songName];

  /*
    لو الأمر كان:
    .ps song name#message
    تظهر الرسالة تحت اسم الأغنية مباشرة
  */
  if (customMessage) {
    lines.push(customMessage);
  }

  lines.push("", `${song.requestedBy}@${song.roomName}`);

  /*
    لو الأمر كان:
    .ps song name@username
    يظهر هذا السطر
  */
  if (shareTo) {
    lines.push(`with@${shareTo}`);
  }

  lines.push(
    "",
    song.url || "",
    "",
    `like@${song.id}`,
    "",
    `com@${song.id}@msg`
  );

  return lines
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
  try {
    console.log("🎵 [PREPARE_SONG_START]", {
      songName,
      sender,
      roomName,
    });

    const result = await buildMusicReply(`تشغيل ${songName}`, {
      requestedBy: sender,
      roomName,
    });

    console.log("🎵 [PREPARE_SONG_RESULT]", {
      handled: result?.handled,
      success: result?.success,
      title: result?.title,
      publicUrl: result?.publicUrl,
      audioUrl: result?.audioUrl,
      url: result?.url,
      error: result?.error,
      message: result?.message,
      meta: result?.meta,
    });

    if (!result) {
      return {
        ok: false,
        error: "Song failed: empty result.",
      };
    }

    if (!result.handled) {
      return {
        ok: false,
        error: "Song failed: not handled.",
      };
    }

    if (result.success === false) {
      return {
        ok: false,
        error: result.error || result.message || "Song failed: download failed.",
      };
    }

    const songTitle =
      (result.meta && result.meta.youtubeTitle) ||
      (result.meta && result.meta.title) ||
      result.title ||
      songName;

    const songUrl = getSongUrlFromResult(result);

    if (!songUrl) {
      console.log("❌ [PREPARE_SONG_NO_AUDIO_URL]", {
        songName,
        result,
      });

      return {
        ok: false,
        error: "Song failed: no audio url.",
      };
    }

    return {
      ok: true,
      title: songTitle,
      url: songUrl,
    };
  } catch (err) {
    console.log("❌ [PREPARE_SONG_ERROR]", {
      songName,
      message: err.message,
      stack: err.stack,
    });

    return {
      ok: false,
      error: "Song failed: server error.",
    };
  }
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

  const senderName = getSenderName(sender);

  /*
    فحص قبل تحميل الأغنية حتى لا يضيع وقت وسيرفر
  */
  const cooldown = songLikesRepository.canCreateSong(senderName);

  if (!cooldown.ok && cooldown.reason === "cooldown") {
    sendRoomTextSafe(socket, `Please wait ${cooldown.waitSeconds}s.`);
    return;
  }

  sendRoomTextSafe(socket, `Loading: ${songName}`);

  const prepared = await prepareSong({
    songName,
    sender,
    roomName: bot.roomName,
  });

  if (!prepared.ok) {
    sendRoomTextSafe(socket, prepared.error || "Song failed.");
    return;
  }

  const created = songLikesRepository.createSong({
    songName: prepared.title,
    roomName: bot.roomName,
    requestedBy: senderName,
    url: prepared.url,
    customMessage: "",
  });

if (!created.ok && created.reason === "cooldown") {
  sendRoomTextSafe(socket, `Please wait ${created.waitSeconds}s.`);
  return;
}

  if (!created.ok) {
    sendRoomTextSafe(socket, "Song failed.");
    return;
  }

  const song = created.song;

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

  const senderName = getSenderName(sender);

const customMessage =
  parsed && parsed.meta && parsed.meta.customMessage
    ? String(parsed.meta.customMessage).trim()
    : "";

const shareTo =
  parsed && parsed.meta && parsed.meta.shareTo
    ? String(parsed.meta.shareTo).trim()
    : "";

  /*
    هنا فقط يتم فحص الانتظار.
    يعني لو المستخدم شغل أغنية أخرى خلال المدة، يرسل رسالة انتظار فقط.
  */
  const cooldown = songLikesRepository.canCreateSong(senderName);

  if (!cooldown.ok && cooldown.reason === "cooldown") {
    sendRoomTextSafe(socket, `Please wait ${cooldown.waitSeconds}s.`);
    return;
  }

  /*
    لا نرسل Loading إلا بعد التأكد أن المستخدم مسموح له يشغل أغنية.
  */
  sendRoomTextSafe(socket, `Loading: ${songName}`);

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

  const sourceRoomName = bot.roomName;

  /*
    مهم جدًا:
    إنشاء الأغنية مرة واحدة فقط.
    لا تضع createSong داخل for.
  */
  const created = songLikesRepository.createSong({
    songName: prepared.title,
    roomName: sourceRoomName,
    requestedBy: senderName,
    url: prepared.url,
    customMessage,
  });

  if (!created.ok && created.reason === "cooldown") {
    sendRoomTextSafe(socket, `Please wait ${created.waitSeconds}s.`);
    return;
  }

  if (!created.ok) {
    sendRoomTextSafe(socket, "Song failed.");
    return;
  }

const song = created.song;
song.shareTo = shareTo;

const text = formatSongDetails(song);

  let sentCount = 0;
  let musicCount = 0;
  let controllerCount = 0;

  for (const target of targets) {
    const sentText = sendRoomTextSafe(target.socket, text);

    if (prepared.url) {
      const audioSent = sendRoomAudioSafe(target.socket, prepared.url);

      if (!audioSent) {
        console.log("❌ [GLOBAL_AUDIO_NOT_SENT]", {
          sourceRoomName,
          targetRoomName: target.roomName,
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
    sourceRoomName,
    sentCount,
    musicCount,
    controllerCount,
  });
if (shareTo) {
  sendPrivateSafe(
    socket,
    shareTo,
    [
      "Song shared with you",
      "",
      song.songName,
      "",
      `From: ${senderName}`,
      `Room: ${sourceRoomName}`,
      "",
      song.url || "",
      "",
      `like@${song.id}`,
      "",
      `com@${song.id}@msg`,
    ]
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
      .join("\n")
  );
}
  /*
    بعد نجاح الإرسال، يرجع عدد الغرف فقط.
  */
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
    sendRoomTextSafe(socket, "Not found or expired.");
    return;
  }

  if (!result.ok && result.reason === "self_like") {
    sendRoomTextSafe(socket, "You cannot like your own song.");
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

// function handleLikeSong(context) {
//   const { sender, socket, parsed } = context;

//   const songId = parsed.args[0];

//   if (!songId) {
//     sendRoomTextSafe(socket, "Use: like@id");
//     return;
//   }

//   const senderName = getSenderName(sender);

//   const result = songLikesRepository.likeSong(songId, senderName);

//   if (!result.ok && result.reason === "not_found") {
//     sendRoomTextSafe(socket, "Not found.");
//     return;
//   }

//   if (!result.ok && result.reason === "already_liked") {
//     sendRoomTextSafe(socket, "Already liked.");
//     return;
//   }

//   sendRoomTextSafe(
//     socket,
//     `Liked\n${result.song.songName}\nLikes: ${result.song.likesCount}`
//   );

//   if (result.song.requestedBy) {
//     sendPrivateSafe(
//       socket,
//       result.song.requestedBy,
//       [
//         "New like",
//         result.song.songName,
//         `From: ${senderName}`,
//         `Likes: ${result.song.likesCount}`,
//       ].join("\n")
//     );
//   }
// }

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

function getAllSongsForLikesRanking() {
  /*
    الأفضل لو عندك في SongLikesRepository دالة getAllSongs
  */
  if (typeof songLikesRepository.getAllSongs === "function") {
    return songLikesRepository.getAllSongs() || [];
  }

  /*
    احتياطي لو عندك دالة getSongs
  */
  if (typeof songLikesRepository.getSongs === "function") {
    return songLikesRepository.getSongs() || [];
  }

  /*
    احتياطي لو عندك دالة listSongs
  */
  if (typeof songLikesRepository.listSongs === "function") {
    return songLikesRepository.listSongs() || [];
  }

  /*
    حل مؤقت:
    لو الموجود فقط getTopSongs، نجيب عدد كبير بدل 10
    حتى نقدر نجمع الأشخاص.
  */
  if (typeof songLikesRepository.getTopSongs === "function") {
    return songLikesRepository.getTopSongs(10000) || [];
  }

  return [];
}

function handleSongLikes(context) {
  const { socket } = context;

  const topUsers = songLikesRepository.getTopLikedUsers(10);

  if (!topUsers.length) {
    sendRoomTextSafe(socket, "No likes.");
    return;
  }

  const lines = topUsers.map((user, index) => {
    return `${index + 1}. ${user.username} | ${user.likesCount} likes`;
  });

  sendRoomTextSafe(socket, ["Top liked users:", "", ...lines].join("\n"));
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
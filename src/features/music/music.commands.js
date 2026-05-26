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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isSameUser(a, b) {
  return normalizeName(a) === normalizeName(b);
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

/*
  استخراج رابط الأغنية من buildMusicReply
  مهم: musicReply.service عندك يرجع الرابط داخل meta.mp3Url
*/
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

/*
  رسالة التفاصيل فقط بدون الرابط
*/
function formatSongDetails(song) {
  return [
    "🎵 تم تجهيز الأغنية",
    "",
    `🎧 الاسم: ${song.songName}`,
    `🆔 ID: ${song.id}`,
    `👤 بواسطة: ${song.requestedBy}`,
    `🏠 الغرفة: ${song.roomName}`,
    "",
    `❤️ للإعجاب: like@${song.id}`,
    `💬 للتعليق: com@${song.id}@تعليقك`,
  ].join("\n");
}

function formatSongBroadcast(song) {
  return [
    "🎵 Song request",
    "",
    `Song: ${song.songName}`,
    `ID: ${song.id}`,
    `By: ${song.requestedBy}`,
    `Room: ${song.roomName}`,
    "",
    `Like: like@${song.id}`,
    `Comment: com@${song.id}@your comment`,
  ].join("\n");
}

function sendMusicMessage({ socket, runtime, text }) {
  if (!text) return false;

  if (runtime && typeof runtime.broadcastMusicMessage === "function") {
    runtime.broadcastMusicMessage(text);
    return true;
  }

  socket.sendRoomMessage(text);
  return true;
}

function sendPrivateSafe(socket, to, text) {
  if (!socket || typeof socket.sendPrivate !== "function") {
    console.log("⚠️ sendPrivate not available on socket");
    return false;
  }

  if (!to) {
    console.log("⚠️ sendPrivate ignored: missing target");
    return false;
  }

  return socket.sendPrivate(to, text);
}

async function handlePlaySong(context) {
  const { bot, sender, socket, text, parsed, runtime } = context;

  const songName = parsed.args.join(" ").trim();

  if (!songName) {
    socket.sendRoomMessage("اكتب اسم الأغنية بعد الأمر");
    return;
  }

  socket.sendRoomMessage(`جاري تجهيز الأغنية: ${songName}`);

  const result = await buildMusicReply(text || `تشغيل ${songName}`, {
    requestedBy: sender,
    roomName: bot.roomName,
  });

  if (!result || !result.handled) {
    socket.sendRoomMessage("لم أستطع تجهيز الأغنية.");
    return;
  }

  if (result.success === false) {
    socket.sendRoomMessage(result.text || "فشل تجهيز الأغنية.");
    return;
  }

  const senderName = getSenderName(sender);

  const songTitle =
    (result.meta && result.meta.youtubeTitle) ||
    (result.meta && result.meta.title) ||
    result.title ||
    songName;

  const songUrl = getSongUrlFromResult(result);

  const song = songLikesRepository.createSong({
    songName: songTitle,
    roomName: bot.roomName,
    requestedBy: senderName,
    url: songUrl,
  });

  /*
    الرسالة الأولى: تفاصيل الأغنية
  */
  const detailsText = formatSongDetails(song);

  sendMusicMessage({
    socket,
    runtime,
    text: detailsText,
  });

  /*
    الرسالة الثانية: الرابط وحده
  */
  if (songUrl) {
    sendMusicMessage({
      socket,
      runtime,
      text: songUrl,
    });
  } else {
    socket.sendRoomMessage("تم تجهيز الأغنية لكن لم أجد رابط الصوت.");
  }
}

function handleSongShortcut(context) {
  const { bot, sender, socket, parsed, runtime } = context;

  const fakeSongName = parsed.args.join(" ").trim() || "بدون اسم";
  const senderName = getSenderName(sender);

  const song = songLikesRepository.createSong({
    songName: fakeSongName,
    roomName: bot.roomName,
    requestedBy: senderName,
    url: "",
  });

  const message = formatSongBroadcast(song);

  sendMusicMessage({
    socket,
    runtime,
    text: message,
  });
}

function handleLikeSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];

  if (!songId) {
    socket.sendRoomMessage("Use: like@song_id");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.likeSong(songId, senderName);

  if (!result.ok && result.reason === "not_found") {
    socket.sendRoomMessage("Song not found.");
    return;
  }

  if (!result.ok && result.reason === "already_liked") {
    socket.sendRoomMessage("You already liked this song.");
    return;
  }

  socket.sendRoomMessage(
    `Liked: ${result.song.songName}\nLikes: ${result.song.likesCount}`
  );

  /*
    إرسال رسالة خاصة لصاحب الأغنية عند الإعجاب
    لا نرسل لو صاحب الأغنية هو نفس الشخص الذي عمل لايك
  */
  if (
    result.song.requestedBy &&
    !isSameUser(result.song.requestedBy, senderName)
  ) {
    sendPrivateSafe(
      socket,
      result.song.requestedBy,
      [
        "❤️ لديك إعجاب جديد على أغنيتك",
        "",
        `🎧 الأغنية: ${result.song.songName}`,
        `🆔 ID: ${result.song.id}`,
        `👤 من: ${senderName}`,
        `❤️ عدد الإعجابات: ${result.song.likesCount}`,
      ].join("\n")
    );
  }
}

function handleCommentSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];
  const comment = parsed.args.slice(1).join("@").trim();

  if (!songId || !comment) {
    socket.sendRoomMessage("Use: com@song_id@comment");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.commentSong(songId, senderName, comment);

  if (!result.ok && result.reason === "not_found") {
    socket.sendRoomMessage("Song not found.");
    return;
  }

  socket.sendRoomMessage("تم إرسال تعليقك لصاحب الأغنية في الخاص.");

  /*
    إرسال التعليق لصاحب الأغنية في الخاص
    حتى لو صاحب الأغنية هو نفسه المعلق، يمكن منعها هنا
  */
  if (
    result.song.requestedBy &&
    !isSameUser(result.song.requestedBy, senderName)
  ) {
    sendPrivateSafe(
      socket,
      result.song.requestedBy,
      [
        "💬 لديك تعليق جديد على أغنيتك",
        "",
        `🎧 الأغنية: ${result.song.songName}`,
        `🆔 ID: ${result.song.id}`,
        `👤 من: ${senderName}`,
        "",
        `التعليق: ${comment}`,
      ].join("\n")
    );
  }
}

function handleSongLikes(context) {
  const { socket } = context;

  const top = songLikesRepository.getTopSongs(10);

  if (!top.length) {
    socket.sendRoomMessage("No song likes yet.");
    return;
  }

  const lines = top.map((song, index) => {
    return `${index + 1}. ${song.songName} | ID: ${song.id} | ${
      song.likesCount || 0
    } likes | ${song.commentsCount || 0} comments`;
  });

  socket.sendRoomMessage(["Top songs:", ...lines].join("\n"));
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
    handleSongShortcut(context);
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
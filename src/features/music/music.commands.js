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
    "song_likes",
  ].includes(command);
}

/*
  محاولة استخراج رابط الأغنية من نتيجة buildMusicReply
  لأن بعض الأكواد ترجع الرابط داخل result.publicUrl
  وبعضها داخل result.meta.publicUrl أو result.meta.audioUrl
*/
function getSongUrlFromResult(result) {
  if (!result) return "";

  return (
    result.publicUrl ||
    result.audioUrl ||
    result.url ||
    result.songUrl ||
    (result.meta && result.meta.publicUrl) ||
    (result.meta && result.meta.audioUrl) ||
    (result.meta && result.meta.url) ||
    (result.meta && result.meta.songUrl) ||
    ""
  );
}

/*
  رسالة التفاصيل فقط بدون رابط الأغنية
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
  ].join("\n");
}

/*
  هذه للأوامر المختصرة مثل .so / .sh / .ps
*/
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
    الرسالة الأولى: التفاصيل فقط
  */
  const detailsText = formatSongDetails(song);

  sendMusicMessage({
    socket,
    runtime,
    text: detailsText,
  });

  /*
    الرسالة الثانية: رابط الأغنية وحده في رسالة منفصلة
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
}

function handleSongLikes(context) {
  const { socket } = context;

  const top = songLikesRepository.getTopSongs(10);

  if (!top.length) {
    socket.sendRoomMessage("No song likes yet.");
    return;
  }

  const lines = top.map((song, index) => {
    return `${index + 1}. ${song.songName} | ID: ${song.id} | ${song.likesCount || 0} likes`;
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
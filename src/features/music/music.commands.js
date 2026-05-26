const { SongLikesRepository } = require("../../store/SongLikesRepository");
const { buildMusicReply } = require("./musicReply.service");

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

function formatSongBroadcast(song) {
  return [
    "🎵 Song request",
    `ID: ${song.id}`,
    `By: ${song.requestedBy}`,
    `Room: ${song.roomName}`,
    `Song: ${song.songName}`,
    "",
    `Like: like@${song.id}`,
  ].join("\n");
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

  if (!result.handled) {
    return;
  }

  const song = songLikesRepository.createSong({
    songName:
      (result.meta && result.meta.youtubeTitle) ||
      songName,
    roomName: bot.roomName,
    requestedBy: sender,
  });

  const finalText = [
    result.text,
    "",
    `ID: ${song.id}`,
    `Like: like@${song.id}`,
  ].join("\n");

  if (runtime && typeof runtime.broadcastMusicMessage === "function") {
    runtime.broadcastMusicMessage(finalText);
  } else {
    socket.sendRoomMessage(finalText);
  }
}

function handleSongShortcut(context) {
  const { bot, sender, socket, parsed, runtime } = context;

  const fakeSongName = parsed.args.join(" ").trim() || "بدون اسم";

  const song = songLikesRepository.createSong({
    songName: fakeSongName,
    roomName: bot.roomName,
    requestedBy: sender,
  });

  const message = formatSongBroadcast(song);

  if (runtime && typeof runtime.broadcastMusicMessage === "function") {
    runtime.broadcastMusicMessage(message);
  } else {
    socket.sendRoomMessage(message);
  }
}

function handleLikeSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];

  if (!songId) {
    socket.sendRoomMessage("Use: like@song_id");
    return;
  }

  const result = songLikesRepository.likeSong(songId, sender);

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
    return `${index + 1}. ${song.songName} | ${song.likesCount || 0} likes`;
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
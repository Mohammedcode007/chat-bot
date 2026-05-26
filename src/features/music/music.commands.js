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
    song.songName,
    `${song.requestedBy}@${song.roomName}`,
    `like@${song.id}`,
    `com@${song.id}@msg`,
  ].join("\n");
}

function formatSongBroadcast(song) {
  return [
    "🎵 Song",
    song.songName,
    `${song.requestedBy}@${song.roomName}`,
    `like@${song.id}`,
    `com@${song.id}@msg`,
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

async function handlePlaySong(context) {
  const { bot, sender, socket, text, parsed, runtime } = context;

  const songName = parsed.args.join(" ").trim();

  if (!songName) {
    socket.sendRoomMessage("Song name?");
    return;
  }

  socket.sendRoomMessage(`Loading: ${songName}`);

  const result = await buildMusicReply(text || `تشغيل ${songName}`, {
    requestedBy: sender,
    roomName: bot.roomName,
  });

  if (!result || !result.handled) {
    socket.sendRoomMessage("Song failed.");
    return;
  }

  if (result.success === false) {
    socket.sendRoomMessage("Song failed.");
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

  sendMusicMessage({
    socket,
    runtime,
    text: formatSongDetails(song),
  });

  if (songUrl) {
    if (socket && typeof socket.sendRoomAudioUrl === "function") {
      socket.sendRoomAudioUrl(songUrl);
    } else {
      socket.sendRoomMessage(songUrl);
    }
  } else {
    socket.sendRoomMessage("No audio URL.");
  }
}

function handleSongShortcut(context) {
  const { bot, sender, socket, parsed, runtime } = context;

  const fakeSongName = parsed.args.join(" ").trim() || "No name";
  const senderName = getSenderName(sender);

  const song = songLikesRepository.createSong({
    songName: fakeSongName,
    roomName: bot.roomName,
    requestedBy: senderName,
    url: "",
  });

  sendMusicMessage({
    socket,
    runtime,
    text: formatSongBroadcast(song),
  });
}

function handleLikeSong(context) {
  const { sender, socket, parsed } = context;

  const songId = parsed.args[0];

  if (!songId) {
    socket.sendRoomMessage("Use: like@id");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.likeSong(songId, senderName);

  if (!result.ok && result.reason === "not_found") {
    socket.sendRoomMessage("Not found.");
    return;
  }

  if (!result.ok && result.reason === "already_liked") {
    socket.sendRoomMessage("Already liked.");
    return;
  }

  socket.sendRoomMessage(`Liked\n${result.song.songName}\nLikes: ${result.song.likesCount}`);

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
    socket.sendRoomMessage("Use: com@id@msg");
    return;
  }

  const senderName = getSenderName(sender);

  const result = songLikesRepository.commentSong(songId, senderName, comment);

  if (!result.ok && result.reason === "not_found") {
    socket.sendRoomMessage("Not found.");
    return;
  }

  if (!result.ok && result.reason === "empty_comment") {
    socket.sendRoomMessage("Empty comment.");
    return;
  }

  socket.sendRoomMessage("Comment sent.");

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
    socket.sendRoomMessage("No likes.");
    return;
  }

  const lines = top.map((song, index) => {
    return `${index + 1}. ${song.songName} | ${song.id} | ${song.likesCount || 0} likes | ${song.commentsCount || 0} comments`;
  });

  socket.sendRoomMessage(lines.join("\n"));
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
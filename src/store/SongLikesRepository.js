const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const songLikesStore = new JsonStore(
  path.join(__dirname, "../data/songLikes.json"),
  {
    songs: {},
    likes: {},
    comments: {},
  }
);

function generateShortSongId() {
  return Math.random().toString(36).slice(2, 8);
}

function generateUniqueSongId(existingSongs) {
  let id = generateShortSongId();
  let attempts = 0;

  while (existingSongs[id] && attempts < 20) {
    id = generateShortSongId();
    attempts++;
  }

  if (existingSongs[id]) {
    id = `${Date.now().toString(36).slice(-3)}${Math.random()
      .toString(36)
      .slice(2, 5)}`;
  }

  return String(id).slice(0, 6);
}

class SongLikesRepository {
  getAll() {
    const data = songLikesStore.read();

    if (!data.songs) data.songs = {};
    if (!data.likes) data.likes = {};
    if (!data.comments) data.comments = {};

    return data;
  }

  saveAll(data) {
    return songLikesStore.write(data);
  }

  createSong({ songName, roomName, requestedBy, url }) {
    const data = this.getAll();

    const id = generateUniqueSongId(data.songs);

    data.songs[id] = {
      id,
      songName,
      roomName,
      requestedBy,
      url: url || "",
      createdAt: new Date().toISOString(),
      likesCount: 0,
      commentsCount: 0,
    };

    data.likes[id] = [];
    data.comments[id] = [];

    this.saveAll(data);

    return data.songs[id];
  }

  likeSong(songId, username) {
    const data = this.getAll();

    const cleanSongId = String(songId || "").trim();
    const song = data.songs[cleanSongId];

    if (!song) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    if (!Array.isArray(data.likes[cleanSongId])) {
      data.likes[cleanSongId] = [];
    }

    const exists = data.likes[cleanSongId].some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );

    if (exists) {
      return {
        ok: false,
        reason: "already_liked",
        song,
      };
    }

    data.likes[cleanSongId].push({
      username,
      likedAt: new Date().toISOString(),
    });

    song.likesCount = data.likes[cleanSongId].length;

    this.saveAll(data);

    return {
      ok: true,
      song,
    };
  }

  commentSong(songId, username, comment) {
    const data = this.getAll();

    const cleanSongId = String(songId || "").trim();
    const cleanComment = String(comment || "").trim();

    const song = data.songs[cleanSongId];

    if (!song) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    if (!cleanComment) {
      return {
        ok: false,
        reason: "empty_comment",
        song,
      };
    }

    if (!Array.isArray(data.comments[cleanSongId])) {
      data.comments[cleanSongId] = [];
    }

    const commentItem = {
      username,
      comment: cleanComment,
      commentedAt: new Date().toISOString(),
    };

    data.comments[cleanSongId].push(commentItem);

    song.commentsCount = data.comments[cleanSongId].length;

    this.saveAll(data);

    return {
      ok: true,
      song,
      comment: commentItem,
    };
  }

  getTopSongs(limit = 10) {
    const data = this.getAll();

    return Object.values(data.songs)
      .sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0))
      .slice(0, limit);
  }
}

module.exports = {
  SongLikesRepository,
};
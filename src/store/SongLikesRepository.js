const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const songLikesStore = new JsonStore(
  path.join(__dirname, "../data/songLikes.json"),
  {
    songs: {},
    likes: {},
  }
);

function generateShortSongId() {
  /*
    6 حروف وأرقام فقط
    مثال:
    A7K9Q2
    b4m8xz
  */
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
    };

    data.likes[id] = [];

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
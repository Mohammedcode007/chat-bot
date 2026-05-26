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

  createSong({ songName, roomName, requestedBy }) {
    const data = this.getAll();

    const id = `song_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    data.songs[id] = {
      id,
      songName,
      roomName,
      requestedBy,
      createdAt: new Date().toISOString(),
      likesCount: 0,
    };

    data.likes[id] = [];

    this.saveAll(data);

    return data.songs[id];
  }

  likeSong(songId, username) {
    const data = this.getAll();

    const song = data.songs[songId];

    if (!song) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    if (!Array.isArray(data.likes[songId])) {
      data.likes[songId] = [];
    }

    const exists = data.likes[songId].some(
      (item) => normalizeUsername(item.username) === normalizeUsername(username)
    );

    if (exists) {
      return {
        ok: false,
        reason: "already_liked",
        song,
      };
    }

    data.likes[songId].push({
      username,
      likedAt: new Date().toISOString(),
    });

    song.likesCount = data.likes[songId].length;

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
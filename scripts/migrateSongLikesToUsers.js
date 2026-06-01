const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../src/data/songLikes.json");
const BACKUP_PATH = path.join(
  __dirname,
  `../src/data/songLikes.backup.${Date.now()}.json`
);

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function main() {
  const oldData = readJson(DATA_PATH);

  fs.copyFileSync(DATA_PATH, BACKUP_PATH);

  const users = {};

  const songs = oldData.songs || {};
  const likes = oldData.likes || {};
  const comments = oldData.comments || {};

  for (const song of Object.values(songs)) {
    const username = String(song.requestedBy || "").trim();

    if (!username) {
      continue;
    }

    const key = normalizeUsername(username);

    if (!users[key]) {
      users[key] = {
        username,
        likesCount: 0,
        commentsCount: 0,
        songsCount: 0,
        lastSongAt: "",
        updatedAt: new Date().toISOString(),
      };
    }

    const songId = song.id;

    const oldLikesArray = Array.isArray(likes[songId]) ? likes[songId] : [];
    const oldCommentsArray = Array.isArray(comments[songId])
      ? comments[songId]
      : [];

    const likesCount =
      Number(song.likesCount || 0) > 0
        ? Number(song.likesCount || 0)
        : oldLikesArray.length;

    const commentsCount =
      Number(song.commentsCount || 0) > 0
        ? Number(song.commentsCount || 0)
        : oldCommentsArray.length;

    users[key].likesCount += likesCount;
    users[key].commentsCount += commentsCount;
    users[key].songsCount += 1;

    const createdAt = song.createdAt || "";

    if (
      createdAt &&
      (!users[key].lastSongAt ||
        new Date(createdAt).getTime() > new Date(users[key].lastSongAt).getTime())
    ) {
      users[key].lastSongAt = createdAt;
    }
  }

  const newData = {
    version: 2,
    migratedAt: new Date().toISOString(),
    users,
    recentSongs: {},
  };

  writeJson(DATA_PATH, newData);

  console.log("✅ Migration completed");
  console.log("📦 Backup created:", BACKUP_PATH);
  console.log("👤 Users:", Object.keys(users).length);
}

main();
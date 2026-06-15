// const path = require("path");
// const { JsonStore } = require("./JsonStore");
// const { normalizeUsername } = require("../utils/text");

// const songLikesStore = new JsonStore(
//   path.join(__dirname, "../data/songLikes.json"),
//   {
//     songs: {},
//     likes: {},
//     comments: {},
//   }
// );

// function generateShortSongId() {
//   return Math.random().toString(36).slice(2, 8);
// }

// function generateUniqueSongId(existingSongs) {
//   let id = generateShortSongId();
//   let attempts = 0;

//   while (existingSongs[id] && attempts < 20) {
//     id = generateShortSongId();
//     attempts++;
//   }

//   if (existingSongs[id]) {
//     id = `${Date.now().toString(36).slice(-3)}${Math.random()
//       .toString(36)
//       .slice(2, 5)}`;
//   }

//   return String(id).slice(0, 6);
// }

// class SongLikesRepository {
//   getAll() {
//     const data = songLikesStore.read();

//     if (!data.songs) data.songs = {};
//     if (!data.likes) data.likes = {};
//     if (!data.comments) data.comments = {};

//     return data;
//   }

//   saveAll(data) {
//     return songLikesStore.write(data);
//   }

// createSong({ songName, roomName, requestedBy, url, customMessage }) {
//   const data = this.getAll();

//   const id = generateUniqueSongId(data.songs);

//   data.songs[id] = {
//     id,
//     songName,
//     roomName,
//     requestedBy,
//     url: url || "",
//     customMessage: customMessage || "",
//     createdAt: new Date().toISOString(),
//     likesCount: 0,
//     commentsCount: 0,
//   };

//   data.likes[id] = [];
//   data.comments[id] = [];

//   this.saveAll(data);

//   return data.songs[id];
// }
//   likeSong(songId, username) {
//     const data = this.getAll();

//     const cleanSongId = String(songId || "").trim();
//     const song = data.songs[cleanSongId];

//     if (!song) {
//       return {
//         ok: false,
//         reason: "not_found",
//       };
//     }

//     if (!Array.isArray(data.likes[cleanSongId])) {
//       data.likes[cleanSongId] = [];
//     }

//     const exists = data.likes[cleanSongId].some(
//       (item) => normalizeUsername(item.username) === normalizeUsername(username)
//     );

//     if (exists) {
//       return {
//         ok: false,
//         reason: "already_liked",
//         song,
//       };
//     }

//     data.likes[cleanSongId].push({
//       username,
//       likedAt: new Date().toISOString(),
//     });

//     song.likesCount = data.likes[cleanSongId].length;

//     this.saveAll(data);

//     return {
//       ok: true,
//       song,
//     };
//   }

//   commentSong(songId, username, comment) {
//     const data = this.getAll();

//     const cleanSongId = String(songId || "").trim();
//     const cleanComment = String(comment || "").trim();

//     const song = data.songs[cleanSongId];

//     if (!song) {
//       return {
//         ok: false,
//         reason: "not_found",
//       };
//     }

//     if (!cleanComment) {
//       return {
//         ok: false,
//         reason: "empty_comment",
//         song,
//       };
//     }

//     if (!Array.isArray(data.comments[cleanSongId])) {
//       data.comments[cleanSongId] = [];
//     }

//     const commentItem = {
//       username,
//       comment: cleanComment,
//       commentedAt: new Date().toISOString(),
//     };

//     data.comments[cleanSongId].push(commentItem);

//     song.commentsCount = data.comments[cleanSongId].length;

//     this.saveAll(data);

//     return {
//       ok: true,
//       song,
//       comment: commentItem,
//     };
//   }

//   getTopSongs(limit = 10) {
//     const data = this.getAll();

//     return Object.values(data.songs)
//       .sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0))
//       .slice(0, limit);
//   }
// getTopLikedUsers(limit = 10) {
//   const data = this.getAll();

//   const usersMap = new Map();

//   for (const song of Object.values(data.songs)) {
//     const username = String(song.requestedBy || "").trim();

//     if (!username) {
//       continue;
//     }

//     const likesCount = Number(song.likesCount || 0);

//     if (likesCount <= 0) {
//       continue;
//     }

//     const key = normalizeUsername(username);

//     if (!usersMap.has(key)) {
//       usersMap.set(key, {
//         username,
//         likesCount: 0,
//       });
//     }

//     const user = usersMap.get(key);

//     user.likesCount += likesCount;
//   }

//   return Array.from(usersMap.values())
//     .sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0))
//     .slice(0, limit);
// }
//   /*
//     أكثر 10 أشخاص تم عمل لايك لهم.
//     التجميع هنا يكون حسب requestedBy، وليس حسب اسم الأغنية.
//   */
//   getTopLikedUsers(limit = 10) {
//     const data = this.getAll();

//     const usersMap = new Map();

//     for (const song of Object.values(data.songs)) {
//       const username = String(song.requestedBy || "").trim();

//       if (!username) {
//         continue;
//       }

//       const likesCount = Number(song.likesCount || 0);
//       const commentsCount = Number(song.commentsCount || 0);

//       if (likesCount <= 0) {
//         continue;
//       }

//       const key = normalizeUsername(username);

//       if (!usersMap.has(key)) {
//         usersMap.set(key, {
//           username,
//           likesCount: 0,
//           commentsCount: 0,
//           songsCount: 0,
//         });
//       }

//       const user = usersMap.get(key);

//       user.likesCount += likesCount;
//       user.commentsCount += commentsCount;
//       user.songsCount += 1;
//     }

//     return Array.from(usersMap.values())
//       .sort((a, b) => {
//         if (Number(b.likesCount || 0) !== Number(a.likesCount || 0)) {
//           return Number(b.likesCount || 0) - Number(a.likesCount || 0);
//         }

//         if (Number(b.commentsCount || 0) !== Number(a.commentsCount || 0)) {
//           return Number(b.commentsCount || 0) - Number(a.commentsCount || 0);
//         }

//         return Number(b.songsCount || 0) - Number(a.songsCount || 0);
//       })
//       .slice(0, limit);
//   }
// }

// module.exports = {
//   SongLikesRepository,
// };

const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

/*
  ================================
  SETTINGS
  ================================
  عدّل هذه القيم بسهولة من هنا فقط
*/

const USER_SONG_COOLDOWN_MS = Math.max(
  0,
  Number(process.env.USER_SONG_COOLDOWN_MS || 10 * 1000)
);

const MAX_RECENT_SONGS = Math.max(
  1,
  Number(process.env.MAX_RECENT_SONGS || 300)
);

const RECENT_SONG_TTL_MS = Math.max(
  60 * 1000,
  Number(process.env.RECENT_SONG_TTL_MS || 24 * 60 * 60 * 1000)
);
const songLikesStore = new JsonStore(
  path.join(__dirname, "../data/songLikes.json"),
  {
    version: 2,
    users: {},
    recentSongs: {},
  }
);

function nowIso() {
  return new Date().toISOString();
}

function toMs(dateValue) {
  const value = new Date(dateValue).getTime();
  return Number.isFinite(value) ? value : 0;
}

function makeUserKey(username) {
  const normalized = normalizeUsername(username);
  return String(normalized || username || "unknown").trim().toLowerCase();
}

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
function ensureDataShape(data) {
  /*
    مهم جدًا:
    لو الملف مكتوب فيه [] لازم نحوله إلى object
    لأن Array لا يحفظ خصائص users/recentSongs بشكل صحيح في JSON.
  */
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    data = {};
  }

  if (!data.users || typeof data.users !== "object" || Array.isArray(data.users)) {
    data.users = {};
  }

  if (
    !data.recentSongs ||
    typeof data.recentSongs !== "object" ||
    Array.isArray(data.recentSongs)
  ) {
    data.recentSongs = {};
  }

  data.version = 2;

  return data;
}

class SongLikesRepository {
  getAll() {
    const data = songLikesStore.read();
    return ensureDataShape(data);
  }

  saveAll(data) {
    return songLikesStore.write(ensureDataShape(data));
  }

  pruneRecentSongs(data) {
    const recentSongs = data.recentSongs || {};
    const entries = Object.entries(recentSongs);
    const currentTime = Date.now();

    let filtered = entries.filter(([, song]) => {
      const createdAtMs = toMs(song.createdAt);
      if (!createdAtMs) return false;

      return currentTime - createdAtMs <= RECENT_SONG_TTL_MS;
    });

    filtered.sort((a, b) => {
      return toMs(b[1].createdAt) - toMs(a[1].createdAt);
    });

    filtered = filtered.slice(0, MAX_RECENT_SONGS);

    data.recentSongs = Object.fromEntries(filtered);
    return data;
  }

  getOrCreateUser(data, username) {
    const cleanUsername = String(username || "unknown").trim() || "unknown";
    const key = makeUserKey(cleanUsername);

    if (!data.users[key]) {
      data.users[key] = {
        username: cleanUsername,
        likesCount: 0,
        commentsCount: 0,
        songsCount: 0,
        lastSongAt: "",
        updatedAt: nowIso(),
      };
    }

    /*
      لو الاسم المزخرف اتغير أو كان فاضي، نخلي آخر اسم واضح
    */
    if (cleanUsername && cleanUsername !== "unknown") {
      data.users[key].username = cleanUsername;
    }

    return {
      key,
      user: data.users[key],
    };
  }

  canCreateSong(username) {
    const data = this.getAll();
    const { user } = this.getOrCreateUser(data, username);

    const lastSongMs = toMs(user.lastSongAt);
    const currentTime = Date.now();

    if (lastSongMs > 0) {
      const diff = currentTime - lastSongMs;

      if (diff < USER_SONG_COOLDOWN_MS) {
        return {
          ok: false,
          reason: "cooldown",
          waitMs: USER_SONG_COOLDOWN_MS - diff,
          waitSeconds: Math.ceil((USER_SONG_COOLDOWN_MS - diff) / 1000),
        };
      }
    }

    return {
      ok: true,
      waitMs: 0,
      waitSeconds: 0,
    };
  }

  createSong({ songName, roomName, requestedBy, url, customMessage }) {
    const data = this.getAll();
    this.pruneRecentSongs(data);

    const cleanRequestedBy = String(requestedBy || "unknown").trim() || "unknown";
    const { key: requesterKey, user } = this.getOrCreateUser(
      data,
      cleanRequestedBy
    );

    const lastSongMs = toMs(user.lastSongAt);
    const currentTime = Date.now();

    if (lastSongMs > 0) {
      const diff = currentTime - lastSongMs;

      if (diff < USER_SONG_COOLDOWN_MS) {
        this.saveAll(data);

        return {
          ok: false,
          reason: "cooldown",
          waitMs: USER_SONG_COOLDOWN_MS - diff,
          waitSeconds: Math.ceil((USER_SONG_COOLDOWN_MS - diff) / 1000),
        };
      }
    }

    const id = generateUniqueSongId(data.recentSongs);

    const song = {
      id,
      songName: String(songName || "Unknown song").trim(),
      roomName: String(roomName || "").trim(),
      requestedBy: cleanRequestedBy,
      requestedByKey: requesterKey,

      /*
        لا نحفظ الرابط داخل ملف اللايكات حتى لا يكبر.
        الرابط يرسل في الرسالة فقط من music.command.service
      */
      url: url || "",
      customMessage: customMessage || "",

      createdAt: nowIso(),
      likesCount: 0,
      commentsCount: 0,

      /*
        حفظ من عمل لايك للأغنية الحديثة فقط لمنع تكرار اللايك لنفس الأغنية.
        هذا مؤقت وسيتم حذفه مع recentSongs.
      */
      likedBy: {},
    };

    data.recentSongs[id] = song;

    user.songsCount = Number(user.songsCount || 0) + 1;
    user.lastSongAt = nowIso();
    user.updatedAt = nowIso();

    this.saveAll(data);

    return {
      ok: true,
      song,
    };
  }

  likeSong(songId, username) {
    const data = this.getAll();
    this.pruneRecentSongs(data);

    const cleanSongId = String(songId || "").trim();
    const cleanUsername = String(username || "unknown").trim() || "unknown";
    const likerKey = makeUserKey(cleanUsername);

    const song = data.recentSongs[cleanSongId];

    if (!song) {
      this.saveAll(data);

      return {
        ok: false,
        reason: "not_found",
      };
    }

    const requesterKey = song.requestedByKey || makeUserKey(song.requestedBy);

    if (requesterKey === likerKey) {
      this.saveAll(data);

      return {
        ok: false,
        reason: "self_like",
        song,
      };
    }

    if (!song.likedBy || typeof song.likedBy !== "object") {
      song.likedBy = {};
    }

    if (song.likedBy[likerKey]) {
      this.saveAll(data);

      return {
        ok: false,
        reason: "already_liked",
        song,
      };
    }

    song.likedBy[likerKey] = {
      username: cleanUsername,
      likedAt: nowIso(),
    };

    song.likesCount = Number(song.likesCount || 0) + 1;

    const { user: ownerUser } = this.getOrCreateUser(data, song.requestedBy);

    ownerUser.likesCount = Number(ownerUser.likesCount || 0) + 1;
    ownerUser.updatedAt = nowIso();

    this.saveAll(data);

    return {
      ok: true,
      song,
      owner: ownerUser,
    };
  }

  commentSong(songId, username, comment) {
    const data = this.getAll();
    this.pruneRecentSongs(data);

    const cleanSongId = String(songId || "").trim();
    const cleanComment = String(comment || "").trim();

    const song = data.recentSongs[cleanSongId];

    if (!song) {
      this.saveAll(data);

      return {
        ok: false,
        reason: "not_found",
      };
    }

    if (!cleanComment) {
      this.saveAll(data);

      return {
        ok: false,
        reason: "empty_comment",
        song,
      };
    }

    song.commentsCount = Number(song.commentsCount || 0) + 1;

    const { user: ownerUser } = this.getOrCreateUser(data, song.requestedBy);

    ownerUser.commentsCount = Number(ownerUser.commentsCount || 0) + 1;
    ownerUser.updatedAt = nowIso();

    this.saveAll(data);

    return {
      ok: true,
      song,
      comment: {
        username,
        comment: cleanComment,
        commentedAt: nowIso(),
      },
    };
  }

  getTopLikedUsers(limit = 10) {
    const data = this.getAll();

    return Object.values(data.users || {})
      .filter((user) => Number(user.likesCount || 0) > 0)
      .sort((a, b) => {
        if (Number(b.likesCount || 0) !== Number(a.likesCount || 0)) {
          return Number(b.likesCount || 0) - Number(a.likesCount || 0);
        }

        if (Number(b.commentsCount || 0) !== Number(a.commentsCount || 0)) {
          return Number(b.commentsCount || 0) - Number(a.commentsCount || 0);
        }

        return Number(b.songsCount || 0) - Number(a.songsCount || 0);
      })
      .slice(0, limit)
      .map((user) => {
        return {
          username: user.username,
          likesCount: Number(user.likesCount || 0),
          commentsCount: Number(user.commentsCount || 0),
          songsCount: Number(user.songsCount || 0),
        };
      });
  }

  /*
    توافق فقط لو أي كود قديم يستدعي getTopSongs.
    لم نعد نعتمد على ترتيب الأغاني.
  */
  getTopSongs(limit = 10) {
    const data = this.getAll();

    return Object.values(data.recentSongs || {})
      .sort((a, b) => Number(b.likesCount || 0) - Number(a.likesCount || 0))
      .slice(0, limit);
  }

  getSettings() {
    return {
      USER_SONG_COOLDOWN_MS,
      MAX_RECENT_SONGS,
      RECENT_SONG_TTL_MS,
    };
  }
}

module.exports = {
  SongLikesRepository,
};
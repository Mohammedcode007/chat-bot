const { COMMAND_PREFIX } = require("../constants/commands");

function parseCommand(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return null;
  }

  const lowerRaw = raw.toLowerCase();

  /*
    help
    help1
    help2
    help3
    help4
  */
  if (/^help[0-9]*$/i.test(lowerRaw)) {
    return {
      raw,
      command: lowerRaw,
      args: [],
      hasPrefix: false,
    };
  }

  /*
    الصفحة التالية
  */
  if (lowerRaw === ".nx") {
    return {
      raw,
      command: "nx",
      args: [],
      hasPrefix: false,
    };
  }

  /*
    آخر 100 مستخدم دخلوا الغرفة
  */
  if (lowerRaw === ".r") {
    return {
      raw,
      command: "recent",
      args: [],
      hasPrefix: false,
    };
  }

  /*
    VIP
    vip@username
  */
  if (lowerRaw.startsWith("vip@")) {
    const username = raw.slice(4).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "vip",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Remove VIP
    unvip@username
  */
  if (lowerRaw.startsWith("unvip@")) {
    const username = raw.slice(6).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "unvip",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Verify
    v@username
  */
  if (lowerRaw.startsWith("v@")) {
    const username = raw.slice(2).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "verify",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Remove Verify
    unver@username
  */
  if (lowerRaw.startsWith("unver@")) {
    const username = raw.slice(6).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "unverify",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Add bot admin
    admin@username
  */
  if (lowerRaw.startsWith("admin@")) {
    const username = raw.slice(6).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "adminadd",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Remove bot admin
    radmin@username
  */
  if (lowerRaw.startsWith("radmin@")) {
    const username = raw.slice(7).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "adminremove",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Add master
    mas@username
  */
  if (lowerRaw.startsWith("mas@")) {
    const username = raw.slice(4).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "mas",
      args: [username],
      hasPrefix: false,
    };
  }

  /*
    Remove master
    rmas@username
  */
  if (lowerRaw.startsWith("rmas@")) {
    const username = raw.slice(5).trim();

    if (!username) {
      return null;
    }

    return {
      raw,
      command: "rmas",
      args: [username],
      hasPrefix: false,
    };
  }
if (lowerRaw.startsWith("تشغيل ")) {
  const songName = raw.slice("تشغيل ".length).trim();

  if (!songName) return null;

  return {
    raw,
    command: "play_song",
    args: [songName],
    hasPrefix: false,
  };
}
/*
  .so song name
  .sh song name
  .ps song name

  تعمل مثل تشغيل تماماً
  لكن ترسل في كل الغرف المتصلة:
  - لو بوت الموسيقى موجود في الغرفة يرسل هو
  - لو غير موجود يرسل بوت التحكم
*/
if (
  lowerRaw.startsWith(".so ") ||
  lowerRaw.startsWith(".sh ") ||
  lowerRaw.startsWith(".ps ")
) {
  const commandText = lowerRaw.slice(0, 3);
  const songName = raw.slice(3).trim();

  if (!songName) {
    return null;
  }

  let command = "song_broadcast";

  if (commandText === ".sh") {
    command = "song_here";
  }

  if (commandText === ".ps") {
    command = "song_private";
  }

  return {
    raw,
    command,
    args: [songName],
    hasPrefix: false,
  };
}

if (lowerRaw.startsWith("like@")) {
  const songId = raw.slice(5).trim();

  if (!songId) return null;

  if (!/^[a-z0-9]{1,6}$/i.test(songId)) {
    return null;
  }

  return {
    raw,
    command: "like_song",
    args: [songId],
    hasPrefix: false,
  };
}
if (lowerRaw.startsWith("com@")) {
  const rest = raw.slice(4).trim();

  if (!rest) return null;

  const firstAtIndex = rest.indexOf("@");

  if (firstAtIndex === -1) {
    return null;
  }

  const songId = rest.slice(0, firstAtIndex).trim();
  const comment = rest.slice(firstAtIndex + 1).trim();

  if (!songId || !comment) {
    return null;
  }

  if (!/^[a-z0-9]{1,6}$/i.test(songId)) {
    return null;
  }

  return {
    raw,
    command: "comment_song",
    args: [songId, comment],
    hasPrefix: false,
  };
}
if (lowerRaw === ".likes") {
  return {
    raw,
    command: "song_likes",
    args: [],
    hasPrefix: false,
  };
}
  /*
    باقي الأوامر التي تبدأ بـ !
  */
  if (!raw.startsWith(COMMAND_PREFIX)) {
    return null;
  }

  const withoutPrefix = raw.slice(COMMAND_PREFIX.length).trim();

  if (!withoutPrefix) {
    return null;
  }

  const parts = withoutPrefix.split(/\s+/);
  const command = String(parts.shift() || "").toLowerCase();

  return {
    raw,
    command,
    args: parts,
    hasPrefix: true,
  };
}

module.exports = {
  parseCommand,
};
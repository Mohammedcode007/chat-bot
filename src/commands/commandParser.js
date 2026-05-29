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
  Controller room admin commands
  m@username = member
  k@username = kick
  b@username = ban
  o@username = owner
  a@username = admin
*/
if (
  lowerRaw.startsWith("m@") ||
  lowerRaw.startsWith("k@") ||
  lowerRaw.startsWith("b@") ||
  lowerRaw.startsWith("o@") ||
  lowerRaw.startsWith("a@")
) {
  const actionKey = lowerRaw.slice(0, 1);
  const username = raw.slice(2).trim();

  if (!username) {
    return null;
  }

  const commandMap = {
    m: "control_member",
    k: "control_kick",
    b: "control_ban",
    o: "control_owner",
    a: "control_admin",
  };

  return {
    raw,
    command: commandMap[actionKey],
    args: [username],
    hasPrefix: false,
  };
}
/*
  Profile lookup
  p@username
*/
if (lowerRaw.startsWith("p@")) {
  const username = raw.slice(2).trim();

  if (!username) {
    return null;
  }

  return {
    raw,
    command: "profile_lookup",
    args: [username],
    hasPrefix: false,
  };
}
/*
  User lookup
  is@username
*/
if (lowerRaw.startsWith("is@")) {
  const username = raw.slice(3).trim();

  if (!username) {
    return null;
  }

  return {
    raw,
    command: "user_lookup",
    args: [username],
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
  .so@songname@msg
  .sh@songname@msg
  .ps@songname@msg

  أو:
  .so songname
  .sh songname
  .ps songname
*/
if (
  lowerRaw.startsWith(".so@") ||
  lowerRaw.startsWith(".sh@") ||
  lowerRaw.startsWith(".ps@") ||
  lowerRaw.startsWith(".so ") ||
  lowerRaw.startsWith(".sh ") ||
  lowerRaw.startsWith(".ps ")
) {
  const commandText = lowerRaw.slice(0, 3);

  let body = "";

  if (raw.charAt(3) === "@") {
    body = raw.slice(4).trim();
  } else {
    body = raw.slice(3).trim();
  }

  if (!body) {
    return null;
  }

  let songName = body;
  let customMessage = "";

  const atIndex = body.indexOf("@");

  if (atIndex !== -1) {
    songName = body.slice(0, atIndex).trim();
    customMessage = body.slice(atIndex + 1).trim();
  }

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
    meta: {
      customMessage,
    },
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
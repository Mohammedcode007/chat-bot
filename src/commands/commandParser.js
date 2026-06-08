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
  m@username / m username = member
  k@username / k username = kick
  b@username / b username = ban
  o@username / o username = owner
  a@username / a username = admin

  Also supports numbers after .r/.nx:
  m@5
  k@1-5
*/
{
  const controlMatch = raw.match(/^([mkboa])(?:@|\s+)(.+)$/i);

  if (controlMatch) {
    const actionKey = controlMatch[1].toLowerCase();
    const target = String(controlMatch[2] || "").trim();

    if (!target) {
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
      args: [target],
      hasPrefix: false,
    };
  }
}

/*
  Invite command
  i@username
  i username
  i@5
  i@1-5
*/
{
  const inviteMatch = raw.match(/^i(?:@|\s+)(.+)$/i);

  if (inviteMatch) {
    const target = String(inviteMatch[1] || "").trim();

    if (!target) {
      return null;
    }

    return {
      raw,
      command: "invite_user",
      args: [target],
      hasPrefix: false,
    };
  }
}
/*
  Watch commands
  watch@username
  unwatch@username
*/
if (lowerRaw.startsWith("watch@")) {
  const username = raw.slice(6).trim();

  if (!username) {
    return null;
  }

  return {
    raw,
    command: "watch_user",
    args: [username],
    hasPrefix: false,
  };
}

if (lowerRaw.startsWith("unwatch@")) {
  const username = raw.slice(8).trim();

  if (!username) {
    return null;
  }

  return {
    raw,
    command: "unwatch_user",
    args: [username],
    hasPrefix: false,
  };
}
/*
  Room settings
*/
if (lowerRaw === "settings") {
  return {
    raw,
    command: "room_settings_show",
    args: [],
    hasPrefix: false,
  };
}

/*
  set@music@on
  set@lookup@off
*/
if (lowerRaw.startsWith("set@")) {
  const parts = raw.split("@").map((p) => p.trim());

  if (parts.length < 3) {
    return null;
  }

  return {
    raw,
    command: "room_setting_set",
    args: [parts[1], parts[2]],
    hasPrefix: false,
  };
}
/*
  Welcome command
  wc@on
  wc@off
  wc@message $
*/
if (lowerRaw.startsWith("wc@")) {
  const value = raw.slice(3).trim();

  if (!value) {
    return null;
  }

  const cleanValue = value.toLowerCase();

  if (cleanValue === "on") {
    return {
      raw,
      command: "room_setting_set",
      args: ["welcome", "on"],
      hasPrefix: false,
    };
  }

  if (cleanValue === "off") {
    return {
      raw,
      command: "room_setting_set",
      args: ["welcome", "off"],
      hasPrefix: false,
    };
  }

  return {
    raw,
    command: "room_welcome_text",
    args: [value],
    hasPrefix: false,
  };
}
/*
  welcome@message
*/
if (lowerRaw.startsWith("welcome@")) {
  const text = raw.slice("welcome@".length).trim();

  if (!text) {
    return null;
  }

  return {
    raw,
    command: "room_welcome_text",
    args: [text],
    hasPrefix: false,
  };
}

/*
  bad@word
*/
if (lowerRaw.startsWith("bad@")) {
  const word = raw.slice(4).trim();

  if (!word) {
    return null;
  }

  return {
    raw,
    command: "room_badword_add",
    args: [word],
    hasPrefix: false,
  };
}

/*
  rbad@word
*/
if (lowerRaw.startsWith("rbad@")) {
  const word = raw.slice(5).trim();

  if (!word) {
    return null;
  }

  return {
    raw,
    command: "room_badword_remove",
    args: [word],
    hasPrefix: false,
  };
}

if (lowerRaw === "badlist") {
  return {
    raw,
    command: "room_badword_list",
    args: [],
    hasPrefix: false,
  };
}
  // /*
  //   Controller room admin commands
  //   m@username = member
  //   k@username = kick
  //   b@username = ban
  //   o@username = owner
  //   a@username = admin
  // */
  // if (
  //   lowerRaw.startsWith("m@") ||
  //   lowerRaw.startsWith("k@") ||
  //   lowerRaw.startsWith("b@") ||
  //   lowerRaw.startsWith("o@") ||
  //   lowerRaw.startsWith("a@")
  // ) {
  //   const actionKey = lowerRaw.slice(0, 1);
  //   const username = raw.slice(2).trim();

  //   if (!username) {
  //     return null;
  //   }

  //   const commandMap = {
  //     m: "control_member",
  //     k: "control_kick",
  //     b: "control_ban",
  //     o: "control_owner",
  //     a: "control_admin",
  //   };

  //   return {
  //     raw,
  //     command: commandMap[actionKey],
  //     args: [username],
  //     hasPrefix: false,
  //   };
  // }
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
    ms@username
  */
  if (lowerRaw.startsWith("ms@")) {
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
    rms@username
  */
  if (lowerRaw.startsWith("rms@")) {
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
  lowerRaw.startsWith(".so ") ||
  lowerRaw.startsWith(".sh ") ||
  lowerRaw.startsWith(".ps ")
) {
  const commandText = lowerRaw.slice(0, 3);

  const body = raw.slice(3).trim();

  if (!body) {
    return null;
  }

  let songName = body;
  let shareTo = "";
  let customMessage = "";

  const hasAt = body.includes("@");
  const hasHash = body.includes("#");

  /*
    المسموح فقط:
    .ps song name@username
    .sh song name@username
    .so song name@username

    أو:
    .ps song name#message
    .sh song name#message
    .so song name#message

    غير مسموح خلط @ و # في نفس الأمر
  */
  if (hasAt && hasHash) {
    return null;
  }

  if (hasAt) {
    const atIndex = body.lastIndexOf("@");

    songName = body.slice(0, atIndex).trim();
    shareTo = body.slice(atIndex + 1).trim();

    if (!shareTo) {
      return null;
    }
  }

  if (hasHash) {
    const hashIndex = body.indexOf("#");

    songName = body.slice(0, hashIndex).trim();
    customMessage = body.slice(hashIndex + 1).trim();

    if (!customMessage) {
      return null;
    }
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
      shareTo,
      customMessage,
    },
    hasPrefix: false,
  };
}
  // if (
  //   lowerRaw.startsWith(".so@") ||
  //   lowerRaw.startsWith(".sh@") ||
  //   lowerRaw.startsWith(".ps@") ||
  //   lowerRaw.startsWith(".so ") ||
  //   lowerRaw.startsWith(".sh ") ||
  //   lowerRaw.startsWith(".ps ")
  // ) {
  //   const commandText = lowerRaw.slice(0, 3);

  //   let body = "";

  //   if (raw.charAt(3) === "@") {
  //     body = raw.slice(4).trim();
  //   } else {
  //     body = raw.slice(3).trim();
  //   }

  //   if (!body) {
  //     return null;
  //   }

  //   let songName = body;
  //   let customMessage = "";

  //   const atIndex = body.indexOf("@");

  //   if (atIndex !== -1) {
  //     songName = body.slice(0, atIndex).trim();
  //     customMessage = body.slice(atIndex + 1).trim();
  //   }

  //   if (!songName) {
  //     return null;
  //   }

  //   let command = "song_broadcast";

  //   if (commandText === ".sh") {
  //     command = "song_here";
  //   }

  //   if (commandText === ".ps") {
  //     command = "song_private";
  //   }

  //   return {
  //     raw,
  //     command,
  //     args: [songName],
  //     meta: {
  //       customMessage,
  //     },
  //     hasPrefix: false,
  //   };
  // }
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
  Games:
  bomb@username
  فجر username
  زحلق username
  .s
  1 / 2 / 3
*/
if (lowerRaw.startsWith("bomb@")) {
  const username = raw.slice(5).trim();

  if (!username) return null;

  return {
    raw,
    command: "game_bomb",
    args: [username],
    hasPrefix: false,
  };
}

if (raw.startsWith("فجر ")) {
  const username = raw.slice("فجر ".length).trim();

  if (!username) return null;

  return {
    raw,
    command: "game_blast",
    args: [username],
    hasPrefix: false,
  };
}

if (raw.startsWith("زحلق ")) {
  const username = raw.slice("زحلق ".length).trim();

  if (!username) return null;

  return {
    raw,
    command: "game_blast",
    args: [username],
    hasPrefix: false,
  };
}

if (lowerRaw === ".s") {
  return {
    raw,
    command: "game_spin",
    args: [],
    hasPrefix: false,
  };
}

if (/^[123]$/.test(lowerRaw)) {
  return {
    raw,
    command: "game_answer",
    args: [lowerRaw],
    hasPrefix: false,
  };
}
/*
  Transfer game points
  tr@username@points
*/
if (lowerRaw.startsWith("tr@")) {
  const rest = raw.slice(3).trim();

  if (!rest) {
    return null;
  }

  const parts = rest.split("@").map((item) => item.trim());

  if (parts.length < 2) {
    return null;
  }

  const username = parts[0];
  const points = parts[1];

  if (!username || !points) {
    return null;
  }

  return {
    raw,
    command: "transfer_points",
    args: [username, points],
    hasPrefix: false,
  };
}
/*
  Room state save / backup

  .SAVE
  .BACKUP
*/
if (lowerRaw === ".save") {
  return {
    raw,
    command: "room_state_save",
    args: [],
    hasPrefix: false,
  };
}

if (lowerRaw === ".backup") {
  return {
    raw,
    command: "room_state_backup",
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
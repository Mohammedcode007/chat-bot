// function getTargetUsername(parsed) {
//   return String(parsed?.args?.[0] || "").trim();
// }

// function handleControllerControlCommand(context) {
//   const { parsed, socket, bot } = context;

//   const username = getTargetUsername(parsed);

//   if (!username) {
// socket.sendRoomMessage("Usage: m@username / k@username / b@username / o@username / a@username");
//     return;
//   }

//   if (parsed.command === "control_member") {
//     if (typeof socket.sendRoomMember !== "function") {
//       socket.sendRoomMessage("Member command is not supported.");
//       return;
//     }

//     const sent = socket.sendRoomMember(username, bot.roomName);

//     if (sent) {
//       socket.sendRoomMessage(`✅ Member: ${username}`);
//     } else {
//       socket.sendRoomMessage(`❌ Member failed: ${username}`);
//     }

//     return;
//   }

//   if (parsed.command === "control_kick") {
//     if (typeof socket.sendRoomKick !== "function") {
//       socket.sendRoomMessage("Kick command is not supported.");
//       return;
//     }

//     const sent = socket.sendRoomKick(username, bot.roomName);

//     if (sent) {
//       socket.sendRoomMessage(`✅ Kick sent: ${username}`);
//     } else {
//       socket.sendRoomMessage(`❌ Kick failed: ${username}`);
//     }

//     return;
//   }

//   if (parsed.command === "control_ban") {
//     if (typeof socket.sendRoomBan !== "function") {
//       socket.sendRoomMessage("Ban command is not supported.");
//       return;
//     }

//     const sent = socket.sendRoomBan(username, bot.roomName);

//     if (sent) {
//       socket.sendRoomMessage(`✅ Ban sent: ${username}`);
//     } else {
//       socket.sendRoomMessage(`❌ Ban failed: ${username}`);
//     }

//     return;
//   }

//   if (parsed.command === "control_owner") {
//     if (typeof socket.sendRoomOwner !== "function") {
//       socket.sendRoomMessage("Owner command is not supported.");
//       return;
//     }

//     const sent = socket.sendRoomOwner(username, bot.roomName);

//     if (sent) {
//       socket.sendRoomMessage(`✅ Owner sent: ${username}`);
//     } else {
//       socket.sendRoomMessage(`❌ Owner failed: ${username}`);
//     }

//     return;
//   }
// if (parsed.command === "control_admin") {
//   if (typeof socket.sendRoomAdmin !== "function") {
//     socket.sendRoomMessage("Admin command is not supported.");
//     return;
//   }

//   const sent = socket.sendRoomAdmin(username, bot.roomName);

//   if (sent) {
//     socket.sendRoomMessage(`✅ Admin sent: ${username}`);
//   } else {
//     socket.sendRoomMessage(`❌ Admin failed: ${username}`);
//   }

//   return;
// }
//   socket.sendRoomMessage("Unknown control command.");
// }

// module.exports = {
//   handleControllerControlCommand,
// };
const {
  resolveTargetFromSession,
} = require("../listActions/listActionSessions");

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function getActionInfo(command) {
  const actions = {
    control_member: {
      label: "Member",
      method: "sendRoomMember",
    },

    control_kick: {
      label: "Kick",
      method: "sendRoomKick",
    },

    control_ban: {
      label: "Ban",
      method: "sendRoomBan",
    },

    control_owner: {
      label: "Owner",
      method: "sendRoomOwner",
    },

    control_admin: {
      label: "Admin",
      method: "sendRoomAdmin",
    },
  };

  return actions[command] || null;
}

function sendResolveError(socket, reason) {
  if (reason === "expired_or_missing_session") {
    socket.sendRoomMessage("List expired. Send .r or .nx again.");
    return;
  }

  if (reason === "number_out_of_page") {
    socket.sendRoomMessage("Number is not in the current page.");
    return;
  }

  if (reason === "invalid_range") {
    socket.sendRoomMessage("Invalid range. Example: b@1-5");
    return;
  }

  if (reason === "range_empty") {
    socket.sendRoomMessage("No users found in this range.");
    return;
  }

  socket.sendRoomMessage(`Target error: ${reason}`);
}

function handleControllerControlCommand(context) {
  const { parsed, socket, bot, sender } = context;

  const target = getTargetUsername(parsed);

  if (!target) {
    socket.sendRoomMessage(
      "Usage: m@username / k@username / b@username / o@username / a@username"
    );
    return;
  }

  const action = getActionInfo(parsed.command);

  if (!action) {
    socket.sendRoomMessage("Unknown control command.");
    return;
  }

  if (typeof socket[action.method] !== "function") {
    socket.sendRoomMessage(`${action.label} command is not supported.`);
    return;
  }

  /*
    يدعم:
    m@username
    m@5
    b@1-5
  */
  const resolved = resolveTargetFromSession({
    roomName: bot.roomName,
    sender,
    target,
  });

  if (!resolved.ok) {
    sendResolveError(socket, resolved.reason);
    return;
  }

  const usernames = resolved.usernames || [];

  if (!usernames.length) {
    socket.sendRoomMessage(`${action.label} failed: no target.`);
    return;
  }

  let successCount = 0;

  usernames.forEach((username) => {
    const sent = socket[action.method](username, bot.roomName);

    if (sent) {
      successCount += 1;
    }
  });

  if (usernames.length === 1) {
    const username = usernames[0];

    if (successCount === 1) {
      socket.sendRoomMessage(`✅ ${action.label}: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ ${action.label} failed: ${username}`);
    }

    return;
  }

  socket.sendRoomMessage(
    `✅ ${action.label} sent: ${successCount}/${usernames.length}`
  );
}

module.exports = {
  handleControllerControlCommand,
};

// // const {
// //   resolveTargetFromSession,
// // } = require("../listActions/listActionSessions");

// // function getTargetUsername(parsed) {
// //   return String(parsed?.args?.[0] || "").trim();
// // }

// // function getActionInfo(command) {
// //   const actions = {
// //     control_member: {
// //       label: "Member",
// //       method: "sendRoomMember",
// //     },

// //     control_kick: {
// //       label: "Kick",
// //       method: "sendRoomKick",
// //     },

// //     control_ban: {
// //       label: "Ban",
// //       method: "sendRoomBan",
// //     },

// //     control_owner: {
// //       label: "Owner",
// //       method: "sendRoomOwner",
// //     },

// //     control_admin: {
// //       label: "Admin",
// //       method: "sendRoomAdmin",
// //     },
// //   };

// //   return actions[command] || null;
// // }

// // function sendResolveError(socket, reason) {
// //   if (reason === "expired_or_missing_session") {
// //     socket.sendRoomMessage("List expired. Send .r or .nx again.");
// //     return;
// //   }

// //   if (reason === "number_out_of_page") {
// //     socket.sendRoomMessage("Number is not in the current page.");
// //     return;
// //   }

// //   if (reason === "invalid_range") {
// //     socket.sendRoomMessage("Invalid range. Example: b@1-5");
// //     return;
// //   }

// //   if (reason === "range_empty") {
// //     socket.sendRoomMessage("No users found in this range.");
// //     return;
// //   }

// //   socket.sendRoomMessage(`Target error: ${reason}`);
// // }

// // function handleControllerControlCommand(context) {
// //   const { parsed, socket, bot, sender } = context;

// //   const target = getTargetUsername(parsed);

// //   if (!target) {
// //     socket.sendRoomMessage(
// //       "Usage: m@username / k@username / b@username / o@username / a@username"
// //     );
// //     return;
// //   }

// //   const action = getActionInfo(parsed.command);

// //   if (!action) {
// //     socket.sendRoomMessage("Unknown control command.");
// //     return;
// //   }

// //   if (typeof socket[action.method] !== "function") {
// //     socket.sendRoomMessage(`${action.label} command is not supported.`);
// //     return;
// //   }

// //   /*
// //     يدعم:
// //     m@username
// //     m@5
// //     b@1-5
// //   */
// //   const resolved = resolveTargetFromSession({
// //     roomName: bot.roomName,
// //     sender,
// //     target,
// //   });

// //   if (!resolved.ok) {
// //     sendResolveError(socket, resolved.reason);
// //     return;
// //   }

// //   const usernames = resolved.usernames || [];

// //   if (!usernames.length) {
// //     socket.sendRoomMessage(`${action.label} failed: no target.`);
// //     return;
// //   }

// //   let successCount = 0;

// //   usernames.forEach((username) => {
// //     const sent = socket[action.method](username, bot.roomName);

// //     if (sent) {
// //       successCount += 1;
// //     }
// //   });

// //   if (usernames.length === 1) {
// //     const username = usernames[0];

// //     if (successCount === 1) {
// //       socket.sendRoomMessage(`✅ ${action.label}: ${username}`);
// //     } else {
// //       socket.sendRoomMessage(`❌ ${action.label} failed: ${username}`);
// //     }

// //     return;
// //   }

// //   socket.sendRoomMessage(
// //     `✅ ${action.label} sent: ${successCount}/${usernames.length}`
// //   );
// // }

// // module.exports = {
// //   handleControllerControlCommand,
// // };
// const {
//   resolveTargetFromSession,
// } = require("../listActions/listActionSessions");

// const { normalizeUsername } = require("../../utils/text");
// const { VipUsersRepository } = require("../../store/VipUsersRepository");
// const { ControlLogsRepository } = require("../../store/ControlLogsRepository");

// const vipUsersRepository = new VipUsersRepository();
// const controlLogsRepository = new ControlLogsRepository();

// function getTargetUsername(parsed) {
//   return String(parsed?.args?.[0] || "").trim();
// }

// function normalizeForCheck(value) {
//   return normalizeUsername(value)
//     .replace(/\s+/g, "")
//     .replace(/^@+/, "");
// }

// function isVipAnywhere(username) {
//   const target = normalizeForCheck(username);
//   const data = vipUsersRepository.getAll();

//   return Object.values(data || {}).some((roomVipList) => {
//     if (!Array.isArray(roomVipList)) {
//       return false;
//     }

//     return roomVipList.some((item) => {
//       return normalizeForCheck(item.username) === target;
//     });
//   });
// }

// function getActionInfo(command) {
//   const actions = {
//     control_member: {
//       label: "Member",
//       method: "sendRoomMember",
//       logAction: "member",
//     },

//     control_kick: {
//       label: "Kick",
//       method: "sendRoomKick",
//       logAction: "kick",
//     },

//     control_ban: {
//       label: "Ban",
//       method: "sendRoomBan",
//       logAction: "ban",
//     },

//     control_owner: {
//       label: "Owner",
//       method: "sendRoomOwner",
//       logAction: "owner",
//     },

//     control_admin: {
//       label: "Admin",
//       method: "sendRoomAdmin",
//       logAction: "admin",
//     },
//   };

//   return actions[command] || null;
// }

// function sendResolveError(socket, reason) {
//   if (reason === "expired_or_missing_session") {
//     socket.sendRoomMessage("List expired. Send .r or .nx again.");
//     return;
//   }

//   if (reason === "number_out_of_page") {
//     socket.sendRoomMessage("Number is not in the current page.");
//     return;
//   }

//   if (reason === "invalid_range") {
//     socket.sendRoomMessage("Invalid range. Example: b@1-5");
//     return;
//   }

//   if (reason === "range_empty") {
//     socket.sendRoomMessage("No users found in this range.");
//     return;
//   }

//   socket.sendRoomMessage(`Target error: ${reason}`);
// }

// function logControlAction({ bot, sender, action, target }) {
//   controlLogsRepository.addLog({
//     roomName: bot.roomName,
//     performer: sender,
//     target,
//     action,
//     details: `${sender} used ${action} on ${target}`,
//   });
// }

// function handleControllerControlCommand(context) {
//   const { parsed, socket, bot, sender } = context;

//   const target = getTargetUsername(parsed);

//   if (!target) {
//     socket.sendRoomMessage(
//       "Usage: m@username / k@username / b@username / o@username / a@username"
//     );
//     return;
//   }

//   const action = getActionInfo(parsed.command);

//   if (!action) {
//     socket.sendRoomMessage("Unknown control command.");
//     return;
//   }

//   if (typeof socket[action.method] !== "function") {
//     socket.sendRoomMessage(`${action.label} command is not supported.`);
//     return;
//   }

//   const resolved = resolveTargetFromSession({
//     roomName: bot.roomName,
//     sender,
//     target,
//   });

//   if (!resolved.ok) {
//     sendResolveError(socket, resolved.reason);
//     return;
//   }

//   const usernames = resolved.usernames || [];

//   if (!usernames.length) {
//     socket.sendRoomMessage(`${action.label} failed: no target.`);
//     return;
//   }

//   let successCount = 0;
//   let blockedVipCount = 0;

//   usernames.forEach((username) => {
//     if (isVipAnywhere(username)) {
//       blockedVipCount += 1;
//       socket.sendRoomMessage(`Protected VIP user: ${username}`);
//       return;
//     }

//     const sent = socket[action.method](username, bot.roomName);

//     if (sent) {
//       successCount += 1;

//       logControlAction({
//         bot,
//         sender,
//         action: action.logAction,
//         target: username,
//       });
//     }
//   });

//   if (usernames.length === 1) {
//     const username = usernames[0];

//     if (blockedVipCount === 1) {
//       socket.sendRoomMessage(`❌ Cannot control VIP user: ${username}`);
//       return;
//     }

//     if (successCount === 1) {
//       socket.sendRoomMessage(`✅ ${action.label}: ${username}`);
//     } else {
//       socket.sendRoomMessage(`❌ ${action.label} failed: ${username}`);
//     }

//     return;
//   }

//   socket.sendRoomMessage(
//     `✅ ${action.label} sent: ${successCount}/${usernames.length} | VIP protected: ${blockedVipCount}`
//   );
// }

// module.exports = {
//   handleControllerControlCommand,
// };
const {
  resolveTargetFromSession,
} = require("../listActions/listActionSessions");

const { normalizeUsername } = require("../../utils/text");
const { VipUsersRepository } = require("../../store/VipUsersRepository");
const { ControlLogsRepository } = require("../../store/ControlLogsRepository");

const {
  isRoomFeatureEnabled,
} = require("../roomSettings/roomSettings.guard");

const vipUsersRepository = new VipUsersRepository();
const controlLogsRepository = new ControlLogsRepository();

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function isVipAnywhere(username) {
  const target = normalizeForCheck(username);
  const data = vipUsersRepository.getAll();

  return Object.values(data || {}).some((roomVipList) => {
    if (!Array.isArray(roomVipList)) {
      return false;
    }

    return roomVipList.some((item) => {
      return normalizeForCheck(item.username) === target;
    });
  });
}

function getActionInfo(command) {
  const actions = {
    control_member: {
      label: "Member",
      method: "sendRoomMember",
      logAction: "member",
    },

    control_kick: {
      label: "Kick",
      method: "sendRoomKick",
      logAction: "kick",
    },

    control_ban: {
      label: "Ban",
      method: "sendRoomBan",
      logAction: "ban",
    },

    control_owner: {
      label: "Owner",
      method: "sendRoomOwner",
      logAction: "owner",
    },

    control_admin: {
      label: "Admin",
      method: "sendRoomAdmin",
      logAction: "admin",
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

function logControlAction({ bot, sender, action, target }) {
  try {
    controlLogsRepository.addLog({
      roomName: bot.roomName,
      performer: sender,
      target,
      action,
      details: `${sender} used ${action} on ${target}`,
    });
  } catch (err) {
    console.log("❌ Failed to write control log:", err.message);
  }
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

    إذا الهدف رقم أو مدى أرقام، يتم حله من آخر قائمة .r أو .nx.
    إذا الهدف اسم، يتم استخدامه مباشرة.
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

  /*
    حماية VIP حسب إعداد الغرفة:

    set@vipprotect@on
    يمنع التحكم في VIP.

    set@vipprotect@off
    يسمح بتنفيذ أوامر التحكم على VIP.
  */
  const vipProtectEnabled = isRoomFeatureEnabled(
    bot.roomName,
    "vipProtectionEnabled"
  );

  let successCount = 0;
  let failedCount = 0;
  let blockedVipCount = 0;

  usernames.forEach((username) => {
    if (vipProtectEnabled && isVipAnywhere(username)) {
      blockedVipCount += 1;
      socket.sendRoomMessage(`Protected VIP user: ${username}`);
      return;
    }

    const sent = socket[action.method](username, bot.roomName);

    if (sent) {
      successCount += 1;

      logControlAction({
        bot,
        sender,
        action: action.logAction,
        target: username,
      });

      return;
    }

    failedCount += 1;
  });

  if (usernames.length === 1) {
    const username = usernames[0];

    if (blockedVipCount === 1) {
      socket.sendRoomMessage(`❌ Cannot control VIP user: ${username}`);
      return;
    }

    if (successCount === 1) {
      socket.sendRoomMessage(`✅ ${action.label}: ${username}`);
      return;
    }

    socket.sendRoomMessage(`❌ ${action.label} failed: ${username}`);
    return;
  }

  socket.sendRoomMessage(
    [
      `${action.label} result:`,
      `Success: ${successCount}`,
      `Failed: ${failedCount}`,
      `VIP protected: ${blockedVipCount}`,
    ].join("\n")
  );
}

module.exports = {
  handleControllerControlCommand,
};
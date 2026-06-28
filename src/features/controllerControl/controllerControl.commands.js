
// const {
//   resolveTargetFromSession,
// } = require("../listActions/listActionSessions");

// const { VipUsersRepository } = require("../../store/VipUsersRepository");
// const { ControlLogsRepository } = require("../../store/ControlLogsRepository");

// const {
//   isRoomFeatureEnabled,
// } = require("../roomSettings/roomSettings.guard");

// const vipUsersRepository = new VipUsersRepository();
// const controlLogsRepository = new ControlLogsRepository();

// function getTargetUsername(parsed) {
//   return String(parsed?.args?.[0] || "").trim();
// }

// /*
//   VIP أصبح عام على مستوى البوت.
//   لذلك لا نقرأ vipUsers.json يدويًا هنا.
//   نستخدم الدالة الجديدة:
//   vipUsersRepository.isVip(username)
// */
// function isVipAnywhere(username) {
//   return vipUsersRepository.isVip(username);
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
//   try {
//     controlLogsRepository.addLog({
//       roomName: bot.roomName,
//       performer: sender,
//       target,
//       action,
//       details: `${sender} used ${action} on ${target}`,
//     });
//   } catch (err) {
//     console.log("❌ Failed to write control log:", err.message);
//   }
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

//   /*
//     يدعم:
//     m@username
//     m@5
//     b@1-5

//     إذا الهدف رقم أو مدى أرقام، يتم حله من آخر قائمة .r أو .nx.
//     إذا الهدف اسم، يتم استخدامه مباشرة.
//   */
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

//   /*
//     حماية VIP حسب إعداد الغرفة:

//     set@vipprotect@on
//     يمنع التحكم في أي مستخدم VIP عام.

//     set@vipprotect@off
//     يسمح بتنفيذ أوامر التحكم على VIP.
//   */
//   const vipProtectEnabled = isRoomFeatureEnabled(
//     bot.roomName,
//     "vipProtectionEnabled"
//   );

//   let successCount = 0;
//   let failedCount = 0;
//   let blockedVipCount = 0;

//   usernames.forEach((username) => {
//     if (vipProtectEnabled && isVipAnywhere(username)) {
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

//       return;
//     }

//     failedCount += 1;
//   });

//   if (usernames.length === 1) {
//     const username = usernames[0];

//     if (blockedVipCount === 1) {
//       socket.sendRoomMessage(`❌ Cannot control VIP user: ${username}`);
//       return;
//     }

//     if (successCount === 1) {
//       socket.sendRoomMessage(`✅ ${action.label}: ${username}`);
//       return;
//     }

//     socket.sendRoomMessage(`❌ ${action.label} failed: ${username}`);
//     return;
//   }

//   socket.sendRoomMessage(
//     [
//       `${action.label} result:`,
//       `Success: ${successCount}`,
//       `Failed: ${failedCount}`,
//       `VIP protected: ${blockedVipCount}`,
//     ].join("\n")
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
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");

const {
  isRoomFeatureEnabled,
} = require("../roomSettings/roomSettings.guard");

const vipUsersRepository = new VipUsersRepository();
const controlLogsRepository = new ControlLogsRepository();
const roomUsersRepository = new RoomUsersRepository();

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

/*
  VIP عام على مستوى البوت.
*/
function isVipAnywhere(username) {
  return vipUsersRepository.isVip(username);
}

function getActionInfo(command) {
  const actions = {
    control_member: {
      label: "Member",
      method: "sendRoomMember",
      logAction: "member",
      savedRole: "member",
    },

    control_kick: {
      label: "Kick",
      method: "sendRoomKick",
      logAction: "kick",
      savedRole: "removed",
    },

    control_ban: {
      label: "Ban",
      method: "sendRoomBan",
      logAction: "ban",
      savedRole: "outcast",
    },

    control_owner: {
      label: "Owner",
      method: "sendRoomOwner",
      logAction: "owner",
      savedRole: "owner",
    },

    control_admin: {
      label: "Admin",
      method: "sendRoomAdmin",
      logAction: "admin",
      savedRole: "admin",
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

/*
  مهم جدًا:
  هذه الدالة تجعل .SAVE يرى آخر رتبة بعد:
  o@user
  a@user
  m@user
  b@user

  لأن .SAVE يقرأ من RoomUsersRepository.
*/
function syncRoomUserRole({ roomName, username, savedRole }) {
  console.log("🟡 [SYNC_START]", {
    roomName,
    username,
    savedRole,
  });

  if (!roomName || !username || !savedRole) {
    console.log("❌ [SYNC_STOP_MISSING_DATA]", {
      roomName,
      username,
      savedRole,
    });
    return;
  }

  try {
    const cleanUsername = String(username || "").trim();
    const target = normalizeForCheck(cleanUsername);

    console.log("🔎 [SYNC_NORMALIZED]", {
      cleanUsername,
      target,
      normalizedRoomName: normalizeForCheck(roomName),
    });

    const users =
      typeof roomUsersRepository.getRoomUsers === "function"
        ? roomUsersRepository.getRoomUsers(roomName) || []
        : [];

    console.log("📦 [SYNC_BEFORE_USERS]", {
      roomName,
      count: users.length,
      users,
    });

    let nextUsers = users.filter((user) => {
      return normalizeForCheck(user.username) !== target;
    });

    console.log("📦 [SYNC_AFTER_FILTER]", {
      roomName,
      count: nextUsers.length,
      nextUsers,
    });

    /*
      Kick يعني المستخدم خرج من الغرفة.
      لذلك نحذفه من القائمة المحلية.
    */
    if (savedRole === "removed") {
      console.log("🟠 [SYNC_REMOVE_USER]", {
        roomName,
        username: cleanUsername,
      });

      if (typeof roomUsersRepository.replaceRoomUsers === "function") {
        const writeResult = roomUsersRepository.replaceRoomUsers(
          roomName,
          nextUsers
        );

        console.log("✅ [SYNC_REMOVE_REPLACE_RESULT]", {
          writeResult,
        });
      } else if (typeof roomUsersRepository.removeUser === "function") {
        const removeResult = roomUsersRepository.removeUser(
          roomName,
          cleanUsername
        );

        console.log("✅ [SYNC_REMOVE_RESULT]", {
          removeResult,
        });
      } else {
        console.log("❌ [SYNC_REMOVE_NO_METHOD]");
      }

      const afterRemove =
        typeof roomUsersRepository.getRoomUsers === "function"
          ? roomUsersRepository.getRoomUsers(roomName) || []
          : [];

      console.log("📦 [SYNC_AFTER_REMOVE_USERS]", {
        roomName,
        count: afterRemove.length,
        users: afterRemove,
      });

      return;
    }

    /*
      Ban يتم حفظه outcast.
      وملف .SAVE يعتبر outcast ضمن blocked users.
    */
    const nextUser = {
      username: cleanUsername,
      role: savedRole,
      userId: "",
      photoUrl: "",
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    nextUsers.push(nextUser);

    console.log("➕ [SYNC_NEXT_USER_PUSHED]", {
      roomName,
      nextUser,
      nextUsersCount: nextUsers.length,
      nextUsers,
    });

    if (typeof roomUsersRepository.replaceRoomUsers === "function") {
      const writeResult = roomUsersRepository.replaceRoomUsers(
        roomName,
        nextUsers
      );

      console.log("✅ [SYNC_REPLACE_RESULT]", {
        writeResult,
      });
    } else if (typeof roomUsersRepository.addUser === "function") {
      const addResult = roomUsersRepository.addUser(roomName, {
        username: cleanUsername,
        role: savedRole,
        userId: "",
        photoUrl: "",
      });

      console.log("✅ [SYNC_ADD_RESULT]", {
        addResult,
      });
    } else {
      console.log("❌ [SYNC_NO_SAVE_METHOD]");
    }

    const afterUsers =
      typeof roomUsersRepository.getRoomUsers === "function"
        ? roomUsersRepository.getRoomUsers(roomName) || []
        : [];

    console.log("🟢 [SYNC_AFTER_USERS]", {
      roomName,
      count: afterUsers.length,
      users: afterUsers,
    });
  } catch (err) {
    console.log("❌ [ROOM_USER_ROLE_SYNC_ERROR]", {
      message: err.message,
      stack: err.stack,
    });
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
    يمنع التحكم في أي مستخدم VIP عام.

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

const result = socket[action.method](username, bot.roomName);

/*
  مهم:
  أغلب دوال socket.sendRoomBan / sendRoomAdmin / sendRoomOwner
  قد ترسل الأمر بنجاح لكنها ترجع undefined.
  لذلك نعتبرها ناجحة طالما لم ترجع false صراحة.
*/
const sent = result !== false;

if (sent) {
  successCount += 1;

  syncRoomUserRole({
    roomName: bot.roomName,
    username,
    savedRole: action.savedRole,
  });

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
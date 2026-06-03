// const { normalizeUsername } = require("../../utils/text");
// const { VipUsersRepository } = require("../../store/VipUsersRepository");
// const { WatchUsersRepository } = require("../../store/WatchUsersRepository");

// const vipUsersRepository = new VipUsersRepository();
// const watchUsersRepository = new WatchUsersRepository();

// function isWatchCommand(command) {
//   return command === "watch_user" || command === "unwatch_user";
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

// function getTargetUsername(parsed) {
//   return String(parsed?.args?.[0] || "").trim();
// }

// function handleWatchCommand(context) {
//   const { sender, socket, bot, parsed } = context;

//   const targetUsername = getTargetUsername(parsed);

//   if (!targetUsername) {
//     socket.sendRoomMessage("Usage: watch@username / unwatch@username");
//     return;
//   }

//   /*
//     الشرط الأساسي:
//     الشخص الذي يستخدم الأمر يجب أن يكون VIP.
//   */
//   if (!isVipAnywhere(sender)) {
//     socket.sendRoomMessage("Only VIP users can use watch commands.");
//     return;
//   }

//   if (normalizeUsername(sender) === normalizeUsername(targetUsername)) {
//     socket.sendRoomMessage("You cannot watch yourself.");
//     return;
//   }

//   if (parsed.command === "watch_user") {
//     const result = watchUsersRepository.addWatch(
//       sender,
//       targetUsername,
//       bot.roomName
//     );

//     if (result.alreadyExists) {
//       socket.sendRoomMessage(`Already watching: ${targetUsername}`);
//       return;
//     }

//     socket.sendRoomMessage(`Watch enabled: ${targetUsername}`);
//     return;
//   }

//   if (parsed.command === "unwatch_user") {
//     const removed = watchUsersRepository.removeWatch(sender, targetUsername);

//     if (!removed) {
//       socket.sendRoomMessage(`Not in your watch list: ${targetUsername}`);
//       return;
//     }

//     socket.sendRoomMessage(`Watch removed: ${targetUsername}`);
//     return;
//   }
// }

// function notifyWatchersOnJoin({ socket, username, roomName }) {
//   if (!username || !socket || typeof socket.sendPrivate !== "function") {
//     return;
//   }

//   const watchers = watchUsersRepository.findWatchersForTarget(username);

//   if (!watchers.length) {
//     return;
//   }

//   watchers.forEach((watcherUsername) => {
//     socket.sendPrivate(
//       watcherUsername,
//       [
//         "Watch alert",
//         `${username} joined a room.`,
//         `Room: ${roomName}`,
//       ].join("\n")
//     );
//   });

//   console.log("👁️ [WATCH_NOTIFY]", {
//     target: username,
//     roomName,
//     watchers,
//   });
// }

// module.exports = {
//   isWatchCommand,
//   handleWatchCommand,
//   notifyWatchersOnJoin,
// };
const { normalizeUsername } = require("../../utils/text");
const { VipUsersRepository } = require("../../store/VipUsersRepository");
const { WatchUsersRepository } = require("../../store/WatchUsersRepository");

const vipUsersRepository = new VipUsersRepository();
const watchUsersRepository = new WatchUsersRepository();

function isWatchCommand(command) {
  return command === "watch_user" || command === "unwatch_user";
}

/*
  VIP أصبح عام على مستوى البوت.
  لذلك لا نقرأ vipUsers.json يدويًا هنا.
*/
function isVipAnywhere(username) {
  return vipUsersRepository.isVip(username);
}

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function handleWatchCommand(context) {
  const { sender, socket, bot, parsed } = context;

  const targetUsername = getTargetUsername(parsed);

  if (!targetUsername) {
    socket.sendRoomMessage("Usage: watch@username / unwatch@username");
    return;
  }

  /*
    الشرط الأساسي:
    الشخص الذي يستخدم الأمر يجب أن يكون VIP عام على مستوى البوت.
  */
  if (!isVipAnywhere(sender)) {
    socket.sendRoomMessage("Only VIP users can use watch commands.");
    return;
  }

  if (normalizeUsername(sender) === normalizeUsername(targetUsername)) {
    socket.sendRoomMessage("You cannot watch yourself.");
    return;
  }

  if (parsed.command === "watch_user") {
    const result = watchUsersRepository.addWatch(
      sender,
      targetUsername,
      bot.roomName
    );

    if (result.alreadyExists) {
      socket.sendRoomMessage(`Already watching: ${targetUsername}`);
      return;
    }

    socket.sendRoomMessage(`Watch enabled: ${targetUsername}`);
    return;
  }

  if (parsed.command === "unwatch_user") {
    const removed = watchUsersRepository.removeWatch(sender, targetUsername);

    if (!removed) {
      socket.sendRoomMessage(`Not in your watch list: ${targetUsername}`);
      return;
    }

    socket.sendRoomMessage(`Watch removed: ${targetUsername}`);
    return;
  }

  socket.sendRoomMessage("Unknown watch command.");
}

function notifyWatchersOnJoin({ socket, username, roomName }) {
  if (!username || !socket || typeof socket.sendPrivate !== "function") {
    return;
  }

  const watchers = watchUsersRepository.findWatchersForTarget(username);

  if (!watchers.length) {
    return;
  }

  watchers.forEach((watcherUsername) => {
    socket.sendPrivate(
      watcherUsername,
      [
        "Watch alert",
        `${username} joined a room.`,
        `Room: ${roomName}`,
      ].join("\n")
    );
  });

  console.log("👁️ [WATCH_NOTIFY]", {
    target: username,
    roomName,
    watchers,
  });
}

module.exports = {
  isWatchCommand,
  handleWatchCommand,
  notifyWatchersOnJoin,
};
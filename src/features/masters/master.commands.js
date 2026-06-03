// const { isOwner } = require("../../commands/permissions");
// const { addMaster, removeMaster } = require("./master.service");
// const { ControlLogsRepository } = require("../../store/ControlLogsRepository");
// const controlLogsRepository = new ControlLogsRepository();
// function handleMasterCommand(context) {
//   const { bot, sender, socket, repository, parsed } = context;

//   let action = parsed.args[0];
//   let username = parsed.args[1];

//   /*
//     mas@username
//   */
//   if (parsed.command === "mas") {
//     action = "add";
//     username = parsed.args[0];
//   }

//   /*
//     rmas@username
//   */
//   if (parsed.command === "rmas") {
//     action = "remove";
//     username = parsed.args[0];
//   }

//   /*
//     Old command support:
//     !master add username
//     !master remove username
//   */
//   if (parsed.command === "master") {
//     action = parsed.args[0];
//     username = parsed.args[1];
//   }

//   if (!action || !username) {
//     socket.sendRoomMessage("ℹ️ Usage: mas@username or rmas@username");
//     return;
//   }

//   if (action === "add") {
//     if (isOwner(bot, username)) {
//       socket.sendRoomMessage("👑 This user is already the owner.");
//       return;
//     }

//     const result = addMaster(repository, bot.roomName, username);

//     if (result.alreadyExists) {
//       socket.sendRoomMessage(`⚠️ This user is already a master: ${username}`);
//       return;
//     }

//     if (!result.updated) {
//       socket.sendRoomMessage("❌ Failed to add master.");
//       return;
//     }

//     socket.sendRoomMessage(`✅ Master added successfully: ${username}`);
//     return;
//   }

//   if (action === "remove") {
//     if (!isOwner(bot, sender)) {
//       socket.sendRoomMessage("🚫 Only the owner can remove a master.");
//       return;
//     }

//     if (isOwner(bot, username)) {
//       socket.sendRoomMessage("👑 The main owner cannot be removed.");
//       return;
//     }

//     const result = removeMaster(repository, bot.roomName, username);

//     if (result.notMaster) {
//       socket.sendRoomMessage(`⚠️ This user is not a master: ${username}`);
//       return;
//     }

//     if (!result.updated) {
//       socket.sendRoomMessage("❌ Failed to remove master.");
//       return;
//     }

//     socket.sendRoomMessage(`✅ Master removed successfully: ${username}`);
//     return;
//   }

//   socket.sendRoomMessage("❌ Invalid master command.");
// }

// module.exports = {
//   handleMasterCommand,
// };

const { isOwner } = require("../../commands/permissions");
const { addMaster, removeMaster } = require("./master.service");
const { ControlLogsRepository } = require("../../store/ControlLogsRepository");

const controlLogsRepository = new ControlLogsRepository();

function addControlLog({ bot, sender, username, action }) {
  try {
    controlLogsRepository.addLog({
      roomName: bot.roomName,
      performer: sender,
      target: username,
      action,
      details: `${sender} ${action} ${username}`,
    });
  } catch (err) {
    console.log("❌ Failed to write control log:", err.message);
  }
}

function handleMasterCommand(context) {
  const { bot, sender, socket, repository, parsed } = context;

  let action = parsed.args[0];
  let username = parsed.args[1];

  /*
    mas@username
  */
  if (parsed.command === "mas") {
    action = "add";
    username = parsed.args[0];
  }

  /*
    rmas@username
  */
  if (parsed.command === "rmas") {
    action = "remove";
    username = parsed.args[0];
  }

  /*
    Old command support:
    !master add username
    !master remove username
  */
  if (parsed.command === "master") {
    action = parsed.args[0];
    username = parsed.args[1];
  }

  username = String(username || "").trim();
  action = String(action || "").trim().toLowerCase();

  if (!action || !username) {
    socket.sendRoomMessage("ℹ️ Usage: mas@username or rmas@username");
    return;
  }

  if (action === "add") {
    if (isOwner(bot, username)) {
      socket.sendRoomMessage("👑 This user is already the owner.");
      return;
    }

    const result = addMaster(repository, bot.roomName, username);

    if (result.alreadyExists) {
      socket.sendRoomMessage(`⚠️ This user is already a master: ${username}`);
      return;
    }

    if (!result.updated) {
      socket.sendRoomMessage("❌ Failed to add master.");
      return;
    }

    addControlLog({
      bot,
      sender,
      username,
      action: "master_add",
    });

    socket.sendRoomMessage(`✅ Master added successfully: ${username}`);
    return;
  }

  if (action === "remove") {
    if (!isOwner(bot, sender)) {
      socket.sendRoomMessage("🚫 Only the owner can remove a master.");
      return;
    }

    if (isOwner(bot, username)) {
      socket.sendRoomMessage("👑 The main owner cannot be removed.");
      return;
    }

    const result = removeMaster(repository, bot.roomName, username);

    if (result.notMaster) {
      socket.sendRoomMessage(`⚠️ This user is not a master: ${username}`);
      return;
    }

    if (!result.updated) {
      socket.sendRoomMessage("❌ Failed to remove master.");
      return;
    }

    addControlLog({
      bot,
      sender,
      username,
      action: "master_remove",
    });

    socket.sendRoomMessage(`✅ Master removed successfully: ${username}`);
    return;
  }

  socket.sendRoomMessage("❌ Invalid master command.");
}

module.exports = {
  handleMasterCommand,
};
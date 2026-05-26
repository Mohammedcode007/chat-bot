const { isOwner } = require("../../commands/permissions");
const { addMaster, removeMaster } = require("./master.service");

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

    socket.sendRoomMessage(`✅ Master removed successfully: ${username}`);
    return;
  }

  socket.sendRoomMessage("❌ Invalid master command.");
}

module.exports = {
  handleMasterCommand,
};
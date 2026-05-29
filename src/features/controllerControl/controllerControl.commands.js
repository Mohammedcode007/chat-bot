function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function handleControllerControlCommand(context) {
  const { parsed, socket, bot } = context;

  const username = getTargetUsername(parsed);

  if (!username) {
    socket.sendRoomMessage("Usage: m@username / k@username / b@username");
    return;
  }

  if (parsed.command === "control_member") {
    if (typeof socket.sendRoomMember !== "function") {
      socket.sendRoomMessage("Member command is not supported by SocketClient.");
      return;
    }

    const sent = socket.sendRoomMember(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Member given: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Failed to give member: ${username}`);
    }

    return;
  }

  if (parsed.command === "control_kick") {
    if (typeof socket.sendRoomKick !== "function") {
      socket.sendRoomMessage("Kick command is not supported by SocketClient.");
      return;
    }

    const sent = socket.sendRoomKick(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Kicked: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Failed to kick: ${username}`);
    }

    return;
  }

  if (parsed.command === "control_ban") {
    if (typeof socket.sendRoomBan !== "function") {
      socket.sendRoomMessage("Ban command is not supported by SocketClient.");
      return;
    }

    const sent = socket.sendRoomBan(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Banned: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Failed to ban: ${username}`);
    }

    return;
  }

  socket.sendRoomMessage("Unknown control command.");
}

module.exports = {
  handleControllerControlCommand,
};
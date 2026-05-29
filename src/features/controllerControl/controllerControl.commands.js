function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function handleControllerControlCommand(context) {
  const { parsed, socket, bot } = context;

  const username = getTargetUsername(parsed);

  if (!username) {
    socket.sendRoomMessage("Usage: m@username / k@username / b@username / o@username");
    return;
  }

  if (parsed.command === "control_member") {
    if (typeof socket.sendRoomMember !== "function") {
      socket.sendRoomMessage("Member command is not supported.");
      return;
    }

    const sent = socket.sendRoomMember(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Member: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Member failed: ${username}`);
    }

    return;
  }

  if (parsed.command === "control_kick") {
    if (typeof socket.sendRoomKick !== "function") {
      socket.sendRoomMessage("Kick command is not supported.");
      return;
    }

    const sent = socket.sendRoomKick(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Kick sent: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Kick failed: ${username}`);
    }

    return;
  }

  if (parsed.command === "control_ban") {
    if (typeof socket.sendRoomBan !== "function") {
      socket.sendRoomMessage("Ban command is not supported.");
      return;
    }

    const sent = socket.sendRoomBan(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Ban sent: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Ban failed: ${username}`);
    }

    return;
  }

  if (parsed.command === "control_owner") {
    if (typeof socket.sendRoomOwner !== "function") {
      socket.sendRoomMessage("Owner command is not supported.");
      return;
    }

    const sent = socket.sendRoomOwner(username, bot.roomName);

    if (sent) {
      socket.sendRoomMessage(`✅ Owner sent: ${username}`);
    } else {
      socket.sendRoomMessage(`❌ Owner failed: ${username}`);
    }

    return;
  }

  socket.sendRoomMessage("Unknown control command.");
}

module.exports = {
  handleControllerControlCommand,
};
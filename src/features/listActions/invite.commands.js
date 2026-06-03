const {
  resolveTargetFromSession,
} = require("./listActionSessions");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInviteText(roomName, sender) {
  return [
    "Room invitation",
    `Room: ${roomName}`,
    `Invited by: ${sender}`,
  ].join("\n");
}

async function handleInviteCommand(context) {
  const { bot, sender, socket, parsed } = context;

  const target = String(parsed?.args?.[0] || "").trim();

  if (!target) {
    socket.sendRoomMessage("Usage: i@username / i username / i@1-5");
    return;
  }

  const resolved = resolveTargetFromSession({
    roomName: bot.roomName,
    sender,
    target,
  });

  if (!resolved.ok) {
    if (resolved.reason === "expired_or_missing_session") {
      socket.sendRoomMessage("List expired. Send .r or .nx again.");
      return;
    }

    socket.sendRoomMessage(`Invite failed: ${resolved.reason}`);
    return;
  }

  const usernames = resolved.usernames || [];

  if (!usernames.length) {
    socket.sendRoomMessage("No users to invite.");
    return;
  }

  const text = buildInviteText(bot.roomName, sender);

  /*
    لو range، يرسل دعوة كل ثانية.
    لو مستخدم واحد، يرسل مباشرة.
  */
  for (let index = 0; index < usernames.length; index += 1) {
    const username = usernames[index];

    socket.sendPrivate(username, text);

    if (usernames.length > 1 && index < usernames.length - 1) {
      await wait(1000);
    }
  }

  socket.sendRoomMessage(`Invite sent: ${usernames.length}`);
}

module.exports = {
  handleInviteCommand,
};
const { getSystemInfo } = require("./system.service");

function handleSystemCommand(context) {
  const { bot, socket, repository, parsed } = context;

  const action = parsed.args[0];

  if (action === "info") {
    const info = getSystemInfo({ repository, bot });

    socket.sendRoomMessage(`
⚙️ System Info

Room: ${info.roomName}
Owner: ${info.owner}
Masters: ${info.mastersCount}
Silent Bots: ${info.silentBotsCount}
`);
    return;
  }

  socket.sendRoomMessage("❌ أمر system غير صحيح.");
}

module.exports = {
  handleSystemCommand,
};
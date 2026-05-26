const { createSilentBot } = require("./silentBot.service");

function handleSilentBotCommand(context) {
  const { bot, sender, socket, repository, runtime, parsed } = context;

  const action = parsed.args[0];

  if (action === "add") {
    const username = parsed.args[1];
    const password = parsed.args[2];
    const roomName = parsed.args[3] || bot.roomName;

    if (!username || !password) {
      socket.sendRoomMessage("❌ الاستخدام: !silent add username password");
      return;
    }

    const silentBot = createSilentBot({
      username,
      password,
      roomName,
      owner: sender,
    });

    try {
      repository.addSilentBot(silentBot);
      runtime.connectSilentBot(silentBot);

      socket.sendRoomMessage(`✅ تم إضافة بوت صامت: ${username}`);
    } catch (err) {
      socket.sendRoomMessage(`❌ ${err.message}`);
    }

    return;
  }

  if (action === "remove") {
    const username = parsed.args[1];

    if (!username) {
      socket.sendRoomMessage("❌ الاستخدام: !silent remove username");
      return;
    }

    const removed = repository.removeSilentBot(bot.roomName, username);

    if (!removed) {
      socket.sendRoomMessage("⚠️ هذا البوت غير موجود.");
      return;
    }

    runtime.disconnectSilentBot(bot.roomName, username);
    socket.sendRoomMessage(`🗑️ تم حذف البوت الصامت: ${username}`);
    return;
  }

  if (action === "list") {
    const bots = repository.getSilentBotsByRoom(bot.roomName);

    if (!bots.length) {
      socket.sendRoomMessage("لا يوجد بوتات صامتة في هذه الغرفة.");
      return;
    }

    const text = bots
      .map((item, index) => `${index + 1}. ${item.username}`)
      .join("\n");

    socket.sendRoomMessage(`🤫 Silent Bots:\n${text}`);
    return;
  }

  socket.sendRoomMessage("❌ أمر silent غير صحيح.");
}

module.exports = {
  handleSilentBotCommand,
};
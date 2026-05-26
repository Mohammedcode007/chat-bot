const { updateBotProfileText } = require("./profile.service");
const { makeControllerBotProfile } = require("../../bots/controller/ControllerBotProfile");

function handleProfileCommand(context) {
  const { bot, socket, repository, parsed } = context;

  const action = parsed.args[0];

  if (action === "refresh") {
    socket.updateProfile(makeControllerBotProfile(bot));
    socket.sendRoomMessage("✅ تم تحديث بروفايل البوت.");
    return;
  }

  if (action === "status") {
    const statusText = parsed.args.slice(1).join(" ");

    if (!statusText) {
      socket.sendRoomMessage("❌ الاستخدام: !profile status text");
      return;
    }

    updateBotProfileText(repository, bot.roomName, statusText);
    socket.sendRoomMessage("✅ تم حفظ حالة البروفايل.");
    return;
  }

  socket.sendRoomMessage("❌ أمر profile غير صحيح.");
}

module.exports = {
  handleProfileCommand,
};
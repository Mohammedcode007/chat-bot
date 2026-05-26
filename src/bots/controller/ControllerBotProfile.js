function makeControllerBotProfile(bot) {
  return `
    <div style="font-family:sans-serif;">
      <div style="font-weight:700;font-size:15px;color:#00b4ff;">
        ⚙️ Controller Bot
      </div>

      <div style="font-size:13px;">
        Room: <b>${bot.roomName}</b>
      </div>

      <div style="font-size:13px;">
        Owner: <b>${bot.owner}</b>
      </div>

      <div style="font-size:13px;">
        Masters: <b>${(bot.masters || []).length}</b>
      </div>

      <div style="margin-top:6px;font-size:12px;color:#888;">
        Send !help
      </div>
    </div>
  `;
}

module.exports = {
  makeControllerBotProfile,
};
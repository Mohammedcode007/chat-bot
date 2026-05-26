function getSystemInfo({ repository, bot }) {
  const silentBots = repository.getSilentBotsByRoom(bot.roomName);

  return {
    roomName: bot.roomName,
    owner: bot.owner,
    mastersCount: (bot.masters || []).length,
    silentBotsCount: silentBots.length,
  };
}

module.exports = {
  getSystemInfo,
};
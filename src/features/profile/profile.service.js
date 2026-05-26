function updateBotProfileText(repository, roomName, statusText) {
  return repository.updateControllerBot(roomName, (bot) => {
    return {
      ...bot,
      profile: {
        ...(bot.profile || {}),
        status: statusText,
      },
    };
  });
}

module.exports = {
  updateBotProfileText,
};
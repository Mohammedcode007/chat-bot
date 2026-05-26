const { normalizeUsername } = require("../../utils/text");

function addMaster(repository, roomName, username) {
  let result = {
    updated: false,
    alreadyExists: false,
    bot: null,
  };

  const updatedBot = repository.updateControllerBot(roomName, (bot) => {
    const masters = bot.masters || [];

    const exists = masters.some(
      (master) => normalizeUsername(master) === normalizeUsername(username)
    );

    if (exists) {
      result.alreadyExists = true;
      result.bot = bot;
      return bot;
    }

    masters.push(username);

    result.updated = true;

    const nextBot = {
      ...bot,
      masters,
    };

    result.bot = nextBot;
    return nextBot;
  });

  result.bot = updatedBot || result.bot;

  return result;
}

function removeMaster(repository, roomName, username) {
  let result = {
    updated: false,
    notMaster: false,
    bot: null,
  };

  const updatedBot = repository.updateControllerBot(roomName, (bot) => {
    const masters = bot.masters || [];

    const exists = masters.some(
      (master) => normalizeUsername(master) === normalizeUsername(username)
    );

    if (!exists) {
      result.notMaster = true;
      result.bot = bot;
      return bot;
    }

    const nextMasters = masters.filter(
      (master) => normalizeUsername(master) !== normalizeUsername(username)
    );

    result.updated = true;

    const nextBot = {
      ...bot,
      masters: nextMasters,
    };

    result.bot = nextBot;
    return nextBot;
  });

  result.bot = updatedBot || result.bot;

  return result;
}

module.exports = {
  addMaster,
  removeMaster,
};
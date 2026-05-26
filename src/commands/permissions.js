const { ROLES } = require("../constants/roles");
const { normalizeUsername } = require("../utils/text");

function isOwner(bot, username) {
  return normalizeUsername(bot.owner) === normalizeUsername(username);
}

function isMaster(bot, username) {
  return (bot.masters || []).some(
    (master) => normalizeUsername(master) === normalizeUsername(username)
  );
}

function getUserRole(bot, username) {
  if (isOwner(bot, username)) {
    return ROLES.OWNER;
  }

  if (isMaster(bot, username)) {
    return ROLES.MASTER;
  }

  return ROLES.GUEST;
}

function canUseController(bot, username) {
  return isOwner(bot, username) || isMaster(bot, username);
}

module.exports = {
  isOwner,
  isMaster,
  getUserRole,
  canUseController,
};
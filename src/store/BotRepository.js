const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const controllerBotsStore = new JsonStore(
  path.join(__dirname, "../data/controllerBots.json"),
  []
);

const silentBotsStore = new JsonStore(
  path.join(__dirname, "../data/silentBots.json"),
  []
);

class BotRepository {
  /* =====================================================
     Controller Bots
  ===================================================== */

  getControllerBots() {
    return controllerBotsStore.read();
  }

  saveControllerBots(bots) {
    return controllerBotsStore.write(bots);
  }

  getControllerBotByRoom(roomName) {
    const bots = this.getControllerBots();

    return bots.find(
      (bot) => normalizeUsername(bot.roomName) === normalizeUsername(roomName)
    );
  }

  getControllerBotByUsername(username) {
    const bots = this.getControllerBots();

    return bots.find(
      (bot) => normalizeUsername(bot.username) === normalizeUsername(username)
    );
  }

  addControllerBot(bot) {
    const controllerBots = this.getControllerBots();
    const silentBots = this.getSilentBots();

    const usernameUsedAsController = controllerBots.some(
      (item) =>
        normalizeUsername(item.username) === normalizeUsername(bot.username)
    );

    if (usernameUsedAsController) {
      throw new Error("هذا الحساب مضاف بالفعل كبوت متحكم.");
    }

    const usernameUsedAsSilent = silentBots.some(
      (item) =>
        normalizeUsername(item.username) === normalizeUsername(bot.username)
    );

    if (usernameUsedAsSilent) {
      throw new Error("هذا الحساب موجود كبوت صامت، لا يمكن إضافته كبوت متحكم.");
    }

    const roomHasController = controllerBots.some(
      (item) =>
        normalizeUsername(item.roomName) === normalizeUsername(bot.roomName)
    );

    if (roomHasController) {
      throw new Error("هذه الغرفة لديها بوت متحكم بالفعل.");
    }

    controllerBots.push(bot);
    this.saveControllerBots(controllerBots);

    return bot;
  }

  updateControllerBot(roomName, updater) {
    const bots = this.getControllerBots();

    const index = bots.findIndex(
      (bot) => normalizeUsername(bot.roomName) === normalizeUsername(roomName)
    );

    if (index === -1) {
      return null;
    }

    bots[index] = updater(bots[index]);
    this.saveControllerBots(bots);

    return bots[index];
  }

  removeControllerBot(roomName) {
    const bots = this.getControllerBots();

    const nextBots = bots.filter(
      (bot) => normalizeUsername(bot.roomName) !== normalizeUsername(roomName)
    );

    this.saveControllerBots(nextBots);

    return bots.length !== nextBots.length;
  }

  removeControllerBotByUsername(username) {
    const bots = this.getControllerBots();

    const nextBots = bots.filter(
      (bot) => normalizeUsername(bot.username) !== normalizeUsername(username)
    );

    this.saveControllerBots(nextBots);

    return bots.length !== nextBots.length;
  }

  /* =====================================================
     Silent Bots
  ===================================================== */

  getSilentBots() {
    return silentBotsStore.read();
  }

  saveSilentBots(bots) {
    return silentBotsStore.write(bots);
  }

  getSilentBotByUsername(username) {
    const bots = this.getSilentBots();

    return bots.find(
      (bot) => normalizeUsername(bot.username) === normalizeUsername(username)
    );
  }

  getSilentBotByRoomAndUsername(roomName, username) {
    return this.getSilentBots().find((bot) => {
      const sameRoom =
        normalizeUsername(bot.roomName) === normalizeUsername(roomName);

      const sameUsername =
        normalizeUsername(bot.username) === normalizeUsername(username);

      return sameRoom && sameUsername;
    });
  }

  getSilentBotsByRoom(roomName) {
    return this.getSilentBots().filter(
      (bot) => normalizeUsername(bot.roomName) === normalizeUsername(roomName)
    );
  }

  addSilentBot(bot) {
    const silentBots = this.getSilentBots();
    const controllerBots = this.getControllerBots();

    const usernameUsedAsController = controllerBots.some(
      (item) =>
        normalizeUsername(item.username) === normalizeUsername(bot.username)
    );

    if (usernameUsedAsController) {
      throw new Error("هذا الحساب موجود كبوت متحكم، لا يمكن إضافته كبوت صامت.");
    }

    const usernameUsedAsSilent = silentBots.some(
      (item) =>
        normalizeUsername(item.username) === normalizeUsername(bot.username)
    );

    if (usernameUsedAsSilent) {
      throw new Error("هذا الحساب مضاف بالفعل كبوت صامت.");
    }

    silentBots.push(bot);
    this.saveSilentBots(silentBots);

    return bot;
  }

  removeSilentBot(roomName, username) {
    const bots = this.getSilentBots();

    const nextBots = bots.filter((bot) => {
      const sameRoom =
        normalizeUsername(bot.roomName) === normalizeUsername(roomName);

      const sameUsername =
        normalizeUsername(bot.username) === normalizeUsername(username);

      return !(sameRoom && sameUsername);
    });

    this.saveSilentBots(nextBots);

    return bots.length !== nextBots.length;
  }

  removeSilentBotByUsername(username) {
    const bots = this.getSilentBots();

    const nextBots = bots.filter(
      (bot) => normalizeUsername(bot.username) !== normalizeUsername(username)
    );

    this.saveSilentBots(nextBots);

    return bots.length !== nextBots.length;
  }

  removeSilentBotsByRoom(roomName) {
    const bots = this.getSilentBots();

    const nextBots = bots.filter(
      (bot) => normalizeUsername(bot.roomName) !== normalizeUsername(roomName)
    );

    this.saveSilentBots(nextBots);

    return bots.length - nextBots.length;
  }
}

module.exports = {
  BotRepository,
};
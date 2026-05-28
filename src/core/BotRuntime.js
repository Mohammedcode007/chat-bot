const { BotRepository } = require("../store/BotRepository");
const { ConnectionRegistry } = require("./ConnectionRegistry");

const { AdminBot } = require("../bots/admin/AdminBot");
const { ControllerBot } = require("../bots/controller/ControllerBot");
const { SilentBot } = require("../bots/silent/SilentBot");
const { MusicBot } = require("../bots/music/MusicBot");

const { MusicRoomsRepository } = require("../store/MusicRoomsRepository");
const { BOT_TYPES } = require("../constants/botTypes");

class BotRuntime {
  constructor() {
    this.repository = new BotRepository();
    this.registry = new ConnectionRegistry();

    this.musicRoomsRepository = new MusicRoomsRepository();

    this.adminBot = null;
  }

  start() {
    console.log("🚀 Starting chat bot runtime...");

    this.startAdminBot();

    const controllerBots = this.repository.getControllerBots();
    const silentBots = this.repository.getSilentBots();
    const musicRooms = this.musicRoomsRepository.getRooms();

    controllerBots.forEach((bot) => {
      this.connectControllerBot(bot);
    });

    silentBots.forEach((bot) => {
      this.connectSilentBot(bot);
    });

    musicRooms.forEach((room) => {
      const roomName = room.roomName || room;

      if (roomName) {
        this.connectMusicBot(roomName);
      }
    });

    console.log(`📩 Admin bot: enabled`);
    console.log(`⚙️ Controller bots: ${controllerBots.length}`);
    console.log(`🤫 Silent bots: ${silentBots.length}`);
    console.log(`🎵 Music rooms: ${musicRooms.length}`);
  }

  startAdminBot() {
    if (this.adminBot) {
      return;
    }

    this.adminBot = new AdminBot({
      repository: this.repository,
      runtime: this,
    });

    this.adminBot.start();
  }

  /* =====================================================
     Controller Bots
  ===================================================== */

  connectControllerBot(bot) {
    const exists = this.registry.has(
      BOT_TYPES.CONTROLLER,
      bot.roomName,
      bot.username
    );

    if (exists) {
      console.log(
        `⚠️ Controller already connected: ${bot.username} -> ${bot.roomName}`
      );
      return;
    }

    const instance = new ControllerBot({
      bot,
      repository: this.repository,
      runtime: this,
    });

    this.registry.set(
      BOT_TYPES.CONTROLLER,
      bot.roomName,
      bot.username,
      instance
    );

    instance.start();
  }

  disconnectControllerBot(roomName, username) {
    const instance = this.registry.get(
      BOT_TYPES.CONTROLLER,
      roomName,
      username
    );

    if (!instance) {
      console.log(
        `⚠️ Controller instance not found: ${username} -> ${roomName}`
      );
      return false;
    }

    instance.stop();

    this.registry.remove(BOT_TYPES.CONTROLLER, roomName, username);

    console.log(`🛑 Controller disconnected: ${username} -> ${roomName}`);

    return true;
  }

  /* =====================================================
     Silent Bots
  ===================================================== */

  connectSilentBot(bot) {
    const exists = this.registry.has(
      BOT_TYPES.SILENT,
      bot.roomName,
      bot.username
    );

    if (exists) {
      console.log(
        `⚠️ Silent already connected: ${bot.username} -> ${bot.roomName}`
      );
      return;
    }

    const instance = new SilentBot({
      bot,
    });

    this.registry.set(BOT_TYPES.SILENT, bot.roomName, bot.username, instance);

    instance.start();
  }

  disconnectSilentBot(roomName, username) {
    const instance = this.registry.get(BOT_TYPES.SILENT, roomName, username);

    if (!instance) {
      console.log(`⚠️ Silent instance not found: ${username} -> ${roomName}`);
      return false;
    }

    instance.stop();

    this.registry.remove(BOT_TYPES.SILENT, roomName, username);

    console.log(`🛑 Silent disconnected: ${username} -> ${roomName}`);

    return true;
  }

  disconnectSilentBotsByRoom(roomName) {
    const silentBots = this.repository.getSilentBotsByRoom(roomName);
    let count = 0;

    silentBots.forEach((bot) => {
      const stopped = this.disconnectSilentBot(bot.roomName, bot.username);

      if (stopped) {
        count += 1;
      }
    });

    return count;
  }

  /* =====================================================
     Music Bot
  ===================================================== */

  makeMusicKey(roomName) {
    return `music:${String(roomName || "").trim()}`.toLowerCase();
  }

  connectMusicBot(roomName) {
    const cleanRoomName = String(roomName || "").trim();

    if (!cleanRoomName) {
      console.log("⚠️ connectMusicBot ignored: missing roomName");
      return false;
    }

    const key = this.makeMusicKey(cleanRoomName);

    if (this.registry.connections.has(key)) {
      console.log(`⚠️ Music bot already connected -> ${cleanRoomName}`);
      return false;
    }

    const instance = new MusicBot({
      roomName: cleanRoomName,
      runtime: this,
    });

    this.registry.connections.set(key, instance);

    instance.start();

    console.log(`🎵 Music bot connecting -> ${cleanRoomName}`);

    return true;
  }

  disconnectMusicBot(roomName) {
    const cleanRoomName = String(roomName || "").trim();

    if (!cleanRoomName) {
      return false;
    }

    const key = this.makeMusicKey(cleanRoomName);
    const instance = this.registry.connections.get(key);

    if (!instance) {
      console.log(`⚠️ Music bot instance not found -> ${cleanRoomName}`);
      return false;
    }

    instance.stop();
    this.registry.connections.delete(key);

    console.log(`🛑 Music bot disconnected -> ${cleanRoomName}`);

    return true;
  }
hasControllerBot(roomName) {
  const bot = this.repository.getControllerBotByRoom(roomName);
  return Boolean(bot);
}
  hasMusicBot(roomName) {
    const key = this.makeMusicKey(roomName);

    return this.registry.connections.has(key);
  }

  broadcastMusicMessage(text) {
    if (!this.registry.connections) {
      return;
    }

    for (const [key, instance] of this.registry.connections.entries()) {
      if (
        key.startsWith("music:") &&
        instance &&
        typeof instance.sendRoomMessage === "function"
      ) {
        instance.sendRoomMessage(text);
      }
    }
  }

  sendMusicMessageToRoom(roomName, text) {
    const key = this.makeMusicKey(roomName);
    const instance = this.registry.connections.get(key);

    if (!instance || typeof instance.sendRoomMessage !== "function") {
      return false;
    }

    instance.sendRoomMessage(text);
    return true;
  }
  broadcastSongToMusicOrController(text) {
    if (!text || !this.registry || !this.registry.connections) {
      return {
        sent: 0,
        music: 0,
        controller: 0,
      };
    }

    const sentRooms = new Set();

    let musicCount = 0;
    let controllerCount = 0;

    /*
      First priority: Music bots
    */
    for (const [key, instance] of this.registry.connections.entries()) {
      if (!key.startsWith("music:")) {
        continue;
      }

      if (!instance || typeof instance.sendRoomMessage !== "function") {
        continue;
      }

      const roomName = String(key.replace(/^music:/i, "")).trim().toLowerCase();

      if (!roomName) {
        continue;
      }

      instance.sendRoomMessage(text);

      sentRooms.add(roomName);
      musicCount += 1;
    }

    /*
      Second priority: Controller bots
      Only rooms that did NOT receive message from music bot
    */
    for (const [key, instance] of this.registry.connections.entries()) {
      if (!key.startsWith(`${BOT_TYPES.CONTROLLER}:`)) {
        continue;
      }

      if (!instance || typeof instance.sendRoomMessage !== "function") {
        continue;
      }

      const parts = String(key).split(":");

      /*
        Expected key from ConnectionRegistry:
        controller:roomName:username
      */
      const roomName = String(parts[1] || "").trim().toLowerCase();

      if (!roomName) {
        continue;
      }

      if (sentRooms.has(roomName)) {
        continue;
      }

      instance.sendRoomMessage(text);

      sentRooms.add(roomName);
      controllerCount += 1;
    }

    return {
      sent: sentRooms.size,
      music: musicCount,
      controller: controllerCount,
    };
  }
  /* =====================================================
     Stop Runtime
  ===================================================== */

  stop() {
    if (this.adminBot) {
      this.adminBot.stop();
      this.adminBot = null;
    }

    this.registry.stopAll();
  }
}

module.exports = {
  BotRuntime,
};
const fs = require("fs");
const path = require("path");

const { BotRepository } = require("../store/BotRepository");
const { ConnectionRegistry } = require("./ConnectionRegistry");

const { AdminBot } = require("../bots/admin/AdminBot");
const { ControllerBot } = require("../bots/controller/ControllerBot");
const { SilentBot } = require("../bots/silent/SilentBot");
const { MusicBot } = require("../bots/music/MusicBot");

const { MusicRoomsRepository } = require("../store/MusicRoomsRepository");
const { BOT_TYPES } = require("../constants/botTypes");

const BLOCKED_BOT_ROOMS_FILE = path.join(
  process.cwd(),
  "src/data/blockedBotRooms.json"
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function readBlockedBotRooms() {
  try {
    if (!fs.existsSync(BLOCKED_BOT_ROOMS_FILE)) {
      fs.writeFileSync(BLOCKED_BOT_ROOMS_FILE, "[]", "utf8");
    }

    const data = JSON.parse(fs.readFileSync(BLOCKED_BOT_ROOMS_FILE, "utf8"));

    if (!Array.isArray(data)) {
      return [];
    }

    return data;
  } catch (err) {
    console.log("❌ [READ_BLOCKED_BOT_ROOMS_ERROR]", err.message);
    return [];
  }
}

function writeBlockedBotRooms(items) {
  fs.writeFileSync(
    BLOCKED_BOT_ROOMS_FILE,
    JSON.stringify(items, null, 2),
    "utf8"
  );
}

class BotRuntime {
  constructor() {
    this.repository = new BotRepository();
    this.registry = new ConnectionRegistry();

    this.musicRoomsRepository = new MusicRoomsRepository();

    this.adminBot = null;

    this.botStartDelayMs = Number(process.env.BOT_START_DELAY_MS || 30000);

    /*
      BLOCKED_ROOM_RETRY_ON_STARTUP=1
      يعني بعد restart يجرب يدخل الغرفة مرة واحدة حتى لو محفوظة محظورة.
      لو دخل بنجاح، bot file يحذفها من blockedBotRooms.json.
      لو اترفضت، تتحفظ مرة أخرى ولا يعيد المحاولة في نفس التشغيل.

      BLOCKED_ROOM_RETRY_ON_STARTUP=0
      يعني لا يجرب الغرف المحفوظة محظورة.
    */
    this.blockedRetryOnStartup =
      process.env.BLOCKED_ROOM_RETRY_ON_STARTUP !== "0";

    this.startQueue = [];
    this.startQueueRunning = false;
    this.runtimeStopped = false;
  }

  addToStartQueue(label, startFn) {
    this.startQueue.push({
      label,
      startFn,
    });

    this.runStartQueue();

    return true;
  }

  async runStartQueue() {
    if (this.startQueueRunning) {
      return;
    }

    this.startQueueRunning = true;

    while (this.startQueue.length > 0) {
      if (this.runtimeStopped) {
        this.startQueue = [];
        break;
      }

      const item = this.startQueue.shift();

      try {
        console.log("⏳ [BOT_START_QUEUE_WAIT]", {
          bot: item.label,
          delayMs: this.botStartDelayMs,
          remaining: this.startQueue.length,
        });

        await sleep(this.botStartDelayMs);

        if (this.runtimeStopped) {
          break;
        }

        console.log("🚀 [BOT_START_QUEUE_START]", item.label);

        item.startFn();
      } catch (err) {
        console.log("❌ [BOT_START_QUEUE_ERROR]", {
          bot: item.label,
          error: err.message,
        });
      }
    }

    this.startQueueRunning = false;
  }

  start() {
    console.log("🚀 Starting chat bot runtime...");

    this.runtimeStopped = false;

    const controllerBots = this.repository.getControllerBots();
    const silentBots = this.repository.getSilentBots();
    const musicRooms = this.musicRoomsRepository.getRooms();

    /*
      مهم:
      حتى admin لا يدخل فورًا.
      كل شيء يدخل من queue.
    */
    this.addToStartQueue("admin:tebot", () => {
      this.startAdminBot();
    });

    controllerBots.forEach((bot) => {
      this.addToStartQueue(
        `controller:${bot.username}->${bot.roomName}`,
        () => {
          this.connectControllerBot(bot);
        }
      );
    });

    silentBots.forEach((bot) => {
      this.addToStartQueue(
        `silent:${bot.username}->${bot.roomName}`,
        () => {
          this.connectSilentBot(bot);
        }
      );
    });

    /*
      Music bot لا يدخل كل الغرف عند تشغيل السيرفر.

      MAX_MUSIC_STARTUP_ROOMS=0
      يعني لا يدخل أي غرفة موسيقى تلقائيًا عند التشغيل.
    */
    const maxMusicStartupRooms = Number(
      process.env.MAX_MUSIC_STARTUP_ROOMS || 0
    );

    const startupMusicRooms =
      maxMusicStartupRooms > 0
        ? musicRooms.slice(0, maxMusicStartupRooms)
        : [];

    startupMusicRooms.forEach((room) => {
      const roomName = room.roomName || room;

      if (roomName) {
        this.addToStartQueue(`music:${roomName}`, () => {
          this.connectMusicBot(roomName);
        });
      }
    });

    console.log(`📩 Admin bot: queued`);
    console.log(`⚙️ Controller bots: ${controllerBots.length}`);
    console.log(`🤫 Silent bots: ${silentBots.length}`);
    console.log(`🎵 Music rooms saved: ${musicRooms.length}`);
    console.log(`🎵 Music rooms queued on startup: ${startupMusicRooms.length}`);
    console.log(`⏱️ Bot start delay: ${this.botStartDelayMs}ms`);
    console.log(
      `🔄 Blocked room retry on startup: ${
        this.blockedRetryOnStartup ? "enabled" : "disabled"
      }`
    );
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

  isBotRoomBlocked({ type, username, roomName }) {
    const items = readBlockedBotRooms();

    const cleanType = normalizeKey(type);
    const cleanUsername = normalizeKey(username);
    const cleanRoomName = normalizeKey(roomName);

    return items.some((item) => {
      return (
        normalizeKey(item.type) === cleanType &&
        normalizeKey(item.username) === cleanUsername &&
        normalizeKey(item.roomName) === cleanRoomName
      );
    });
  }

  markBotRoomBlocked({ type, username, roomName, reason }) {
    const cleanType = String(type || "").trim();
    const cleanUsername = String(username || "").trim();
    const cleanRoomName = String(roomName || "").trim();
    const cleanReason = String(reason || "room_unauthorized").trim();

    if (!cleanType || !cleanUsername || !cleanRoomName) {
      return false;
    }

    const items = readBlockedBotRooms();

    const exists = items.some((item) => {
      return (
        normalizeKey(item.type) === normalizeKey(cleanType) &&
        normalizeKey(item.username) === normalizeKey(cleanUsername) &&
        normalizeKey(item.roomName) === normalizeKey(cleanRoomName)
      );
    });

    if (!exists) {
      items.push({
        type: cleanType,
        username: cleanUsername,
        roomName: cleanRoomName,
        reason: cleanReason,
        savedAt: new Date().toISOString(),
      });

      writeBlockedBotRooms(items);
    }

    console.log("🚫 [BOT_ROOM_BLOCKED_SAVED]", {
      type: cleanType,
      username: cleanUsername,
      roomName: cleanRoomName,
      reason: cleanReason,
    });

    if (cleanType === BOT_TYPES.CONTROLLER || cleanType === "controller") {
      this.disconnectControllerBot(cleanRoomName, cleanUsername);
    }

    if (cleanType === BOT_TYPES.SILENT || cleanType === "silent") {
      this.disconnectSilentBot(cleanRoomName, cleanUsername);
    }

    if (cleanType === "music") {
      this.disconnectMusicBot(cleanRoomName);
    }

    return true;
  }

  removeBotRoomBlocked({ type, username, roomName }) {
    const cleanType = normalizeKey(type);
    const cleanUsername = normalizeKey(username);
    const cleanRoomName = normalizeKey(roomName);

    if (!cleanType || !cleanUsername || !cleanRoomName) {
      return false;
    }

    const items = readBlockedBotRooms();

    const nextItems = items.filter((item) => {
      return !(
        normalizeKey(item.type) === cleanType &&
        normalizeKey(item.username) === cleanUsername &&
        normalizeKey(item.roomName) === cleanRoomName
      );
    });

    if (nextItems.length !== items.length) {
      writeBlockedBotRooms(nextItems);

      console.log("✅ [BOT_ROOM_BLOCKED_REMOVED]", {
        type,
        username,
        roomName,
      });

      return true;
    }

    return false;
  }

  isRoomRejectEvent(data) {
    if (!data || data.handler !== "room_event") {
      return false;
    }

    const type = String(data.type || "").trim().toLowerCase();

    return [
      "room_unauthorized",
      "room_membership_required",
      "room_banned",
      "banned",
      "blocked",
      "outcast",
    ].includes(type);
  }

  connectControllerBot(bot) {
    if (
      this.isBotRoomBlocked({
        type: BOT_TYPES.CONTROLLER,
        username: bot.username,
        roomName: bot.roomName,
      })
    ) {
      if (!this.blockedRetryOnStartup) {
        console.log(
          `🚫 Controller skipped blocked room: ${bot.username} -> ${bot.roomName}`
        );
        return false;
      }

      console.log(
        `🔄 Controller retry blocked room after restart: ${bot.username} -> ${bot.roomName}`
      );
    }

    const exists = this.registry.has(
      BOT_TYPES.CONTROLLER,
      bot.roomName,
      bot.username
    );

    if (exists) {
      console.log(
        `⚠️ Controller already connected: ${bot.username} -> ${bot.roomName}`
      );
      return false;
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

    return true;
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

  connectSilentBot(bot) {
    if (
      this.isBotRoomBlocked({
        type: BOT_TYPES.SILENT,
        username: bot.username,
        roomName: bot.roomName,
      })
    ) {
      if (!this.blockedRetryOnStartup) {
        console.log(
          `🚫 Silent skipped blocked room: ${bot.username} -> ${bot.roomName}`
        );
        return false;
      }

      console.log(
        `🔄 Silent retry blocked room after restart: ${bot.username} -> ${bot.roomName}`
      );
    }

    const exists = this.registry.has(
      BOT_TYPES.SILENT,
      bot.roomName,
      bot.username
    );

    if (exists) {
      console.log(
        `⚠️ Silent already connected: ${bot.username} -> ${bot.roomName}`
      );
      return false;
    }

    const instance = new SilentBot({
      bot,
      runtime: this,
    });

    this.registry.set(BOT_TYPES.SILENT, bot.roomName, bot.username, instance);

    instance.start();

    return true;
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

  makeMusicKey(roomName) {
    return `music:${String(roomName || "").trim()}`.toLowerCase();
  }

  connectMusicBot(roomName) {
    const cleanRoomName = String(roomName || "").trim();

    if (!cleanRoomName) {
      console.log("⚠️ connectMusicBot ignored: missing roomName");
      return false;
    }

    if (
      this.isBotRoomBlocked({
        type: "music",
        username: "music_dj",
        roomName: cleanRoomName,
      })
    ) {
      if (!this.blockedRetryOnStartup) {
        console.log(`🚫 Music skipped blocked room: music_dj -> ${cleanRoomName}`);
        return false;
      }

      console.log(
        `🔄 Music retry blocked room after restart: music_dj -> ${cleanRoomName}`
      );
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

    for (const [key, instance] of this.registry.connections.entries()) {
      if (!key.startsWith(`${BOT_TYPES.CONTROLLER}:`)) {
        continue;
      }

      if (!instance || typeof instance.sendRoomMessage !== "function") {
        continue;
      }

      const parts = String(key).split(":");
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

  stop() {
    this.runtimeStopped = true;

    if (this.adminBot) {
      this.adminBot.stop();
      this.adminBot = null;
    }

    this.startQueue = [];
    this.startQueueRunning = false;

    this.registry.stopAll();
  }
}

module.exports = {
  BotRuntime,
};
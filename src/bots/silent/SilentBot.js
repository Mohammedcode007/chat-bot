const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const { makeSilentBotProfile } = require("./SilentBotProfile");
const { handleSilentBotMessage } = require("./SilentBotEvents");

class SilentBot {
  constructor({ bot }) {
    this.bot = bot;
    this.socket = null;
    this.stopped = false;
    this.reconnectManager = new ReconnectManager();
  }

  start() {
    this.stopped = false;

    this.socket = new SocketClient({
      username: this.bot.username,
      password: this.bot.password,
      roomName: this.bot.roomName,
      type: "silent",
    });

    this.socket.onOpen(() => {
      console.log(`✅ Silent connected: ${this.bot.username} -> ${this.bot.roomName}`);

      setTimeout(() => {
        this.socket.joinRoom();
        this.socket.updateProfile(makeSilentBotProfile(this.bot));
      }, 1000);
    });

    this.socket.onMessage((data) => {
      handleSilentBotMessage(data);
    });

    this.socket.onClose((code, reason) => {
      console.log(
        `❌ Silent disconnected: ${this.bot.username}`,
        code,
        String(reason || "")
      );

      if (!this.stopped) {
        this.reconnectManager.scheduleReconnect(() => this.start());
      }
    });

    this.socket.onError((error) => {
      console.log(`⚠️ Silent error ${this.bot.username}:`, error.message);
    });

    this.socket.connect();
  }

  stop() {
    this.stopped = true;

    if (this.socket) {
      this.socket.close();
    }
  }
}

module.exports = {
  SilentBot,
};
const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const { makeSilentBotProfile } = require("./SilentBotProfile");
const { handleSilentBotMessage } = require("./SilentBotEvents");
const { extractRoomUserEvent } = require("../controller/ControllerBotEvents");
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
      this.handleMessage(data);
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
  handleMessage(data) {
    handleSilentBotMessage(data);
    this.handleRoomUserJoinOrLeave(data);
  }

  isSameBotUsername(username) {
    const a = String(username || "").trim().toLowerCase();
    const b = String(this.bot.username || "").trim().toLowerCase();

    return a && b && a === b;
  }

  rejoinRoom(reason = "unknown") {
    if (this.stopped || !this.socket) {
      return;
    }

    console.log("🔁 [SILENT_AUTO_REJOIN]", {
      username: this.bot.username,
      room: this.bot.roomName,
      reason,
    });

    setTimeout(() => {
      if (this.stopped || !this.socket) {
        return;
      }

      this.socket.joinRoom(this.bot.roomName);

      setTimeout(() => {
        if (this.stopped || !this.socket) {
          return;
        }

        this.socket.updateProfile(makeSilentBotProfile(this.bot));
      }, 1000);
    }, 1500);
  }

  handleRoomUserJoinOrLeave(data) {
    const event = extractRoomUserEvent(data);

    if (!event) {
      return;
    }

    if (event.action !== "leave") {
      return;
    }

    if (this.isSameBotUsername(event.username)) {
      this.rejoinRoom("silent_left_or_kicked");
    }
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
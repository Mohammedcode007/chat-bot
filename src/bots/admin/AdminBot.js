const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const {
  ADMIN_BOT_USERNAME,
  ADMIN_BOT_PASSWORD,
} = require("../../config/env");

const {
  extractAdminMessage,
  isPrivateMessage,
} = require("./AdminBotEvents");

const { handleAdminCommand } = require("./AdminBotCommands");

class AdminBot {
  constructor({ repository, runtime }) {
    this.repository = repository;
    this.runtime = runtime;

    this.socket = null;
    this.stopped = false;
    this.reconnectManager = new ReconnectManager();
  }

  start() {
    this.stopped = false;

    this.socket = new SocketClient({
      username: ADMIN_BOT_USERNAME,
      password: ADMIN_BOT_PASSWORD,
      roomName: null,
      type: "admin",
    });

    this.socket.onOpen(() => {
      console.log(`✅ Admin bot connected: ${ADMIN_BOT_USERNAME}`);

      // بروفايل قصير جدًا حتى لا يغلق السيرفر الاتصال بسبب الحجم
      this.socket.updateProfile("te-bot Admin | send help");
    });

    this.socket.onMessage((data) => {
      this.handleMessage(data);
    });

    this.socket.onClose((code, reason) => {
      console.log(
        `❌ Admin bot disconnected: ${ADMIN_BOT_USERNAME}`,
        code,
        String(reason || "")
      );

      if (!this.stopped) {
        this.reconnectManager.scheduleReconnect(() => {
          this.start();
        });
      }
    });

    this.socket.onError((error) => {
      console.log("⚠️ Admin bot error:", error.message);
    });

    this.socket.connect();
  }

  handleMessage(data) {
    if (!isPrivateMessage(data)) {
      return;
    }

    const incoming = extractAdminMessage(data);

    if (!incoming.text || !incoming.sender) {
      return;
    }

    // لا تطبع raw هنا لأنه أحيانًا يكون كبير جدًا
    console.log("📩 [ADMIN_COMMAND]", {
      from: incoming.sender,
      text: incoming.text,
    });

    handleAdminCommand({
      sender: incoming.sender,
      text: incoming.text,
      socket: this.socket,
      repository: this.repository,
      runtime: this.runtime,
    });
  }

  stop() {
    this.stopped = true;

    if (this.socket) {
      this.socket.close();
    }
  }
}

module.exports = {
  AdminBot,
};
const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const { makeSilentBotProfile } = require("./SilentBotProfile");
const { handleSilentBotMessage } = require("./SilentBotEvents");
const { extractRoomUserEvent } = require("../controller/ControllerBotEvents");

class SilentBot {
  constructor({ bot, runtime }) {
    this.bot = bot;
    this.runtime = runtime;

    this.socket = null;
    this.stopped = false;
    this.blockedFromRoom = false;

    this.reconnectManager = new ReconnectManager();
  }

  start() {
    this.stopped = false;
    this.blockedFromRoom = false;

    this.socket = new SocketClient({
      username: this.bot.username,
      password: this.bot.password,
      roomName: this.bot.roomName,
      type: "silent",
    });

    this.socket.onOpen(() => {
      console.log(
        `✅ Silent connected: ${this.bot.username} -> ${this.bot.roomName}`
      );

      setTimeout(() => {
        if (this.stopped || this.blockedFromRoom || !this.socket) {
          return;
        }

        /*
          مهم:
          لا نمنع الدخول هنا لو الغرفة موجودة في blockedBotRooms.json.
          لأن BotRuntime هو الذي يقرر:
          - يجرب بعد restart لو BLOCKED_ROOM_RETRY_ON_STARTUP=1
          - أو يمنع الدخول لو BLOCKED_ROOM_RETRY_ON_STARTUP=0

          لو الحظر مازال موجود، السيرفر سيرسل room_unauthorized
          وسنحفظه مرة أخرى ونوقف المحاولة.
        */
        console.log(`🚪 Silent trying to join room: ${this.bot.roomName}`);

        this.socket.joinRoom(this.bot.roomName);

        setTimeout(() => {
          if (this.stopped || this.blockedFromRoom || !this.socket) {
            return;
          }

          this.socket.updateProfile(makeSilentBotProfile(this.bot));
        }, 1000);
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

      /*
        لو الحساب محظور/مرفوض من الغرفة لا تعمل reconnect.
      */
      if (this.blockedFromRoom) {
        console.log("🚫 [SILENT_NO_RECONNECT_BLOCKED_ROOM]", {
          username: this.bot.username,
          roomName: this.bot.roomName,
        });
        return;
      }

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
    /*
      أول شيء:
      لو السيرفر رفض دخول الغرفة، احفظ الحساب+الغرفة
      ولا تكمل rejoin.
    */
    if (this.handleRoomReject(data)) {
      return;
    }

    /*
      لو دخل بنجاح بعد restart والحظر كان اتفك،
      احذف الحساب+الغرفة من blockedBotRooms.json.
    */
    this.handleRoomJoinSuccess(data);

    handleSilentBotMessage(data);
    this.handleRoomUserJoinOrLeave(data);
  }

  handleRoomReject(data) {
    if (
      !this.runtime ||
      typeof this.runtime.isRoomRejectEvent !== "function" ||
      typeof this.runtime.markBotRoomBlocked !== "function"
    ) {
      return false;
    }

    if (!this.runtime.isRoomRejectEvent(data)) {
      return false;
    }

    const roomName = data.name || this.bot.roomName;
    const reason = data.type || "room_rejected";

    this.blockedFromRoom = true;
    this.stopped = true;

    console.log("🚫 [SILENT_ROOM_REJECTED]", {
      username: this.bot.username,
      roomName,
      reason,
      data,
    });

    this.runtime.markBotRoomBlocked({
      type: "silent",
      username: this.bot.username,
      roomName,
      reason,
    });

    if (this.socket) {
      this.socket.close();
    }

    return true;
  }

  handleRoomJoinSuccess(data) {
    if (
      data &&
      data.handler === "room_event" &&
      data.type === "you_joined" &&
      this.runtime &&
      typeof this.runtime.removeBotRoomBlocked === "function"
    ) {
      const roomName = data.name || this.bot.roomName;

      this.runtime.removeBotRoomBlocked({
        type: "silent",
        username: this.bot.username,
        roomName,
      });
    }
  }

  isSameBotUsername(username) {
    const a = String(username || "").trim().toLowerCase();
    const b = String(this.bot.username || "").trim().toLowerCase();

    return a && b && a === b;
  }

  rejoinRoom(reason = "unknown") {
    if (this.stopped || this.blockedFromRoom || !this.socket) {
      return;
    }

    /*
      داخل نفس التشغيل:
      لو اتحفظ محظور من الغرفة، لا يعيد الدخول.
    */
    if (
      this.runtime &&
      typeof this.runtime.isBotRoomBlocked === "function" &&
      this.runtime.isBotRoomBlocked({
        type: "silent",
        username: this.bot.username,
        roomName: this.bot.roomName,
      })
    ) {
      console.log("🚫 [SILENT_REJOIN_SKIPPED_BLOCKED_ROOM]", {
        username: this.bot.username,
        roomName: this.bot.roomName,
      });

      this.blockedFromRoom = true;
      this.stopped = true;

      if (this.socket) {
        this.socket.close();
      }

      return;
    }

    console.log("🔁 [SILENT_AUTO_REJOIN]", {
      username: this.bot.username,
      room: this.bot.roomName,
      reason,
    });

    setTimeout(() => {
      if (this.stopped || this.blockedFromRoom || !this.socket) {
        return;
      }

      this.socket.joinRoom(this.bot.roomName);

      setTimeout(() => {
        if (this.stopped || this.blockedFromRoom || !this.socket) {
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
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
    this.loginFailed = false;
    this.joined = false;

    this.reconnectManager = new ReconnectManager();
  }

  start() {
    this.stopped = false;
    this.blockedFromRoom = false;
    this.loginFailed = false;
    this.joined = false;

    this.socket = new SocketClient({
      username: this.bot.username,
      password: this.bot.password,
      roomName: this.bot.roomName,
      type: "silent",
    });

    /*
      مهم:
      لا تعمل join هنا.
      onOpen معناه السوكيت فتح فقط، وليس أن login نجح.
      الدخول للغرفة سيتم بعد login_event success فقط.
    */
    this.socket.onOpen(() => {
      console.log(
        `✅ Silent socket opened: ${this.bot.username} -> ${this.bot.roomName}`
      );
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

      if (this.blockedFromRoom) {
        console.log("🚫 [SILENT_NO_RECONNECT_BLOCKED_ROOM]", {
          username: this.bot.username,
          roomName: this.bot.roomName,
        });
        return;
      }

      if (this.loginFailed) {
        console.log("🚫 [SILENT_NO_RECONNECT_LOGIN_FAILED]", {
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
      لو login فشل، لا تعمل join ولا profile_update.
    */
    if (this.handleLoginFailed(data)) {
      return;
    }

    /*
      بعد login success فقط يدخل الغرفة.
    */
    this.handleLoginSuccess(data);

    /*
      لو السيرفر رفض دخول الغرفة، احفظ الحساب + الغرفة
      ولا تكمل rejoin.
    */
    if (this.handleRoomReject(data)) {
      return;
    }

    /*
      لو دخل بنجاح بعد restart والحظر كان اتفك،
      احذف الحساب + الغرفة من blockedBotRooms.json.
    */
    this.handleRoomJoinSuccess(data);

    handleSilentBotMessage(data);
    this.handleRoomUserJoinOrLeave(data);
  }

  handleLoginFailed(data) {
    if (
      data &&
      data.handler === "login_event" &&
      data.type === "failed"
    ) {
      this.loginFailed = true;
      this.stopped = true;

      console.log("❌ [SILENT_LOGIN_FAILED_STOPPED]", {
        username: this.bot.username,
        roomName: this.bot.roomName,
        reason: data.reason || "unknown",
      });

      if (this.socket) {
        this.socket.close();
      }

      return true;
    }

    return false;
  }

  handleLoginSuccess(data) {
    if (
      data &&
      data.handler === "login_event" &&
      data.type === "success" &&
      !this.joined
    ) {
      this.joined = true;

      console.log(`🔑 Login success for silent: ${this.bot.username}`);

      setTimeout(() => {
        if (
          this.stopped ||
          this.loginFailed ||
          this.blockedFromRoom ||
          !this.socket
        ) {
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
          if (
            this.stopped ||
            this.loginFailed ||
            this.blockedFromRoom ||
            !this.socket
          ) {
            return;
          }

          this.socket.updateProfile(makeSilentBotProfile(this.bot));
        }, 1000);
      }, 1000);

      return true;
    }

    return false;
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
    if (
      this.stopped ||
      this.loginFailed ||
      this.blockedFromRoom ||
      !this.socket
    ) {
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
      if (
        this.stopped ||
        this.loginFailed ||
        this.blockedFromRoom ||
        !this.socket
      ) {
        return;
      }

      this.socket.joinRoom(this.bot.roomName);

      setTimeout(() => {
        if (
          this.stopped ||
          this.loginFailed ||
          this.blockedFromRoom ||
          !this.socket
        ) {
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
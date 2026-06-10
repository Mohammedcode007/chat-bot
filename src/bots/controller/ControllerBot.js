const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const { makeControllerBotProfile } = require("./ControllerBotProfile");

const {
  handleAutoPunishOnJoin,
} = require("../../features/autoPunish/autoPunish.guard");

const {
  handleLogsPrivateCommand,
} = require("../../features/logs/logs.commands");

const {
  extractIncomingMessage,
  extractRoomUserEvent,
  extractRoomUsersSnapshot,
} = require("./ControllerBotEvents");

const {
  notifyWatchersOnJoin,
} = require("../../features/watch/watch.commands");

const { handleCommand } = require("../../commands/commandRouter");

const {
  handleAutoBanRoleNoneOnJoin,
  handleWelcomeOnJoin,
  shouldBlockLink,
  checkAntiSpam,
  containsBadWord,
} = require("../../features/roomSettings/roomSettings.guard");

const { RoomUsersRepository } = require("../../store/RoomUsersRepository");

class ControllerBot {
  constructor({ bot, repository, runtime }) {
    this.bot = bot;
    this.repository = repository;
    this.runtime = runtime;

    this.socket = null;
    this.stopped = false;
    this.joined = false;
    this.blockedFromRoom = false;

    this.reconnectManager = new ReconnectManager();
    this.roomUsersRepository = new RoomUsersRepository();
  }

  start() {
    this.stopped = false;
    this.joined = false;
    this.blockedFromRoom = false;

    this.socket = new SocketClient({
      username: this.bot.username,
      password: this.bot.password,
      roomName: this.bot.roomName,
      type: "controller",
    });

    this.socket.onOpen(() => {
      console.log(
        `✅ Controller socket opened: ${this.bot.username} -> ${this.bot.roomName}`
      );
    });

    this.socket.onMessage((data) => {
      this.handleMessage(data);
    });

    this.socket.onClose((code, reason) => {
      console.log(
        `❌ Controller disconnected: ${this.bot.username}`,
        code,
        String(reason || "")
      );

      this.joined = false;

      /*
        لو الحساب اترفض من الغرفة، لا تعمل reconnect داخل نفس التشغيل.
        بعد pm2 restart سيجرب مرة واحدة حسب BotRuntime.
      */
      if (this.blockedFromRoom) {
        console.log("🚫 [CONTROLLER_NO_RECONNECT_BLOCKED_ROOM]", {
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
      console.log(`⚠️ Controller error ${this.bot.username}:`, error.message);
    });

    this.socket.connect();
  }

  handleMessage(data) {
    /*
      أول شيء:
      لو السيرفر رفض دخول الغرفة، احفظ الحساب + الغرفة
      ولا تكمل أوامر أو rejoin.
    */
    if (this.handleRoomReject(data)) {
      return;
    }

    /*
      لو دخل بنجاح بعد restart والحظر كان اتفك،
      احذف الحساب + الغرفة من blockedBotRooms.json.
    */
    this.handleRoomJoinSuccess(data);

    const handledPrivateLogs = handleLogsPrivateCommand({
      bot: this.bot,
      socket: this.socket,
      data,
    });

    if (handledPrivateLogs) {
      return;
    }

    this.handleLoginSuccess(data);
    this.handleRoomUsersSnapshot(data);
    this.handleRoomUserJoinOrLeave(data);
    this.handleRoomCommand(data);
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

    console.log("🚫 [CONTROLLER_ROOM_REJECTED]", {
      username: this.bot.username,
      roomName,
      reason,
      data,
    });

    this.runtime.markBotRoomBlocked({
      type: "controller",
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
        type: "controller",
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
      لو الحساب اتحفظ محظور من الغرفة، لا يعيد الدخول.
    */
    if (
      this.runtime &&
      typeof this.runtime.isBotRoomBlocked === "function" &&
      this.runtime.isBotRoomBlocked({
        type: "controller",
        username: this.bot.username,
        roomName: this.bot.roomName,
      })
    ) {
      console.log("🚫 [CONTROLLER_REJOIN_SKIPPED_BLOCKED_ROOM]", {
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

    console.log("🔁 [CONTROLLER_AUTO_REJOIN]", {
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

        this.socket.updateProfile(makeControllerBotProfile(this.bot));
      }, 1000);
    }, 1500);
  }

  handleLoginSuccess(data) {
    if (
      data.handler === "login_event" &&
      data.type === "success" &&
      !this.joined
    ) {
      console.log(`🔑 Login success for controller: ${this.bot.username}`);

      setTimeout(() => {
        if (this.stopped || this.blockedFromRoom || !this.socket) {
          return;
        }

        /*
          مهم:
          لا نمنع الدخول هنا لو الغرفة موجودة في blockedBotRooms.json.
          لأن BotRuntime هو الذي يقرر:
          - يجرب بعد restart لو BLOCKED_ROOM_RETRY_ON_STARTUP=1
          - أو يمنع من البداية لو BLOCKED_ROOM_RETRY_ON_STARTUP=0

          لو الحظر مازال موجود، السيرفر سيرسل room_unauthorized
          وسنحفظه مرة أخرى ونوقف المحاولة.
        */
        console.log(`🚪 Trying to join room: ${this.bot.roomName}`);

        this.socket.joinRoom(this.bot.roomName);

        setTimeout(() => {
          if (this.stopped || this.blockedFromRoom || !this.socket) {
            return;
          }

          this.socket.updateProfile(makeControllerBotProfile(this.bot));
        }, 1000);
      }, 1000);

      this.joined = true;
    }
  }

  handleRoomUsersSnapshot(data) {
    const snapshot = extractRoomUsersSnapshot(data);

    if (!snapshot) {
      return;
    }

    const roomName = snapshot.roomName || this.bot.roomName;

    this.roomUsersRepository.replaceRoomUsers(roomName, snapshot.users);

    const savedUsers = this.roomUsersRepository.getRoomUsers(roomName);

    /*
      عند دخول البوت للغرفة يأتي snapshot فيه users كاملة.
      لذلك نفحص المستخدمين الموجودين بالفعل.
      لو autoBanRoleNoneEnabled مفعّل، وأحدهم role none، يتم حظره.
    */
    savedUsers.forEach((user) => {
      handleAutoBanRoleNoneOnJoin({
        socket: this.socket,
        roomName,
        username: user.username,
        role: user.role,
      });
    });

    console.log("👥 [ROOM_USERS_SNAPSHOT_SAVED]", {
      room: roomName,
      receivedCount: snapshot.users.length,
      savedCount: savedUsers.length,
      users: savedUsers.map((u) => ({
        username: u.username,
        role: u.role,
      })),
    });
  }

  handleRoomUserJoinOrLeave(data) {
    const event = extractRoomUserEvent(data);

    if (!event) {
      return;
    }

    const roomName = event.roomName || this.bot.roomName;

    if (event.action === "join") {
      this.roomUsersRepository.addUser(roomName, {
        username: event.username,
        role: event.role || "",
        userId: event.userId || "",
        photoUrl: event.photoUrl || "",
      });

      const punished = handleAutoPunishOnJoin({
        socket: this.socket,
        roomName,
        username: event.username,
      });

      if (punished) {
        console.log("⚡ [AUTO_PUNISH_APPLIED_ON_JOIN]", {
          room: roomName,
          username: event.username,
        });

        return;
      }

      notifyWatchersOnJoin({
        socket: this.socket,
        username: event.username,
        roomName,
      });

      handleWelcomeOnJoin({
        socket: this.socket,
        roomName,
        username: event.username,
      });

      handleAutoBanRoleNoneOnJoin({
        socket: this.socket,
        roomName,
        username: event.username,
        role: event.role,
      });

      console.log("➕ [ROOM_USER_JOIN]", {
        room: roomName,
        username: event.username,
        role: event.role || "",
      });

      return;
    }

    if (event.action === "leave") {
      this.roomUsersRepository.removeUser(roomName, event.username);

      console.log("➖ [ROOM_USER_LEAVE]", {
        room: roomName,
        username: event.username,
      });

      /*
        لو الخارج من الغرفة هو بوت التحكم نفسه يدخل مرة أخرى تلقائيًا.
        لكن لو اتحفظ محظور، لن يدخل.
      */
      if (this.isSameBotUsername(event.username)) {
        this.rejoinRoom("controller_left_or_kicked");
      }
    }
  }

  handleRoomCommand(data) {
    const incoming = extractIncomingMessage(data);

    if (!incoming.text || !incoming.sender) {
      return;
    }

    const roomName = incoming.roomName || this.bot.roomName;

    if (this.isSameBotUsername(incoming.sender)) {
      return;
    }

    if (shouldBlockLink(roomName, incoming.text)) {
      this.socket.sendRoomMessage(`Links are disabled: ${incoming.sender}`);
      return;
    }

    const badWord = containsBadWord(roomName, incoming.text);

    if (badWord.matched) {
      this.socket.sendRoomMessage(`Bad word detected: ${incoming.sender}`);

      if (
        badWord.mode === "kick" &&
        typeof this.socket.sendRoomKick === "function"
      ) {
        this.socket.sendRoomKick(incoming.sender, roomName);
      }

      if (
        badWord.mode === "ban" &&
        typeof this.socket.sendRoomBan === "function"
      ) {
        this.socket.sendRoomBan(incoming.sender, roomName);
      }

      return;
    }

    const spam = checkAntiSpam({
      roomName,
      username: incoming.sender,
      text: incoming.text,
    });

    if (spam.blocked) {
      this.socket.sendRoomMessage(
        `Anti spam: ${incoming.sender} (${spam.reason})`
      );

      if (typeof this.socket.sendRoomKick === "function") {
        this.socket.sendRoomKick(incoming.sender, roomName);
      }

      return;
    }

    handleCommand({
      bot: this.bot,
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
  ControllerBot,
};
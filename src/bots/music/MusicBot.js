const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

const {
  isUserLookupCommand,
  handleUserLookupCommand,
} = require("../../features/userLookup/userLookup.commands");

const {
  notifyWatchersOnJoin,
} = require("../../features/watch/watch.commands");

const {
  MUSIC_BOT_USERNAME,
  MUSIC_BOT_PASSWORD,
} = require("../../config/env");

const {
  extractIncomingMessage,
  extractRoomUserEvent,
  extractRoomUsersSnapshot,
} = require("../controller/ControllerBotEvents");

const { parseCommand } = require("../../commands/commandParser");
const { handleMusicCommand } = require("../../features/music/music.commands");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");

class MusicBot {
  constructor({ roomName, runtime }) {
    this.roomName = roomName;
    this.runtime = runtime;

    this.socket = null;
    this.stopped = false;
    this.joined = false;
    this.blockedFromRoom = false;

    this.reconnectManager = new ReconnectManager();
    this.roomUsersRepository = new RoomUsersRepository();

    /*
      لمنع إرسال join أكثر من مرة بسرعة
    */
    this.rejoinTimer = null;
  }

  start() {
    this.stopped = false;
    this.joined = false;
    this.blockedFromRoom = false;

    if (this.rejoinTimer) {
      clearTimeout(this.rejoinTimer);
      this.rejoinTimer = null;
    }

    this.socket = new SocketClient({
      username: MUSIC_BOT_USERNAME,
      password: MUSIC_BOT_PASSWORD,
      roomName: this.roomName,
      type: "music",
    });

    this.socket.onOpen(() => {
      console.log(`🎵 Music bot socket opened -> ${this.roomName}`);
    });

    this.socket.onMessage((data) => {
      this.handleMessage(data);
    });

    this.socket.onClose((code, reason) => {
      console.log(
        `❌ Music bot disconnected from ${this.roomName}`,
        code,
        String(reason || "")
      );

      this.joined = false;

      if (this.rejoinTimer) {
        clearTimeout(this.rejoinTimer);
        this.rejoinTimer = null;
      }

      /*
        لو الغرفة اترفضت أو الحساب محظور منها
        لا تعمل reconnect داخل نفس التشغيل.
      */
      if (this.blockedFromRoom) {
        console.log("🚫 [MUSIC_NO_RECONNECT_BLOCKED_ROOM]", {
          username: MUSIC_BOT_USERNAME,
          roomName: this.roomName,
        });
        return;
      }

      if (!this.stopped) {
        this.reconnectManager.scheduleReconnect(() => this.start());
      }
    });

    this.socket.onError((error) => {
      console.log(`⚠️ Music bot error ${this.roomName}:`, error.message);
    });

    this.socket.connect();
  }

  handleMessage(data) {
    /*
      أول شيء:
      لو السيرفر رفض دخول الغرفة، احفظ music_dj + الغرفة
      ولا تكمل أوامر أو rejoin.
    */
    if (this.handleRoomReject(data)) {
      return;
    }

    /*
      لو دخل بنجاح بعد restart والحظر كان اتفك،
      احذف music_dj + الغرفة من blockedBotRooms.json.
    */
    this.handleRoomJoinSuccess(data);

    this.handleLoginSuccess(data);
    this.handleRoomUsersSnapshot(data);
    this.handleRoomUserJoinOrLeave(data);
    this.handleRoomMusicCommand(data);
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

    const roomName = data.name || this.roomName;
    const reason = data.type || "room_rejected";

    this.blockedFromRoom = true;
    this.stopped = true;

    console.log("🚫 [MUSIC_ROOM_REJECTED]", {
      username: MUSIC_BOT_USERNAME,
      roomName,
      reason,
      data,
    });

    this.runtime.markBotRoomBlocked({
      type: "music",
      username: MUSIC_BOT_USERNAME,
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
      const roomName = data.name || this.roomName;

      this.runtime.removeBotRoomBlocked({
        type: "music",
        username: MUSIC_BOT_USERNAME,
        roomName,
      });
    }
  }

  handleLoginSuccess(data) {
    if (
      data.handler === "login_event" &&
      data.type === "success" &&
      !this.joined
    ) {
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
        console.log(`🎵 Music bot joining room: ${this.roomName}`);
        this.socket.joinRoom(this.roomName);
      }, 1000);

      this.joined = true;
    }
  }

  handleRoomUsersSnapshot(data) {
    const snapshot = extractRoomUsersSnapshot(data);

    if (!snapshot) {
      return;
    }

    const roomName = snapshot.roomName || this.roomName;

    this.roomUsersRepository.replaceRoomUsers(roomName, snapshot.users);

    console.log("🎵👥 [MUSIC_ROOM_USERS_SAVED]", {
      room: roomName,
      count: snapshot.users.length,
    });

    /*
      لو السيرفر أرسل قائمة مستخدمين والبوت غير موجود فيها
      معنى ذلك غالبًا أنه اتطرد أو خرج من الغرفة
    */
    this.ensureMusicBotStillInsideRoom(snapshot.users);
  }

  handleRoomUserJoinOrLeave(data) {
    const event = extractRoomUserEvent(data);

    if (!event) {
      return;
    }

    const roomName = event.roomName || this.roomName;

    if (event.action === "join") {
      notifyWatchersOnJoin({
        socket: this.socket,
        username: event.username,
        roomName,
      });

      this.roomUsersRepository.addUser(roomName, {
        username: event.username,
        role: event.role || "",
        userId: event.userId || "",
        photoUrl: event.photoUrl || "",
      });

      console.log("🎵➕ [MUSIC_ROOM_USER_JOIN]", {
        room: roomName,
        username: event.username,
      });

      return;
    }

    if (event.action === "leave") {
      this.roomUsersRepository.removeUser(roomName, event.username);

      console.log("🎵➖ [MUSIC_ROOM_USER_LEAVE]", {
        room: roomName,
        username: event.username,
      });

      /*
        لو الخارج هو بوت الموسيقى نفسه
        يدخل مرة أخرى تلقائيًا
        إلا لو اتحفظ محظور من الغرفة.
      */
      if (this.isSameBotUsername(event.username)) {
        this.rejoinRoom("music_left_or_kicked");
      }
    }
  }

  handleRoomMusicCommand(data) {
    const incoming = extractIncomingMessage(data);

    if (!incoming.text || !incoming.sender) {
      return;
    }

    const parsed = parseCommand(incoming.text);

    if (!parsed) {
      return;
    }

    /*
      أمر البحث عن المستخدم
      يعمل من MusicBot فقط لو لا يوجد ControllerBot في الغرفة
      حتى لا يحصل تكرار في الرد
    */
    if (isUserLookupCommand(parsed.command)) {
      if (
        this.runtime &&
        typeof this.runtime.hasControllerBot === "function" &&
        this.runtime.hasControllerBot(this.roomName)
      ) {
        return;
      }

      const fakeBot = {
        username: this.socket.username,
        roomName: this.roomName,
      };

      handleUserLookupCommand({
        bot: fakeBot,
        sender: incoming.sender,
        text: incoming.text,
        parsed,
        socket: this.socket,
        runtime: this.runtime,
      });

      return;
    }

    const fakeBot = {
      username: MUSIC_BOT_USERNAME,
      roomName: this.roomName,
    };

    handleMusicCommand({
      bot: fakeBot,
      sender: incoming.sender,
      text: incoming.text,
      parsed,
      socket: this.socket,
      runtime: this.runtime,
    }).catch((err) => {
      console.log("❌ Music command error:", err.message);

      if (this.socket) {
        this.socket.sendRoomMessage("Music error.", this.roomName);
      }
    });
  }

  isSameBotUsername(username) {
    const a = String(username || "").trim().toLowerCase();
    const b = String(MUSIC_BOT_USERNAME || "").trim().toLowerCase();

    return a && b && a === b;
  }

  rejoinRoom(reason = "unknown") {
    if (this.stopped || this.blockedFromRoom || !this.socket) {
      return;
    }

    /*
      داخل نفس التشغيل:
      لو music_dj اتحفظ محظور من هذه الغرفة، لا يعيد الدخول.
    */
    if (
      this.runtime &&
      typeof this.runtime.isBotRoomBlocked === "function" &&
      this.runtime.isBotRoomBlocked({
        type: "music",
        username: MUSIC_BOT_USERNAME,
        roomName: this.roomName,
      })
    ) {
      console.log("🚫 [MUSIC_REJOIN_SKIPPED_BLOCKED_ROOM]", {
        username: MUSIC_BOT_USERNAME,
        roomName: this.roomName,
      });

      this.blockedFromRoom = true;
      this.stopped = true;

      if (this.socket) {
        this.socket.close();
      }

      return;
    }

    /*
      منع تكرار محاولات الدخول لو السيرفر أرسل أكثر من event
    */
    if (this.rejoinTimer) {
      return;
    }

    console.log("🔁 [MUSIC_AUTO_REJOIN]", {
      username: MUSIC_BOT_USERNAME,
      room: this.roomName,
      reason,
    });

    this.rejoinTimer = setTimeout(() => {
      this.rejoinTimer = null;

      if (this.stopped || this.blockedFromRoom || !this.socket) {
        return;
      }

      console.log("🚪 [MUSIC_REJOIN_ROOM_SEND]", {
        username: MUSIC_BOT_USERNAME,
        room: this.roomName,
        reason,
      });

      this.socket.joinRoom(this.roomName);
    }, 1500);
  }

  ensureMusicBotStillInsideRoom(snapshotUsers) {
    if (this.stopped || this.blockedFromRoom) {
      return;
    }

    const users = Array.isArray(snapshotUsers) ? snapshotUsers : [];

    const exists = users.some((user) => {
      const username = String(
        user.username || user.name || user.user || ""
      ).trim();

      return this.isSameBotUsername(username);
    });

    if (!exists) {
      this.rejoinRoom("music_missing_from_room_snapshot");
    }
  }

  sendRoomMessage(text) {
    if (this.socket) {
      this.socket.sendRoomMessage(text, this.roomName);
    }
  }

  stop() {
    this.stopped = true;

    if (this.rejoinTimer) {
      clearTimeout(this.rejoinTimer);
      this.rejoinTimer = null;
    }

    if (this.socket) {
      this.socket.close();
    }
  }
}

module.exports = {
  MusicBot,
};
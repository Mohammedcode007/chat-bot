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

    this.reconnectManager = new ReconnectManager();
    this.roomUsersRepository = new RoomUsersRepository();
  }

  start() {
    this.stopped = false;
    this.joined = false;

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
  isSameBotUsername(username) {
    const a = String(username || "").trim().toLowerCase();
    const b = String(this.bot.username || "").trim().toLowerCase();

    return a && b && a === b;
  }

  rejoinRoom(reason = "unknown") {
    if (this.stopped || !this.socket) {
      return;
    }

    console.log("🔁 [CONTROLLER_AUTO_REJOIN]", {
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
        console.log(`🚪 Trying to join room: ${this.bot.roomName}`);

        this.socket.joinRoom(this.bot.roomName);

        setTimeout(() => {
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
    مهم:
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

  /*
    Auto punish:
    ab@username = auto ban
    ak@username = auto kick

    مهم:
    يكون قبل الترحيب حتى لا يرحب بشخص سيتم طرده/حظره.
  */
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

  /*
    تنبيه watch@username
  */
  notifyWatchersOnJoin({
    socket: this.socket,
    username: event.username,
    roomName,
  });

  /*
    رسالة الترحيب حسب إعدادات الغرفة:
    set@welcome@on
    welcome@Welcome {user} to {room}
  */
  handleWelcomeOnJoin({
    socket: this.socket,
    roomName,
    username: event.username,
  });

  /*
    حظر تلقائي إذا دخل المستخدم برتبة none:
    set@autoban_none@on
  */
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
      لو الخارج من الغرفة هو بوت التحكم نفسه
      يدخل مرة أخرى تلقائيًا
    */
    if (this.isSameBotUsername(event.username)) {
      this.rejoinRoom("controller_left_or_kicked");
    }
  }
}
  // handleRoomUsersSnapshot(data) {
  //   const snapshot = extractRoomUsersSnapshot(data);

  //   if (!snapshot) {
  //     return;
  //   }

  //   const roomName = snapshot.roomName || this.bot.roomName;

  //   this.roomUsersRepository.replaceRoomUsers(roomName, snapshot.users);

  //   const savedUsers = this.roomUsersRepository.getRoomUsers(roomName);

  //   console.log("👥 [ROOM_USERS_SNAPSHOT_SAVED]", {
  //     room: roomName,
  //     receivedCount: snapshot.users.length,
  //     savedCount: savedUsers.length,
  //     users: savedUsers.map((u) => u.username),
  //   });
  // }

// handleRoomUserJoinOrLeave(data) {
//   const event = extractRoomUserEvent(data);

//   if (!event) {
//     return;
//   }

//   const roomName = event.roomName || this.bot.roomName;

//   if (event.action === "join") {
//     notifyWatchersOnJoin({
//   socket: this.socket,
//   username: event.username,
//   roomName,
// });
//     this.roomUsersRepository.addUser(roomName, {
//       username: event.username,
//       role: event.role || "",
//       userId: event.userId || "",
//       photoUrl: event.photoUrl || "",
//     });

//     console.log("➕ [ROOM_USER_JOIN]", {
//       room: roomName,
//       username: event.username,
//     });

//     return;
//   }

//   if (event.action === "leave") {
//     this.roomUsersRepository.removeUser(roomName, event.username);

//     console.log("➖ [ROOM_USER_LEAVE]", {
//       room: roomName,
//       username: event.username,
//     });

//     /*
//       لو الخارج من الغرفة هو بوت التحكم نفسه
//       يدخل مرة أخرى تلقائيًا
//     */
//     if (this.isSameBotUsername(event.username)) {
//       this.rejoinRoom("controller_left_or_kicked");
//     }
//   }
// }
handleRoomCommand(data) {
  const incoming = extractIncomingMessage(data);

  if (!incoming.text || !incoming.sender) {
    return;
  }

  const roomName = incoming.roomName || this.bot.roomName;

  /*
    لا تطبق الحماية على رسائل البوت نفسه
  */
  if (this.isSameBotUsername(incoming.sender)) {
    return;
  }

  /*
    =====================================================
    Links Guard
    set@links@off
    =====================================================
  */
  if (shouldBlockLink(roomName, incoming.text)) {
    this.socket.sendRoomMessage(`Links are disabled: ${incoming.sender}`);
    return;
  }

  /*
    =====================================================
    Bad Words Guard
    set@badwords@on

    mode:
    warn = رسالة تحذير فقط
    kick = طرد
    ban  = حظر
    =====================================================
  */
  const badWord = containsBadWord(roomName, incoming.text);

  if (badWord.matched) {
    this.socket.sendRoomMessage(
      `Bad word detected: ${incoming.sender}`
    );

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

  /*
    =====================================================
    Anti Spam Guard
    set@antispam@on
    =====================================================
  */
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

  /*
    بعد اجتياز الحماية يتم تنفيذ الأوامر طبيعي
  */
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
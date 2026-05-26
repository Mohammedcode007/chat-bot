// const WebSocket = require("ws");

// const {
//   WS_URL,
//   BOT_SESSION,
//   BOT_SDK,
//   BOT_VERSION,
//   PING_INTERVAL_MS,
// } = require("../config/env");

// const { SOCKET_HANDLERS } = require("../constants/socketHandlers");
// const { makeId } = require("../utils/ids");

// class SocketClient {
//   constructor({ username, password, roomName = null, type = "bot" }) {
//     this.username = username;
//     this.password = password;
//     this.roomName = roomName;
//     this.type = type;

//     this.ws = null;
//     this.pingTimer = null;

//     this.openHandler = null;
//     this.messageHandler = null;
//     this.closeHandler = null;
//     this.errorHandler = null;

//     this.isLoggedIn = false;
//     this.lastRawMessage = null;
//   }

//   connect() {
// console.log(`🔌 Connecting socket: ${this.username} | type=${this.type}`);
// console.log("🌐 WS_URL =", WS_URL);
//     this.ws = new WebSocket(WS_URL);

//     this.ws.on("open", () => {
//       console.log(`🟢 Socket opened: ${this.username}`);

//       this.login();
//       this.startKeepAlive();

//       if (this.openHandler) {
//         this.openHandler();
//       }
//     });

//     this.ws.on("message", (message) => {
//       const raw = message.toString();
//       this.lastRawMessage = raw;

//       let data = null;

//       try {
//         data = JSON.parse(raw);
//       } catch {
//         console.log(`⚠️ Non JSON message for ${this.username}`);
//         return;
//       }

//       if (
//         data.handler === "login_event" &&
//         data.type === "success"
//       ) {
//         this.isLoggedIn = true;
//       }

//       if (this.messageHandler) {
//         this.messageHandler(data);
//       }
//     });

//     this.ws.on("close", (code, reason) => {
//       this.stopKeepAlive();
//       this.isLoggedIn = false;

//       console.log(
//         `🔴 Socket closed: ${this.username} | code=${code} | reason=${String(
//           reason || ""
//         )}`
//       );

//       if (this.closeHandler) {
//         this.closeHandler(code, reason);
//       }
//     });

//     this.ws.on("error", (error) => {
//       console.log(`⚠️ Socket error ${this.username}:`, error.message);

//       if (this.errorHandler) {
//         this.errorHandler(error);
//       }
//     });
//   }

//   login() {
//     return this.send({
//       handler: SOCKET_HANDLERS.LOGIN,
//       username: this.username,
//       password: this.password,
//       session: BOT_SESSION,
//       sdk: BOT_SDK,
//       ver: BOT_VERSION,
//       id: makeId("login"),
//     });
//   }

 
// joinRoom(roomName = this.roomName) {
//   if (!roomName) {
//     console.log(`⚠️ joinRoom ignored: ${this.username} has no roomName`);
//     return false;
//   }

//   this.roomName = roomName;

//   const payload = {
//     handler: SOCKET_HANDLERS.ROOM_JOIN,
//     name: roomName,
//     id: makeId("join"),
//   };

//   console.log("🚪 [JOIN_ROOM_SEND]", {
//     username: this.username,
//     roomName,
//     payload,
//   });

//   return this.send(payload);
// }
//   sendRoomMessage(text, roomName = this.roomName) {
//     if (!roomName) {
//       console.log(`⚠️ sendRoomMessage ignored: ${this.username} has no roomName`);
//       return false;
//     }

//     return this.send({
//       handler: SOCKET_HANDLERS.ROOM_MESSAGE,
//       room: roomName,
//       body: String(text || ""),
//       type: "text",
//         id: 'TclBVHgBzPGTMRTNpgWV',
//         url: '',
//         length: '',
//     });
//   }

//   sendPrivate(to, text) {
//     if (!to) {
//       console.log("⚠️ sendPrivate ignored: missing receiver");
//       return false;
//     }

//     const payload = {
//       handler: SOCKET_HANDLERS.CHAT_MESSAGE,
//       to: String(to),
//       body: String(text || ""),
//       type: "text",
//       id: makeId("private_msg"),
//     };

//     console.log("📤 [SEND_PRIVATE]", {
//       to: payload.to,
//       body: payload.body,
//     });

//     return this.send(payload);
//   }

//   updateProfile(html) {
//     return this.send({
//       handler: SOCKET_HANDLERS.PROFILE_UPDATE,
//       id: makeId("profile"),
//       type: "status",
//       value: String(html || ""),
//     });
//   }

//   send(payload) {
//     if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
//       console.log(`⚠️ Cannot send, socket not open: ${this.username}`);
//       return false;
//     }

//     try {
//       this.ws.send(JSON.stringify(payload));
//       return true;
//     } catch (err) {
//       console.log(`❌ Send error ${this.username}:`, err.message);
//       return false;
//     }
//   }

//   startKeepAlive() {
//     this.stopKeepAlive();

//     this.pingTimer = setInterval(() => {
//       this.send({
//         handler: SOCKET_HANDLERS.PING,
//         username: this.username,
//         time: Date.now(),
//         id: makeId("ping"),
//       });
//     }, PING_INTERVAL_MS);
//   }

//   stopKeepAlive() {
//     if (this.pingTimer) {
//       clearInterval(this.pingTimer);
//       this.pingTimer = null;
//     }
//   }

//   onOpen(fn) {
//     this.openHandler = fn;
//   }

//   onMessage(fn) {
//     this.messageHandler = fn;
//   }

//   onClose(fn) {
//     this.closeHandler = fn;
//   }

//   onError(fn) {
//     this.errorHandler = fn;
//   }

//   close() {
//     this.stopKeepAlive();

//     if (this.ws) {
//       this.ws.close();
//     }
//   }
// }

// module.exports = {
//   SocketClient,
// };

const WebSocket = require("ws");

const {
  WS_URL,
  BOT_SESSION,
  BOT_SDK,
  BOT_VERSION,
  PING_INTERVAL_MS,
} = require("../config/env");

const { SOCKET_HANDLERS } = require("../constants/socketHandlers");
const { makeId } = require("../utils/ids");

class SocketClient {
  constructor({ username, password, roomName = null, type = "bot" }) {
    this.username = username;
    this.password = password;
    this.roomName = roomName;
    this.type = type;

    this.ws = null;
    this.pingTimer = null;

    this.openHandler = null;
    this.messageHandler = null;
    this.closeHandler = null;
    this.errorHandler = null;

    this.isLoggedIn = false;
    this.lastRawMessage = null;

    /*
      Debug switch
      اجعلها false بعد انتهاء الاختبار حتى لا تزيد اللوجات
    */
    this.debugSocket = true;
  }

  logDebug(title, data = null) {
    if (!this.debugSocket) return;

    if (data === null || data === undefined) {
      console.log(title);
      return;
    }

    try {
      console.log(title, JSON.stringify(data, null, 2));
    } catch {
      console.log(title, data);
    }
  }

  connect() {
    console.log(`🔌 Connecting socket: ${this.username} | type=${this.type}`);
    console.log("🌐 WS_URL =", WS_URL);

    this.ws = new WebSocket(WS_URL);

    this.ws.on("open", () => {
      console.log(`🟢 Socket opened: ${this.username}`);

      this.login();
      this.startKeepAlive();

      if (this.openHandler) {
        this.openHandler();
      }
    });

    this.ws.on("message", (message) => {
      const raw = message.toString();
      this.lastRawMessage = raw;

      /*
        طباعة الرسالة الخام القادمة من السيرفر
      */
      this.logDebug(`📥 [RAW_SOCKET_MESSAGE] ${this.username}`, raw);

      let data = null;

      try {
        data = JSON.parse(raw);
      } catch {
        console.log(`⚠️ Non JSON message for ${this.username}`);
        console.log("⚠️ RAW:", raw);
        return;
      }

      /*
        طباعة الرسالة بعد التحويل إلى JSON
      */
      this.logDebug(`📦 [PARSED_SOCKET_MESSAGE] ${this.username}`, data);

      /*
        طباعة مختصرة حسب نوع الحدث
      */
      this.logIncomingEvent(data);

      if (
        data.handler === "login_event" &&
        data.type === "success"
      ) {
        this.isLoggedIn = true;

        console.log(`✅ [LOGIN_SUCCESS] ${this.username}`);
      }

      if (
        data.handler === "login_event" &&
        data.type !== "success"
      ) {
        console.log(`❌ [LOGIN_FAILED] ${this.username}`, data);
      }

      if (this.messageHandler) {
        this.messageHandler(data);
      }
    });

    this.ws.on("close", (code, reason) => {
      this.stopKeepAlive();
      this.isLoggedIn = false;

      console.log(
        `🔴 Socket closed: ${this.username} | code=${code} | reason=${String(
          reason || ""
        )}`
      );

      if (this.closeHandler) {
        this.closeHandler(code, reason);
      }
    });

    this.ws.on("error", (error) => {
      console.log(`⚠️ Socket error ${this.username}:`, error.message);

      if (this.errorHandler) {
        this.errorHandler(error);
      }
    });
  }

  logIncomingEvent(data) {
    const handler = data?.handler;
    const type = data?.type;

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📡 [SOCKET_EVENT] bot=${this.username}`);
    console.log(`🏷️ handler=${handler || "unknown"} | type=${type || "unknown"}`);
    console.log(`🏠 currentRoom=${this.roomName || "no-room"}`);

    /*
      رسائل الغرفة
    */
    if (
      handler === SOCKET_HANDLERS.ROOM_MESSAGE ||
      handler === "room_message" ||
      handler === "roomMessage" ||
      handler === "message"
    ) {
      console.log("💬 [ROOM_MESSAGE_RECEIVED]");
      console.log("🏠 room:", data.room || data.name || data.roomName || "unknown");
      console.log("👤 sender:", data.username || data.from || data.sender || data.user || "unknown");
      console.log("📝 body:", data.body || data.message || data.text || "");
      console.log("🧩 full:", data);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    /*
      دخول الغرفة
    */
    if (
      handler === SOCKET_HANDLERS.ROOM_JOIN ||
      handler === "room_join" ||
      handler === "join_room" ||
      handler === "room_joined"
    ) {
      console.log("🚪 [ROOM_JOIN_EVENT]");
      console.log("🏠 room:", data.room || data.name || data.roomName || "unknown");
      console.log("👤 user:", data.username || data.user || data.sender || "unknown");
      console.log("🧩 full:", data);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    /*
      خروج من الغرفة
    */
    if (
      handler === "room_leave" ||
      handler === "leave_room" ||
      handler === "room_left"
    ) {
      console.log("🚶 [ROOM_LEAVE_EVENT]");
      console.log("🏠 room:", data.room || data.name || data.roomName || "unknown");
      console.log("👤 user:", data.username || data.user || data.sender || "unknown");
      console.log("🧩 full:", data);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    /*
      قائمة المستخدمين أو تحديث الموجودين
    */
    if (
      handler === "room_users" ||
      handler === "users" ||
      handler === "room_users_update" ||
      handler === "online_users"
    ) {
      console.log("👥 [ROOM_USERS_EVENT]");
      console.log("🏠 room:", data.room || data.name || data.roomName || "unknown");
      console.log("👥 users:", data.users || data.members || data.onlineUsers || []);
      console.log("🧩 full:", data);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    /*
      أخطاء من السيرفر
    */
    if (
      handler === "error" ||
      type === "error" ||
      data.error ||
      data.message === "unauthorized"
    ) {
      console.log("❌ [SERVER_ERROR_EVENT]");
      console.log("🧩 full:", data);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      return;
    }

    /*
      أي حدث غير معروف
    */
    console.log("🟡 [UNKNOWN_SOCKET_EVENT]");
    console.log("🧩 full:", data);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  login() {
    const payload = {
      handler: SOCKET_HANDLERS.LOGIN,
      username: this.username,
      password: this.password,
      session: BOT_SESSION,
      sdk: BOT_SDK,
      ver: BOT_VERSION,
      id: makeId("login"),
    };

    console.log("🔐 [LOGIN_SEND]", {
      username: this.username,
      session: BOT_SESSION,
      sdk: BOT_SDK,
      ver: BOT_VERSION,
      id: payload.id,
    });

    return this.send(payload);
  }

  joinRoom(roomName = this.roomName) {
    if (!roomName) {
      console.log(`⚠️ joinRoom ignored: ${this.username} has no roomName`);
      return false;
    }

    this.roomName = roomName;

    const payload = {
      handler: SOCKET_HANDLERS.ROOM_JOIN,
      name: roomName,
      id: makeId("join"),
    };

    console.log("🚪 [JOIN_ROOM_SEND]", {
      username: this.username,
      roomName,
      payload,
    });

    return this.send(payload);
  }

  sendRoomMessage(text, roomName = this.roomName) {
    if (!roomName) {
      console.log(`⚠️ sendRoomMessage ignored: ${this.username} has no roomName`);
      return false;
    }

    const payload = {
      handler: SOCKET_HANDLERS.ROOM_MESSAGE,
      room: roomName,
      body: String(text || ""),
      type: "text",
      id: makeId("room_msg"),
      url: "",
      length: "",
    };

    console.log("📤 [ROOM_MESSAGE_SEND]", {
      username: this.username,
      roomName,
      body: payload.body,
      payload,
    });

    return this.send(payload);
  }

  sendPrivate(to, text) {
    if (!to) {
      console.log("⚠️ sendPrivate ignored: missing receiver");
      return false;
    }

    const payload = {
      handler: SOCKET_HANDLERS.CHAT_MESSAGE,
      to: String(to),
      body: String(text || ""),
      type: "text",
      id: makeId("private_msg"),
    };

    console.log("📤 [SEND_PRIVATE]", {
      from: this.username,
      to: payload.to,
      body: payload.body,
      payload,
    });

    return this.send(payload);
  }

  updateProfile(html) {
    const payload = {
      handler: SOCKET_HANDLERS.PROFILE_UPDATE,
      id: makeId("profile"),
      type: "status",
      value: String(html || ""),
    };

    console.log("📝 [PROFILE_UPDATE_SEND]", {
      username: this.username,
      value: payload.value,
      payload,
    });

    return this.send(payload);
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(`⚠️ Cannot send, socket not open: ${this.username}`);
      console.log("⚠️ Failed payload:", payload);
      return false;
    }

    try {
      console.log("📨 [SOCKET_SEND]", {
        username: this.username,
        handler: payload?.handler,
        id: payload?.id,
        payload,
      });

      this.ws.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      console.log(`❌ Send error ${this.username}:`, err.message);
      console.log("❌ Failed payload:", payload);
      return false;
    }
  }

  startKeepAlive() {
    this.stopKeepAlive();

    this.pingTimer = setInterval(() => {
      const payload = {
        handler: SOCKET_HANDLERS.PING,
        username: this.username,
        time: Date.now(),
        id: makeId("ping"),
      };

      /*
        لو لا تريد كثرة طباعات ping، اتركها معلقة
      */
      // console.log("🏓 [PING_SEND]", payload);

      this.send(payload);
    }, PING_INTERVAL_MS);
  }

  stopKeepAlive() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  onOpen(fn) {
    this.openHandler = fn;
  }

  onMessage(fn) {
    this.messageHandler = fn;
  }

  onClose(fn) {
    this.closeHandler = fn;
  }

  onError(fn) {
    this.errorHandler = fn;
  }

  close() {
    this.stopKeepAlive();

    if (this.ws) {
      console.log(`🔌 [SOCKET_CLOSE_REQUEST] ${this.username}`);
      this.ws.close();
    }
  }
}

module.exports = {
  SocketClient,
};
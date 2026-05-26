const { SocketClient } = require("../../core/SocketClient");
const { ReconnectManager } = require("../../core/ReconnectManager");

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

    this.reconnectManager = new ReconnectManager();
    this.roomUsersRepository = new RoomUsersRepository();
  }

  start() {
    this.stopped = false;
    this.joined = false;

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
    this.handleLoginSuccess(data);
    this.handleRoomUsersSnapshot(data);
    this.handleRoomUserJoinOrLeave(data);
    this.handleRoomMusicCommand(data);
  }

  handleLoginSuccess(data) {
    if (
      data.handler === "login_event" &&
      data.type === "success" &&
      !this.joined
    ) {
      setTimeout(() => {
        console.log(`🎵 Music bot joining room: ${this.roomName}`);
        this.socket.joinRoom(this.roomName);
      }, 1000);

      this.joined = true;
    }
  }

  handleRoomUsersSnapshot(data) {
    const snapshot = extractRoomUsersSnapshot(data);

    if (!snapshot) return;

    const roomName = snapshot.roomName || this.roomName;

    this.roomUsersRepository.replaceRoomUsers(roomName, snapshot.users);

    console.log("🎵👥 [MUSIC_ROOM_USERS_SAVED]", {
      room: roomName,
      count: snapshot.users.length,
    });
  }

  handleRoomUserJoinOrLeave(data) {
    const event = extractRoomUserEvent(data);

    if (!event) return;

    const roomName = event.roomName || this.roomName;

    if (event.action === "join") {
      this.roomUsersRepository.addUser(roomName, {
        username: event.username,
        role: event.role || "",
        userId: event.userId || "",
        photoUrl: event.photoUrl || "",
      });
      return;
    }

    if (event.action === "leave") {
      this.roomUsersRepository.removeUser(roomName, event.username);
    }
  }

  handleRoomMusicCommand(data) {
    const incoming = extractIncomingMessage(data);

    if (!incoming.text || !incoming.sender) return;

    const parsed = parseCommand(incoming.text);

    if (!parsed) return;

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
  this.socket.sendRoomMessage("Music error.");
});
  }

  sendRoomMessage(text) {
    if (this.socket) {
      this.socket.sendRoomMessage(text, this.roomName);
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
  MusicBot,
};
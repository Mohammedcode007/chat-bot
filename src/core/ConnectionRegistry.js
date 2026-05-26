class ConnectionRegistry {
  constructor() {
    this.connections = new Map();
  }

  makeKey(type, roomName, username) {
    return `${type}:${roomName}:${username}`.toLowerCase();
  }

  set(type, roomName, username, instance) {
    const key = this.makeKey(type, roomName, username);
    this.connections.set(key, instance);
  }

  get(type, roomName, username) {
    const key = this.makeKey(type, roomName, username);
    return this.connections.get(key);
  }

  remove(type, roomName, username) {
    const key = this.makeKey(type, roomName, username);
    this.connections.delete(key);
  }

  has(type, roomName, username) {
    const key = this.makeKey(type, roomName, username);
    return this.connections.has(key);
  }

  stopAll() {
    for (const instance of this.connections.values()) {
      if (instance && typeof instance.stop === "function") {
        instance.stop();
      }
    }

    this.connections.clear();
  }
}

module.exports = {
  ConnectionRegistry,
};
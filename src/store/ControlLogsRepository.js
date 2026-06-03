const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const LOG_TTL_MS = 24 * 60 * 60 * 1000;

const controlLogsStore = new JsonStore(
  path.join(__dirname, "../data/controlLogs.json"),
  []
);

class ControlLogsRepository {
  getAll() {
    const logs = controlLogsStore.read();

    if (!Array.isArray(logs)) {
      return [];
    }

    return this.cleanupExpired(logs);
  }

  saveAll(logs) {
    return controlLogsStore.write(Array.isArray(logs) ? logs : []);
  }

  cleanupExpired(logs = null) {
    const currentLogs = Array.isArray(logs) ? logs : controlLogsStore.read();
    const now = Date.now();

    const freshLogs = (Array.isArray(currentLogs) ? currentLogs : []).filter(
      (log) => {
        const createdAtMs = new Date(log.createdAt || 0).getTime();

        if (!createdAtMs) {
          return false;
        }

        return now - createdAtMs < LOG_TTL_MS;
      }
    );

    if (freshLogs.length !== currentLogs.length) {
      this.saveAll(freshLogs);
    }

    return freshLogs;
  }

  addLog({ roomName, action, performer, target, details }) {
    const logs = this.getAll();

    const log = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      roomName: String(roomName || ""),
      action: String(action || ""),
      performer: String(performer || ""),
      target: String(target || ""),
      details: String(details || ""),
      createdAt: new Date().toISOString(),
    };

    logs.push(log);
    this.saveAll(logs);

    return log;
  }

  getLogsForMaster({ roomName }) {
    const logs = this.getAll();

    return logs
      .filter((log) => {
        return normalizeUsername(log.roomName) === normalizeUsername(roomName);
      })
      .sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }
}

module.exports = {
  ControlLogsRepository,
  LOG_TTL_MS,
};
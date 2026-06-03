const path = require("path");
const { JsonStore } = require("./JsonStore");
const { normalizeUsername } = require("../utils/text");

const gamePlayersStore = new JsonStore(
  path.join(__dirname, "../data/gamePlayers.json"),
  {}
);

function normalizeKey(username) {
  return normalizeUsername(username);
}

function nowIso() {
  return new Date().toISOString();
}

class GamePlayersRepository {
  getAll() {
    const data = gamePlayersStore.read();
    return data && typeof data === "object" ? data : {};
  }

  saveAll(data) {
    return gamePlayersStore.write(data || {});
  }

  getPlayer(username) {
    const data = this.getAll();
    const key = normalizeKey(username);

    return {
      username,
      verified: false,
      points: 0,
      bombShieldUntil: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...(data[key] || {}),
    };
  }

  savePlayer(username, patch) {
    const data = this.getAll();
    const key = normalizeKey(username);

    const current = this.getPlayer(username);

    data[key] = {
      ...current,
      username: current.username || username,
      ...(patch || {}),
      updatedAt: nowIso(),
    };

    this.saveAll(data);

    return data[key];
  }

  isVerified(username) {
    return this.getPlayer(username).verified === true;
  }

  verifyUser(username) {
    const player = this.getPlayer(username);

    return this.savePlayer(username, {
      username,
      verified: true,
      points: Number(player.points || 0) + 1000,
      verifiedAt: nowIso(),
    });
  }

  getPoints(username) {
    return Number(this.getPlayer(username).points || 0);
  }

  addPoints(username, amount) {
    const player = this.getPlayer(username);
    const nextPoints = Number(player.points || 0) + Number(amount || 0);

    return this.savePlayer(username, {
      username,
      points: nextPoints,
    });
  }

  deductPoints(username, amount) {
    const player = this.getPlayer(username);
    const currentPoints = Number(player.points || 0);
    const cost = Number(amount || 0);

    if (currentPoints < cost) {
      return {
        ok: false,
        reason: "not_enough_points",
        points: currentPoints,
      };
    }

    const next = this.savePlayer(username, {
      username,
      points: currentPoints - cost,
    });

    return {
      ok: true,
      points: next.points,
    };
  }

  setBombShield(username, durationMs) {
    const until = new Date(Date.now() + Number(durationMs || 0)).toISOString();

    return this.savePlayer(username, {
      username,
      bombShieldUntil: until,
    });
  }

  hasBombShield(username) {
    const player = this.getPlayer(username);
    const untilMs = new Date(player.bombShieldUntil || 0).getTime();

    return untilMs && untilMs > Date.now();
  }

  getBombShieldRemainingMs(username) {
    const player = this.getPlayer(username);
    const untilMs = new Date(player.bombShieldUntil || 0).getTime();

    if (!untilMs || untilMs <= Date.now()) {
      return 0;
    }

    return untilMs - Date.now();
  }
}

module.exports = {
  GamePlayersRepository,
};
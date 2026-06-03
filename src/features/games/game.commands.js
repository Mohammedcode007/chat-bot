const { GamePlayersRepository } = require("../../store/GamePlayersRepository");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");
const { VerifiedUsersRepository } = require("../../store/VerifiedUsersRepository");
const { normalizeUsername } = require("../../utils/text");

const gamePlayersRepository = new GamePlayersRepository();
const roomUsersRepository = new RoomUsersRepository();
const verifiedUsersRepository = new VerifiedUsersRepository();

const GAME_COST = 1000;
const BOMB_REWARD = 1000;
const VERIFY_GIFT = 1000;
const BOMB_TIMEOUT_MS = 30 * 1000;
const VERIFY_TIMEOUT_MS = 10 * 1000;
const SHIELD_DURATION_MS = 60 * 60 * 1000;
const SPIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const spinCooldowns = new Map();
const bombSessions = new Map();
const verifySessions = new Map();

function isGameCommand(command) {
  return [
    "game_bomb",
    "game_blast",
    "game_spin",
    "game_answer",
  ].includes(command);
}

function normalizeKey(username) {
  return normalizeUsername(username);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function isSameUser(a, b) {
  return normalizeKey(a) === normalizeKey(b);
}

function formatMs(ms) {
  const sec = Math.ceil(ms / 1000);
  const min = Math.floor(sec / 60);
  const rest = sec % 60;

  if (min <= 0) return `${sec}s`;
  return `${min}m ${rest}s`;
}

function getUserRoleFromRoom(roomName, username) {
  const users = roomUsersRepository.getRoomUsers(roomName);
  const target = normalizeKey(username);

  const found = users.find((user) => {
    return normalizeKey(user.username) === target;
  });

  return found && found.role ? found.role : "none";
}

function sendVerifyRequest({ socket, username, roomName, reason }) {
  const key = normalizeKey(username);

  const old = verifySessions.get(key);

  if (old && old.timer) {
    clearTimeout(old.timer);
  }

  const session = {
    username,
    roomName,
    reason,
    createdAt: Date.now(),
    timer: setTimeout(() => {
      verifySessions.delete(key);
    }, VERIFY_TIMEOUT_MS),
  };

  verifySessions.set(key, session);

  const text = [
    "Verification required",
    `User: ${username}`,
    `Reason: ${reason}`,
    "",
    "Send 1 within 10 seconds to verify yourself.",
    `Gift: ${VERIFY_GIFT} points`,
  ].join("\n");

  socket.sendRoomMessage(text);

  if (typeof socket.sendPrivate === "function") {
    socket.sendPrivate(username, text);
  }
}

function handleVerifyAnswer(context) {
  const { sender, socket, parsed } = context;

  const answer = String(parsed.args[0] || "").trim();

  if (answer !== "1") {
    return false;
  }

  const key = normalizeKey(sender);
  const session = verifySessions.get(key);

  if (!session) {
    return false;
  }

  if (session.timer) {
    clearTimeout(session.timer);
  }

  verifySessions.delete(key);

  /*
    التوثيق هنا أصبح عامًا ويستخدم نفس نظام:
    v@username
    وليس توثيق الألعاب الداخلي.
  */
  const result = verifiedUsersRepository.verifyUser(
    sender,
    "self_game_verify"
  );

  const player = gamePlayersRepository.addPoints(sender, VERIFY_GIFT);

  socket.sendRoomMessage(
    [
      result.alreadyVerified
        ? "✅ Already verified."
        : "✅ Verified successfully.",
      `User: ${sender}`,
      `Gift: +${VERIFY_GIFT} points`,
      `Balance: ${player.points}`,
    ].join("\n")
  );

  return true;
}

function requireVerifiedForGame({
  socket,
  sender,
  targetUsername,
  roomName,
  gameName,
}) {
  /*
    التوثيق هنا عام وليس مرتبطًا بالغرفة.
  */
  const senderVerified = verifiedUsersRepository.isVerified(sender);
  const targetVerified = verifiedUsersRepository.isVerified(targetUsername);

  if (!senderVerified) {
    sendVerifyRequest({
      socket,
      username: sender,
      roomName,
      reason: `${gameName} requires verification`,
    });

    return false;
  }

  if (!targetVerified) {
    sendVerifyRequest({
      socket,
      username: targetUsername,
      roomName,
      reason: `${gameName} target must be verified`,
    });

    return false;
  }

  return true;
}

function deductGameCost({ socket, sender }) {
  const result = gamePlayersRepository.deductPoints(sender, GAME_COST);

  if (!result.ok) {
    socket.sendRoomMessage(
      [
        "Not enough points.",
        `Required: ${GAME_COST}`,
        `Your balance: ${result.points}`,
      ].join("\n")
    );

    return false;
  }

  return true;
}

function makeBombSessionKey(roomName, username) {
  return `${normalizeKey(roomName)}::${normalizeKey(username)}`;
}

function buildBombMessage({ sender, targetUsername }) {
  return [
    "💣 Bomb Game",
    `From: ${sender}`,
    `Target: ${targetUsername}`,
    "",
    "Choose the correct wire color:",
    "",
    "1) 🔴 Red",
    "2) 🔵 Blue",
    "3) 🟢 Green",
    "",
    "Reply with: 1 / 2 / 3",
    "Time: 30 seconds",
  ].join("\n");
}

function clearBombSession(key) {
  const session = bombSessions.get(key);

  if (!session) return;

  if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
  if (session.reminderTimer) clearTimeout(session.reminderTimer);

  bombSessions.delete(key);
}

function handleBombCommand(context) {
  const { sender, socket, bot, parsed } = context;

  const targetUsername = getTargetUsername(parsed);

  if (!targetUsername) {
    socket.sendRoomMessage("Usage: bomb@username");
    return;
  }

  if (isSameUser(sender, targetUsername)) {
    socket.sendRoomMessage("You cannot bomb yourself.");
    return;
  }

  if (
    !requireVerifiedForGame({
      socket,
      sender,
      targetUsername,
      roomName: bot.roomName,
      gameName: "Bomb",
    })
  ) {
    return;
  }

  if (gamePlayersRepository.hasBombShield(targetUsername)) {
    const remaining =
      gamePlayersRepository.getBombShieldRemainingMs(targetUsername);

    socket.sendRoomMessage(
      [
        "🛡️ Target is protected from bombing.",
        `User: ${targetUsername}`,
        `Remaining: ${formatMs(remaining)}`,
      ].join("\n")
    );

    return;
  }

  if (!deductGameCost({ socket, sender })) {
    return;
  }

  const key = makeBombSessionKey(bot.roomName, targetUsername);

  clearBombSession(key);

  const correctChoice = String(Math.floor(Math.random() * 3) + 1);

  const session = {
    roomName: bot.roomName,
    sender,
    targetUsername,
    correctChoice,
    createdAt: Date.now(),
    timeoutTimer: null,
    reminderTimer: null,
  };

  session.reminderTimer = setTimeout(() => {
    const current = bombSessions.get(key);

    if (!current) return;

    socket.sendRoomMessage(
      [
        "⏳ Bomb reminder",
        `Target: ${targetUsername}`,
        "10 seconds remaining.",
        "Choose: 1 / 2 / 3",
      ].join("\n")
    );
  }, 20 * 1000);

  session.timeoutTimer = setTimeout(() => {
    const current = bombSessions.get(key);

    if (!current) return;

    clearBombSession(key);

    socket.sendRoomMessage(`💥 Bomb exploded: ${targetUsername}`);

    if (typeof socket.sendRoomKick === "function") {
      socket.sendRoomKick(targetUsername, bot.roomName);
    }
  }, BOMB_TIMEOUT_MS);

  bombSessions.set(key, session);

  socket.sendRoomMessage(buildBombMessage({ sender, targetUsername }));
}

function handleBombAnswer(context) {
  const { sender, socket, bot, parsed } = context;

  const answer = String(parsed.args[0] || "").trim();

  if (!["1", "2", "3"].includes(answer)) {
    return false;
  }

  const key = makeBombSessionKey(bot.roomName, sender);
  const session = bombSessions.get(key);

  if (!session) {
    return false;
  }

  clearBombSession(key);

  if (answer === session.correctChoice) {
    const player = gamePlayersRepository.addPoints(sender, BOMB_REWARD);

    socket.sendRoomMessage(
      [
        "✅ Bomb defused successfully.",
        `User: ${sender}`,
        `Reward: +${BOMB_REWARD} points`,
        `Balance: ${player.points}`,
      ].join("\n")
    );

    return true;
  }

  socket.sendRoomMessage(
    [
      "💥 Wrong color.",
      `Bomb exploded: ${sender}`,
      `Correct color was: ${session.correctChoice}`,
    ].join("\n")
  );

  if (typeof socket.sendRoomKick === "function") {
    socket.sendRoomKick(sender, bot.roomName);
  }

  return true;
}

function sendRole(socket, role, username, roomName) {
  if (role === "owner" && typeof socket.sendRoomOwner === "function") {
    return socket.sendRoomOwner(username, roomName);
  }

  if (role === "admin" && typeof socket.sendRoomAdmin === "function") {
    return socket.sendRoomAdmin(username, roomName);
  }

  if (role === "member" && typeof socket.sendRoomMember === "function") {
    return socket.sendRoomMember(username, roomName);
  }

  if (role === "none" && typeof socket.sendRoomControlAction === "function") {
    return socket.sendRoomControlAction("none", username, roomName);
  }

  return false;
}

async function handleBlastCommand(context) {
  const { sender, socket, bot, parsed } = context;

  const targetUsername = getTargetUsername(parsed);

  if (!targetUsername) {
    socket.sendRoomMessage("Usage: فجر username / زحلق username");
    return;
  }

  if (isSameUser(sender, targetUsername)) {
    socket.sendRoomMessage("You cannot blast yourself.");
    return;
  }

  if (
    !requireVerifiedForGame({
      socket,
      sender,
      targetUsername,
      roomName: bot.roomName,
      gameName: "Blast",
    })
  ) {
    return;
  }

  if (gamePlayersRepository.hasBombShield(targetUsername)) {
    const remaining =
      gamePlayersRepository.getBombShieldRemainingMs(targetUsername);

    socket.sendRoomMessage(
      [
        "🛡️ Target is protected from blast.",
        `User: ${targetUsername}`,
        `Remaining: ${formatMs(remaining)}`,
      ].join("\n")
    );

    return;
  }

  if (!deductGameCost({ socket, sender })) {
    return;
  }

  const originalRole = getUserRoleFromRoom(bot.roomName, targetUsername);

  socket.sendRoomMessage(
    [
      "🎮 Blast started",
      `By: ${sender}`,
      `Target: ${targetUsername}`,
      `Original role: ${originalRole}`,
    ].join("\n")
  );

  const sequence = [
    "owner",
    "member",
    "admin",
    "owner",
    "admin",
  ];

  for (const role of sequence) {
    sendRole(socket, role, targetUsername, bot.roomName);
    await wait(1000);
  }

  if (typeof socket.sendRoomKick === "function") {
    socket.sendRoomKick(targetUsername, bot.roomName);
  }

  await wait(1000);

  sendRole(socket, originalRole, targetUsername, bot.roomName);

  socket.sendRoomMessage(
    [
      "✅ Blast finished",
      `Target: ${targetUsername}`,
      `Restored role: ${originalRole}`,
    ].join("\n")
  );
}

function getSpinPrizes() {
  return [
    {
      label: "🐊 Crocodile",
      type: "text",
    },
    {
      label: "🐉 Dragon",
      type: "text",
    },
    {
      label: "🚗 Luxury car",
      type: "text",
    },
    {
      label: "🏎️ Sports car",
      type: "text",
    },
    {
      label: "🚌 Golden bus",
      type: "text",
    },
    {
      label: "🚲 Magic bike",
      type: "text",
    },
    {
      label: "✈️ Private airplane",
      type: "text",
    },
    {
      label: "🚀 Rocket trip",
      type: "text",
    },
    {
      label: "🚁 Helicopter ride",
      type: "text",
    },
    {
      label: "🛥️ Luxury yacht",
      type: "text",
    },
    {
      label: "🏝️ Trip to Maldives",
      type: "text",
    },
    {
      label: "🗼 Trip to Paris",
      type: "text",
    },
    {
      label: "🗽 Trip to New York",
      type: "text",
    },
    {
      label: "🏯 Trip to Tokyo",
      type: "text",
    },
    {
      label: "🏜️ Trip to Dubai",
      type: "text",
    },
    {
      label: "🕌 Trip to Istanbul",
      type: "text",
    },
    {
      label: "🏖️ Trip to Bali",
      type: "text",
    },
    {
      label: "🦁 Lion",
      type: "text",
    },
    {
      label: "🐅 Tiger",
      type: "text",
    },
    {
      label: "🐎 Golden horse",
      type: "text",
    },
    {
      label: "🐺 Wolf",
      type: "text",
    },
    {
      label: "🦅 Eagle",
      type: "text",
    },
    {
      label: "👑 Golden crown",
      type: "text",
    },
    {
      label: "💎 Diamond box",
      type: "text",
    },
    {
      label: "🔥 Fire badge",
      type: "text",
    },
    {
      label: "🛡️ One hour blast protection",
      type: "shield",
    },
    {
      label: "🛡️ One hour bomb protection",
      type: "shield",
    },
    {
      label: "💰 500 points",
      type: "points",
      points: 500,
    },
    {
      label: "💰 1,000 points",
      type: "points",
      points: 1000,
    },
    {
      label: "💰 2,000 points",
      type: "points",
      points: 2000,
    },
    {
      label: "💰 5,000 points",
      type: "points",
      points: 5000,
    },
    {
      label: "💰 10,000 points",
      type: "points",
      points: 10000,
    },
    {
      label: "💰 20,000 points",
      type: "points",
      points: 20000,
    },
    {
      label: "🎁 Grand prize 50,000 points",
      type: "points",
      points: 50000,
    },
    {
      label: "🍀 Better luck next time",
      type: "text",
    },
    {
      label: "😅 You won nothing",
      type: "text",
    },
    {
      label: "🎭 Mystery prize: empty box",
      type: "text",
    },
  ];
}

function getSpinCooldownKey(username) {
  return normalizeKey(username);
}

function getSpinCooldownRemaining(username) {
  const key = getSpinCooldownKey(username);
  const lastSpinAt = spinCooldowns.get(key) || 0;

  const elapsed = Date.now() - lastSpinAt;
  const remaining = SPIN_COOLDOWN_MS - elapsed;

  return remaining > 0 ? remaining : 0;
}

function setSpinCooldown(username) {
  const key = getSpinCooldownKey(username);
  spinCooldowns.set(key, Date.now());
}

function handleSpinCommand(context) {
  const { sender, socket } = context;

  const remaining = getSpinCooldownRemaining(sender);

  if (remaining > 0) {
    socket.sendRoomMessage(
      [
        "⏳ Spin cooldown",
        `User: ${sender}`,
        `Try again after: ${formatMs(remaining)}`,
      ].join("\n")
    );

    return;
  }

  setSpinCooldown(sender);

  const prizes = getSpinPrizes();
  const prize = prizes[Math.floor(Math.random() * prizes.length)];

  let extra = "";

  if (prize.type === "points") {
    const player = gamePlayersRepository.addPoints(sender, prize.points);

    extra = [
      "",
      `Points: +${prize.points}`,
      `Balance: ${player.points}`,
    ].join("\n");
  }

  if (prize.type === "shield") {
    gamePlayersRepository.setBombShield(sender, SHIELD_DURATION_MS);

    extra = [
      "",
      "Protection: 1 hour",
    ].join("\n");
  }

  socket.sendRoomMessage(
    [
      "🎰 Spin result",
      `User: ${sender}`,
      `Prize: ${prize.label}`,
      extra,
    ].join("\n")
  );
}

function handleGameCommand(context) {
  const { parsed } = context;

  if (parsed.command === "game_answer") {
    const bombHandled = handleBombAnswer(context);

    if (bombHandled) {
      return true;
    }

    const verifyHandled = handleVerifyAnswer(context);

    if (verifyHandled) {
      return true;
    }

    return false;
  }

  if (parsed.command === "game_bomb") {
    handleBombCommand(context);
    return true;
  }

  if (parsed.command === "game_blast") {
    handleBlastCommand(context).catch((err) => {
      console.log("❌ Blast game error:", err.message);
      context.socket.sendRoomMessage("Blast error.");
    });

    return true;
  }

  if (parsed.command === "game_spin") {
    handleSpinCommand(context);
    return true;
  }

  return false;
}

module.exports = {
  isGameCommand,
  handleGameCommand,
};
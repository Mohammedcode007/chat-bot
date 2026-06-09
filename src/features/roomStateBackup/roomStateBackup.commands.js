const fs = require("fs");
const path = require("path");

const { BOT_OWNER_USERNAME } = require("../../config/env");
const { normalizeUsername } = require("../../utils/text");
const { RoomUsersRepository } = require("../../store/RoomUsersRepository");
const { RoomSettingsRepository } = require("../../store/RoomSettingsRepository");

const roomUsersRepository = new RoomUsersRepository();
const roomSettingsRepository = new RoomSettingsRepository();

const BACKUP_DIR = path.join(process.cwd(), "backup data");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function normalizeForCheck(value) {
  return normalizeUsername(value)
    .replace(/\s+/g, "")
    .replace(/^@+/, "");
}

function isMainBotOwner(username) {
  return normalizeForCheck(username) === normalizeForCheck(BOT_OWNER_USERNAME);
}

function safeRoomFileName(roomName) {
  const cleaned = String(roomName || "room")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);

  return cleaned || "room";
}

function getRoomBackupPath(roomName) {
  ensureBackupDir();
  return path.join(BACKUP_DIR, `${safeRoomFileName(roomName)}.json`);
}

function readRoomBackupFile(roomName) {
  const filePath = getRoomBackupPath(roomName);

  if (!fs.existsSync(filePath)) {
    return {
      roomName,
      allowedSaveUsers: [],
      lastSave: null,
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    return {
      roomName,
      allowedSaveUsers: Array.isArray(data.allowedSaveUsers)
        ? data.allowedSaveUsers
        : [],
      lastSave: data.lastSave || null,
    };
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_READ_ERROR]", err.message);

    return {
      roomName,
      allowedSaveUsers: [],
      lastSave: null,
    };
  }
}

function writeRoomBackupFile(roomName, data) {
  const filePath = getRoomBackupPath(roomName);

  fs.writeFileSync(filePath, JSON.stringify(data || {}, null, 2), "utf8");

  return filePath;
}

function uniqueNames(list) {
  const seen = new Set();
  const result = [];

  (Array.isArray(list) ? list : []).forEach((name) => {
    const value = String(name || "").trim();

    if (!value) return;

    const key = normalizeForCheck(value);

    if (!key || seen.has(key)) return;

    seen.add(key);
    result.push(value);
  });

  return result;
}

function hasName(list, username) {
  const target = normalizeForCheck(username);

  return uniqueNames(list).some((name) => {
    return normalizeForCheck(name) === target;
  });
}

function mergeNames(...lists) {
  return uniqueNames(lists.flat());
}

function isRoomStateBackupCommand(command) {
  return [
    "room_save_allow_add",
    "room_save_allow_remove",
    "room_save_allow_list",
    "room_state_save",
    "room_state_backup",
  ].includes(command);
}

/*
  .SAVE / .BACKUP are allowed only for users inside .rs list.
  Bot owner can manage .rs list, but cannot use .SAVE/.BACKUP
  unless added to .rs list too.
*/
function canUseSaveBackup(roomName, sender) {
  const data = readRoomBackupFile(roomName);
  const senderKey = normalizeForCheck(sender);

  return (data.allowedSaveUsers || []).some((name) => {
    return normalizeForCheck(name) === senderKey;
  });
}

function getRoomSettingsSafe(roomName) {
  try {
    if (typeof roomSettingsRepository.getRoomSettings === "function") {
      return roomSettingsRepository.getRoomSettings(roomName) || {};
    }

    if (typeof roomSettingsRepository.getAll === "function") {
      const all = roomSettingsRepository.getAll() || {};
      return all[String(roomName || "").trim()] || {};
    }

    return {};
  } catch (err) {
    console.log("❌ [ROOM_SETTINGS_READ_ERROR]", err.message);
    return {};
  }
}

function saveRoomSettingsSafe(roomName, settings) {
  try {
    if (typeof roomSettingsRepository.saveRoomSettings === "function") {
      roomSettingsRepository.saveRoomSettings(roomName, settings || {});
      return true;
    }

    if (typeof roomSettingsRepository.setRoomSettings === "function") {
      roomSettingsRepository.setRoomSettings(roomName, settings || {});
      return true;
    }

    if (
      typeof roomSettingsRepository.getAll === "function" &&
      typeof roomSettingsRepository.saveAll === "function"
    ) {
      const all = roomSettingsRepository.getAll() || {};
      const key = String(roomName || "").trim();

      all[key] = settings || {};
      roomSettingsRepository.saveAll(all);
      return true;
    }

    return false;
  } catch (err) {
    console.log("❌ [ROOM_SETTINGS_SAVE_ERROR]", err.message);
    return false;
  }
}

function getFreshBotFromRepository(repository, bot) {
  if (!repository || !bot) {
    return bot;
  }

  try {
    if (typeof repository.getControllerBotByRoom === "function") {
      return repository.getControllerBotByRoom(bot.roomName) || bot;
    }

    if (typeof repository.getBotByRoom === "function") {
      return repository.getBotByRoom(bot.roomName) || bot;
    }

    if (typeof repository.getControllerBots === "function") {
      const bots = repository.getControllerBots() || [];

      return (
        bots.find((item) => {
          return normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName);
        }) || bot
      );
    }

    return bot;
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_GET_BOT_ERROR]", err.message);
    return bot;
  }
}

function saveBotToRepository(repository, bot, nextBot) {
  if (!repository || !bot || !nextBot) {
    return false;
  }

  try {
    if (typeof repository.updateControllerBotByRoom === "function") {
      repository.updateControllerBotByRoom(bot.roomName, nextBot);
      return true;
    }

    if (typeof repository.updateBotByRoom === "function") {
      repository.updateBotByRoom(bot.roomName, nextBot);
      return true;
    }

    if (typeof repository.updateBot === "function") {
      repository.updateBot(bot.roomName, nextBot);
      return true;
    }

    if (
      typeof repository.getControllerBots === "function" &&
      typeof repository.saveControllerBots === "function"
    ) {
      const bots = repository.getControllerBots() || [];

      const nextBots = bots.map((item) => {
        if (normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName)) {
          return nextBot;
        }

        return item;
      });

      repository.saveControllerBots(nextBots);
      return true;
    }

    if (
      typeof repository.getAll === "function" &&
      typeof repository.saveAll === "function"
    ) {
      const all = repository.getAll();

      if (Array.isArray(all)) {
        const next = all.map((item) => {
          if (normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName)) {
            return nextBot;
          }

          return item;
        });

        repository.saveAll(next);
        return true;
      }

      if (all && typeof all === "object") {
        Object.keys(all).forEach((key) => {
          const item = all[key];

          if (
            item &&
            normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName)
          ) {
            all[key] = nextBot;
          }
        });

        repository.saveAll(all);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_BOT_SAVE_ERROR]", err.message);
    return false;
  }
}

function getRoomUsersByRole(roomName) {
  let users = [];

  try {
    if (typeof roomUsersRepository.getRoomUsers === "function") {
      users = roomUsersRepository.getRoomUsers(roomName) || [];
    }
  } catch (err) {
    console.log("❌ [ROOM_USERS_READ_ERROR]", err.message);
  }

  const owners = [];
  const admins = [];
  const members = [];
  const blockeds = [];

  users.forEach((user) => {
    const username = String(
      user.username || user.name || user.user || user.from || ""
    ).trim();

    if (!username) return;

    const role = String(user.role || "").trim().toLowerCase();

    if (role === "creator" || role === "owner") {
      owners.push(username);
      return;
    }

    if (role === "admin") {
      admins.push(username);
      return;
    }

    if (
      role === "blocked" ||
      role === "banned" ||
      role === "ban" ||
      role === "outcast"
    ) {
      blockeds.push(username);
      return;
    }

    members.push(username);
  });

  return {
    owners: uniqueNames(owners),
    admins: uniqueNames(admins),
    members: uniqueNames(members),
    blockeds: uniqueNames(blockeds),
  };
}

function getBannedUsersSafe(roomName) {
  try {
    if (typeof roomUsersRepository.getBannedUsers === "function") {
      return uniqueNames(roomUsersRepository.getBannedUsers(roomName) || []);
    }

    if (typeof roomUsersRepository.getRoomBannedUsers === "function") {
      return uniqueNames(roomUsersRepository.getRoomBannedUsers(roomName) || []);
    }
  } catch (err) {
    console.log("❌ [ROOM_BANNED_READ_ERROR]", err.message);
  }

  return [];
}

function buildCurrentState(context) {
  const { bot, repository } = context;

  const freshBot = getFreshBotFromRepository(repository, bot);
  const usersByRole = getRoomUsersByRole(bot.roomName);
  const banned = getBannedUsersSafe(bot.roomName);

  return {
    savedAt: new Date().toISOString(),
    roomName: bot.roomName,

    owner: uniqueNames([freshBot.owner || bot.owner || ""]),

    masters: uniqueNames(
      Array.isArray(freshBot.masters)
        ? freshBot.masters
        : Array.isArray(bot.masters)
          ? bot.masters
          : []
    ),

    owners: usersByRole.owners,
    admins: usersByRole.admins,
    members: usersByRole.members,
    blockeds: uniqueNames([...usersByRole.blockeds, ...banned]),

    settings: getRoomSettingsSafe(bot.roomName),
  };
}

function formatSaveResult(state) {
  return [
    "✅ Room state saved successfully.",
    "",
    `👑 Bot owner: ${state.owner.length}`,
    `🧩 Masters: ${state.masters.length}`,
    `⭐ Room owners: ${state.owners.length}`,
    `🛡️ Room admins: ${state.admins.length}`,
    `👤 Room members: ${state.members.length}`,
    `🚫 Blocked users: ${state.blockeds.length}`,
    "",
    `Saved at: ${new Date(state.savedAt).toLocaleString()}`,
    "",
    "Use .BACKUP to restore this state.",
  ].join("\n");
}

/*
  These methods match your SocketClient:
  sendRoomMember / sendRoomAdmin / sendRoomOwner / sendRoomBan
*/
function setMember(socket, username, roomName) {
  if (typeof socket.sendRoomMember !== "function") {
    console.log("❌ [RESTORE_ROLE_MISSING_METHOD] sendRoomMember");
    return false;
  }

  return socket.sendRoomMember(username, roomName) !== false;
}

function setAdmin(socket, username, roomName) {
  if (typeof socket.sendRoomAdmin !== "function") {
    console.log("❌ [RESTORE_ROLE_MISSING_METHOD] sendRoomAdmin");
    return false;
  }

  return socket.sendRoomAdmin(username, roomName) !== false;
}

function setOwner(socket, username, roomName) {
  if (typeof socket.sendRoomOwner !== "function") {
    console.log("❌ [RESTORE_ROLE_MISSING_METHOD] sendRoomOwner");
    return false;
  }

  return socket.sendRoomOwner(username, roomName) !== false;
}

function banUser(socket, username, roomName) {
  if (typeof socket.sendRoomBan !== "function") {
    console.log("❌ [RESTORE_ROLE_MISSING_METHOD] sendRoomBan");
    return false;
  }

  return socket.sendRoomBan(username, roomName) !== false;
}

/*
  No direct unban method.
  We use member as a substitute.
*/
function unbanUser(socket, username, roomName) {
  return setMember(socket, username, roomName);
}

function normalizeSavedStateRoles(state) {
  const owners = uniqueNames(state.owners || []);
  let admins = uniqueNames(state.admins || []);
  let members = uniqueNames(state.members || []);
  const blockeds = uniqueNames(state.blockeds || []);

  /*
    Priority:
    blocked > owner > admin > member
  */
  admins = admins.filter((name) => {
    return !hasName(owners, name) && !hasName(blockeds, name);
  });

  members = members.filter((name) => {
    return (
      !hasName(owners, name) &&
      !hasName(admins, name) &&
      !hasName(blockeds, name)
    );
  });

  return {
    owners,
    admins,
    members,
    blockeds,
  };
}

function restoreRoles(context, state) {
  const { socket, bot } = context;

  const saved = normalizeSavedStateRoles(state);
  const current = getRoomUsersByRole(bot.roomName);

  const result = {
    unblocked: 0,
    owners: 0,
    admins: 0,
    members: 0,
    blockeds: 0,
  };

  /*
    Include current + saved users.
    This is required when a user role changed after .SAVE.
  */
  const allKnownUsers = mergeNames(
    current.owners,
    current.admins,
    current.members,
    current.blockeds,
    saved.owners,
    saved.admins,
    saved.members,
    saved.blockeds
  );

  /*
    1) If someone is currently blocked but was not blocked in the saved state,
       give them member as an unban substitute.
  */
  uniqueNames(current.blockeds).forEach((username) => {
    if (!hasName(saved.blockeds, username)) {
      const ok = unbanUser(socket, username, bot.roomName);

      if (ok) {
        result.unblocked += 1;
      }
    }
  });

  /*
    2) Reset all known non-blocked users to member first.
       This fixes Owner -> Admin restore correctly.
  */
  allKnownUsers.forEach((username) => {
    if (hasName(saved.blockeds, username)) {
      return;
    }

    const ok = setMember(socket, username, bot.roomName);

    if (ok) {
      result.members += 1;
    }
  });

  /*
    3) Apply saved admins.
  */
  saved.admins.forEach((username) => {
    const ok = setAdmin(socket, username, bot.roomName);

    if (ok) {
      result.admins += 1;
    }
  });

  /*
    4) Apply saved owners.
  */
  saved.owners.forEach((username) => {
    const ok = setOwner(socket, username, bot.roomName);

    if (ok) {
      result.owners += 1;
    }
  });

  /*
    5) Apply saved blocked users at the end.
  */
  saved.blockeds.forEach((username) => {
    const ok = banUser(socket, username, bot.roomName);

    if (ok) {
      result.blockeds += 1;
    }
  });

  return {
    ...result,
    expected: {
      owners: saved.owners.length,
      admins: saved.admins.length,
      members: saved.members.length,
      blockeds: saved.blockeds.length,
    },
  };
}

function restoreMasters(context, state) {
  const { bot, repository } = context;

  const freshBot = getFreshBotFromRepository(repository, bot);

  const nextBot = {
    ...freshBot,
    owner: state.owner && state.owner[0] ? state.owner[0] : freshBot.owner,
    masters: uniqueNames(state.masters),
  };

  bot.owner = nextBot.owner;
  bot.masters = nextBot.masters;

  return saveBotToRepository(repository, bot, nextBot);
}

function handleAllowAdd(context) {
  const { bot, sender, socket, parsed } = context;

  if (!isMainBotOwner(sender)) {
    socket.sendRoomMessage("Only the bot owner can manage .rs list.");
    return true;
  }

  const username = String(parsed.args[0] || "").trim();

  if (!username) {
    socket.sendRoomMessage("Usage: .rs@username");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);

  data.allowedSaveUsers = uniqueNames([...(data.allowedSaveUsers || []), username]);

  writeRoomBackupFile(bot.roomName, data);

  socket.sendRoomMessage(`✅ Backup access granted in this room: ${username}`);
  return true;
}

function handleAllowRemove(context) {
  const { bot, sender, socket, parsed } = context;

  if (!isMainBotOwner(sender)) {
    socket.sendRoomMessage("Only the bot owner can manage .rs list.");
    return true;
  }

  const username = String(parsed.args[0] || "").trim();

  if (!username) {
    socket.sendRoomMessage("Usage: .rrs@username");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);
  const target = normalizeForCheck(username);

  data.allowedSaveUsers = (data.allowedSaveUsers || []).filter((name) => {
    return normalizeForCheck(name) !== target;
  });

  writeRoomBackupFile(bot.roomName, data);

  socket.sendRoomMessage(`✅ Backup access removed in this room: ${username}`);
  return true;
}

function handleAllowList(context) {
  const { bot, sender, socket } = context;

  if (!isMainBotOwner(sender)) {
    socket.sendRoomMessage("Only the bot owner can view .rs list.");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);
  const list = data.allowedSaveUsers || [];

  if (!list.length) {
    socket.sendRoomMessage("No users are allowed to use .SAVE/.BACKUP in this room.");
    return true;
  }

  socket.sendRoomMessage(
    [
      "📋 Backup access list:",
      "",
      ...list.map((name, index) => `${index + 1}. ${name}`),
    ].join("\n")
  );

  return true;
}

function handleSave(context) {
  const { bot, sender, socket } = context;

  if (!canUseSaveBackup(bot.roomName, sender)) {
    socket.sendRoomMessage("Access denied. You are not allowed to use .SAVE in this room.");
    return true;
  }

  socket.sendRoomMessage("⏳ Saving room state...");

  const data = readRoomBackupFile(bot.roomName);
  const state = buildCurrentState(context);

  data.lastSave = state;
  data.allowedSaveUsers = uniqueNames(data.allowedSaveUsers || []);

  writeRoomBackupFile(bot.roomName, data);

  socket.sendRoomMessage(formatSaveResult(state));
  return true;
}

function handleBackup(context) {
  const { bot, sender, socket } = context;

  if (!canUseSaveBackup(bot.roomName, sender)) {
    socket.sendRoomMessage("Access denied. You are not allowed to use .BACKUP in this room.");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);

  if (!data.lastSave) {
    socket.sendRoomMessage("No saved room state found. Use .SAVE first.");
    return true;
  }

  socket.sendRoomMessage("⏳ Restoring room state...");

  const state = data.lastSave;

  const mastersSaved = restoreMasters(context, state);
  const settingsSaved = saveRoomSettingsSafe(bot.roomName, state.settings || {});
  const roles = restoreRoles(context, state);

  socket.sendRoomMessage(
    [
      "✅ Room state restored.",
      "",
      `👑 Bot owner: ${state.owner.length}`,
      `🧩 Masters: ${state.masters.length} ${mastersSaved ? "ok" : "check"}`,
      `⭐ Room owners: ${roles.owners}/${roles.expected.owners}`,
      `🛡️ Room admins: ${roles.admins}/${roles.expected.admins}`,
      `👤 Members reset: ${roles.members}`,
      `🚫 Blocked users: ${roles.blockeds}/${roles.expected.blockeds}`,
      `🔓 Restored from blocked to member: ${roles.unblocked}`,
      `⚙️ Settings: ${settingsSaved ? "ok" : "check"}`,
      "",
      `Saved at: ${new Date(state.savedAt).toLocaleString()}`,
    ].join("\n")
  );

  return true;
}

function handleRoomStateBackupCommandRouter(context) {
  const { parsed } = context;

  if (parsed.command === "room_save_allow_add") {
    return handleAllowAdd(context);
  }

  if (parsed.command === "room_save_allow_remove") {
    return handleAllowRemove(context);
  }

  if (parsed.command === "room_save_allow_list") {
    return handleAllowList(context);
  }

  if (parsed.command === "room_state_save") {
    return handleSave(context);
  }

  if (parsed.command === "room_state_backup") {
    return handleBackup(context);
  }

  return false;
}

module.exports = {
  isRoomStateBackupCommand,
  handleRoomStateBackupCommandRouter,
};
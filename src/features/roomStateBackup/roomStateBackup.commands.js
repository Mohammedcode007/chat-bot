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

function isRoomStateBackupCommand(command) {
  return [
    "room_save_allow_add",
    "room_save_allow_remove",
    "room_save_allow_list",
    "room_state_save",
    "room_state_backup",
  ].includes(command);
}

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
          return (
            normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName)
          );
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
          if (
            normalizeForCheck(item.roomName) === normalizeForCheck(bot.roomName)
          ) {
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

    if (role === "blocked" || role === "banned" || role === "ban") {
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
  const banned = [];

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

  return banned;
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
    "✅ تم حفظ ضبط الغرفة",
    "",
    `👑 Owner bot: ${state.owner.length}`,
    `🧩 Masters: ${state.masters.length}`,
    `⭐ Owners: ${state.owners.length}`,
    `🛡️ Admins: ${state.admins.length}`,
    `👤 Members: ${state.members.length}`,
    `🚫 Blocked: ${state.blockeds.length}`,
    "",
    `Date: ${new Date(state.savedAt).toLocaleString()}`,
    "",
    ".BACKUP للاسترجاع",
  ].join("\n");
}

function callSocketRole(socket, methods, username, roomName) {
  for (const method of methods) {
    if (typeof socket[method] === "function") {
      try {
        const result = socket[method](username, roomName);

        return result !== false;
      } catch (err) {
        console.log("❌ [ROLE_RESTORE_ERROR]", {
          method,
          username,
          message: err.message,
        });
      }
    }
  }

  return false;
}

function restoreRoles(context, state) {
  const { socket, bot } = context;

  const result = {
    owners: 0,
    admins: 0,
    members: 0,
    blockeds: 0,
  };

  uniqueNames(state.members).forEach((username) => {
    const ok = callSocketRole(
      socket,
      ["sendRoomMember", "sendRoomSetMember", "sendRoomRoleMember"],
      username,
      bot.roomName
    );

    if (ok) result.members += 1;
  });

  uniqueNames(state.admins).forEach((username) => {
    const ok = callSocketRole(
      socket,
      ["sendRoomAdmin", "sendRoomSetAdmin", "sendRoomRoleAdmin"],
      username,
      bot.roomName
    );

    if (ok) result.admins += 1;
  });

  uniqueNames(state.owners).forEach((username) => {
    const ok = callSocketRole(
      socket,
      ["sendRoomOwner", "sendRoomSetOwner", "sendRoomRoleOwner"],
      username,
      bot.roomName
    );

    if (ok) result.owners += 1;
  });

  uniqueNames(state.blockeds).forEach((username) => {
    const ok = callSocketRole(
      socket,
      ["sendRoomBan", "sendRoomBlock", "sendRoomBanned"],
      username,
      bot.roomName
    );

    if (ok) result.blockeds += 1;
  });

  return result;
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
    socket.sendRoomMessage("هذا الأمر لمالك البوت فقط.");
    return true;
  }

  const username = String(parsed.args[0] || "").trim();

  if (!username) {
    socket.sendRoomMessage("الاستخدام: .rs@username");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);

  data.allowedSaveUsers = uniqueNames([...(data.allowedSaveUsers || []), username]);

  writeRoomBackupFile(bot.roomName, data);

  socket.sendRoomMessage(`✅ تم السماح له بالحفظ والباك اب لهذه الغرفة: ${username}`);
  return true;
}

function handleAllowRemove(context) {
  const { bot, sender, socket, parsed } = context;

  if (!isMainBotOwner(sender)) {
    socket.sendRoomMessage("هذا الأمر لمالك البوت فقط.");
    return true;
  }

  const username = String(parsed.args[0] || "").trim();

  if (!username) {
    socket.sendRoomMessage("الاستخدام: .rrs@username");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);
  const target = normalizeForCheck(username);

  data.allowedSaveUsers = (data.allowedSaveUsers || []).filter((name) => {
    return normalizeForCheck(name) !== target;
  });

  writeRoomBackupFile(bot.roomName, data);

  socket.sendRoomMessage(`✅ تم حذف السماح من هذه الغرفة: ${username}`);
  return true;
}

function handleAllowList(context) {
  const { bot, sender, socket } = context;

  if (!isMainBotOwner(sender)) {
    socket.sendRoomMessage("هذا الأمر لمالك البوت فقط.");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);
  const list = data.allowedSaveUsers || [];

  if (!list.length) {
    socket.sendRoomMessage("لا يوجد أشخاص مسموح لهم في هذه الغرفة.");
    return true;
  }

  socket.sendRoomMessage(
    [
      "📋 قائمة المسموح لهم بالحفظ والباك اب:",
      "",
      ...list.map((name, index) => `${index + 1}. ${name}`),
    ].join("\n")
  );

  return true;
}

function handleSave(context) {
  const { bot, sender, socket } = context;

  if (!canUseSaveBackup(bot.roomName, sender)) {
    socket.sendRoomMessage("غير مسموح لك باستخدام .SAVE في هذه الغرفة.");
    return true;
  }

  socket.sendRoomMessage("⏳ جاري حفظ ضبط الغرفة...");

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
    socket.sendRoomMessage("غير مسموح لك باستخدام .BACKUP في هذه الغرفة.");
    return true;
  }

  const data = readRoomBackupFile(bot.roomName);

  if (!data.lastSave) {
    socket.sendRoomMessage("لا توجد نسخة محفوظة. استخدم .SAVE أولًا.");
    return true;
  }

  socket.sendRoomMessage("⏳ جاري استرجاع ضبط الغرفة...");

  const state = data.lastSave;

  const mastersSaved = restoreMasters(context, state);
  const settingsSaved = saveRoomSettingsSafe(bot.roomName, state.settings || {});
  const roles = restoreRoles(context, state);

  socket.sendRoomMessage(
    [
      "✅ تم استرجاع ضبط الغرفة",
      "",
      `👑 Owner bot: ${state.owner.length}`,
      `🧩 Masters: ${state.masters.length} ${mastersSaved ? "ok" : "check"}`,
      `⭐ Owners: ${roles.owners}/${state.owners.length}`,
      `🛡️ Admins: ${roles.admins}/${state.admins.length}`,
      `👤 Members: ${roles.members}/${state.members.length}`,
      `🚫 Blocked: ${roles.blockeds}/${state.blockeds.length}`,
      `⚙️ Settings: ${settingsSaved ? "ok" : "check"}`,
      "",
      `Saved date: ${new Date(state.savedAt).toLocaleString()}`,
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
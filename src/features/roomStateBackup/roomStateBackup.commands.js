const { RoomStateBackupsRepository } = require("../../store/RoomStateBackupsRepository");
const { RoomSettingsRepository } = require("../../store/RoomSettingsRepository");

const roomStateBackupsRepository = new RoomStateBackupsRepository();
const roomSettingsRepository = new RoomSettingsRepository();

function isRoomStateBackupCommand(command) {
  return command === "room_state_save" || command === "room_state_backup";
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function formatDate(value) {
  if (!value) return "unknown";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "unknown";
  }
}

function getRoomSettingsSafe(roomName) {
  try {
    if (typeof roomSettingsRepository.getRoomSettings === "function") {
      return roomSettingsRepository.getRoomSettings(roomName);
    }

    return {};
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_SETTINGS_READ_ERROR]", err.message);
    return {};
  }
}

function saveRoomSettingsSafe(roomName, settings) {
  try {
    if (typeof roomSettingsRepository.saveRoomSettings === "function") {
      roomSettingsRepository.saveRoomSettings(roomName, settings);
      return true;
    }

    if (typeof roomSettingsRepository.setRoomSettings === "function") {
      roomSettingsRepository.setRoomSettings(roomName, settings);
      return true;
    }

    if (
      typeof roomSettingsRepository.getAll === "function" &&
      typeof roomSettingsRepository.saveAll === "function"
    ) {
      const all = roomSettingsRepository.getAll();
      const key = String(roomName || "").trim();

      all[key] = settings || {};
      roomSettingsRepository.saveAll(all);
      return true;
    }

    console.log("❌ [ROOM_BACKUP_SETTINGS_SAVE_ERROR] No save method found.");
    return false;
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_SETTINGS_SAVE_ERROR]", err.message);
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

      const found = bots.find((item) => {
        return String(item.roomName || "").trim().toLowerCase() ===
          String(bot.roomName || "").trim().toLowerCase();
      });

      return found || bot;
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
        if (
          String(item.roomName || "").trim().toLowerCase() ===
          String(bot.roomName || "").trim().toLowerCase()
        ) {
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
            String(item.roomName || "").trim().toLowerCase() ===
            String(bot.roomName || "").trim().toLowerCase()
          ) {
            return nextBot;
          }

          return item;
        });

        repository.saveAll(next);
        return true;
      }

      if (all && typeof all === "object") {
        const keys = Object.keys(all);

        for (const key of keys) {
          const item = all[key];

          if (
            item &&
            String(item.roomName || "").trim().toLowerCase() ===
              String(bot.roomName || "").trim().toLowerCase()
          ) {
            all[key] = nextBot;
            repository.saveAll(all);
            return true;
          }
        }
      }
    }

    console.log("❌ [ROOM_BACKUP_BOT_SAVE_ERROR] No save method found.");
    return false;
  } catch (err) {
    console.log("❌ [ROOM_BACKUP_BOT_SAVE_ERROR]", err.message);
    return false;
  }
}

function buildCurrentRoomState(context) {
  const { bot, repository } = context;

  const freshBot = getFreshBotFromRepository(repository, bot);

  return {
    bot: {
      roomName: bot.roomName,
      owner: freshBot.owner || bot.owner || "",
      masters: Array.isArray(freshBot.masters)
        ? freshBot.masters
        : Array.isArray(bot.masters)
          ? bot.masters
          : [],
    },

    settings: getRoomSettingsSafe(bot.roomName),
  };
}

function restoreRoomState(context, backupData) {
  const { bot, repository } = context;

  const freshBot = getFreshBotFromRepository(repository, bot);

  const nextBot = {
    ...freshBot,
    owner: backupData.bot?.owner || freshBot.owner || bot.owner || "",
    masters: Array.isArray(backupData.bot?.masters)
      ? backupData.bot.masters
      : [],
  };

  /*
    تحديث الذاكرة الحالية حتى يعمل فورًا بدون انتظار restart.
  */
  bot.owner = nextBot.owner;
  bot.masters = nextBot.masters;

  const botSaved = saveBotToRepository(repository, bot, nextBot);
  const settingsSaved = saveRoomSettingsSafe(bot.roomName, backupData.settings || {});

  return {
    botSaved,
    settingsSaved,
  };
}

function handleRoomStateSaveCommand(context) {
  const { bot, sender, socket } = context;

  const state = buildCurrentRoomState(context);

  const saved = roomStateBackupsRepository.saveRoomBackup(bot.roomName, {
    savedBy: sender,
    data: state,
  });

  socket.sendRoomMessage(
    [
      "✅ تم حفظ إعدادات الغرفة",
      `Room: ${bot.roomName}`,
      `By: ${sender}`,
      `Date: ${formatDate(saved.savedAt)}`,
      "",
      ".BACKUP لاسترجاع هذه النسخة",
    ].join("\n")
  );

  return true;
}

function handleRoomStateBackupCommand(context) {
  const { bot, socket } = context;

  const backup = roomStateBackupsRepository.getRoomBackup(bot.roomName);

  if (!backup || !backup.data) {
    socket.sendRoomMessage("لا توجد نسخة محفوظة لهذه الغرفة. استخدم .SAVE أولًا.");
    return true;
  }

  const result = restoreRoomState(context, backup.data);

  socket.sendRoomMessage(
    [
      "✅ تم استرجاع إعدادات الغرفة",
      `Room: ${bot.roomName}`,
      `Saved at: ${formatDate(backup.savedAt)}`,
      `Saved by: ${backup.savedBy || "unknown"}`,
      "",
      `Masters restored: ${
        Array.isArray(backup.data.bot?.masters)
          ? backup.data.bot.masters.length
          : 0
      }`,
      `Bot data: ${result.botSaved ? "ok" : "check repository"}`,
      `Settings: ${result.settingsSaved ? "ok" : "check repository"}`,
    ].join("\n")
  );

  return true;
}

function handleRoomStateBackupCommandRouter(context) {
  const { parsed } = context;

  if (parsed.command === "room_state_save") {
    return handleRoomStateSaveCommand(context);
  }

  if (parsed.command === "room_state_backup") {
    return handleRoomStateBackupCommand(context);
  }

  return false;
}

module.exports = {
  isRoomStateBackupCommand,
  handleRoomStateBackupCommandRouter,
};
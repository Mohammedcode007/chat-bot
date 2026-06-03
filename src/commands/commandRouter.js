
const { parseCommand } = require("./commandParser");

const {
  sendHelp,
  sendHelp1,
  sendHelp2,
  sendHelp3,
  sendHelp4,
  handleWhoami,
  handleStatus,
  requirePermission,
} = require("./controllerCommands");

const {
  isUserLookupCommand,
  handleUserLookupCommand,
} = require("../features/userLookup/userLookup.commands");

const {
  isRoomSettingsCommand,
  handleRoomSettingsCommand,
} = require("../features/roomSettings/roomSettings.commands");
const {
  isTransferPointsCommand,
  handleTransferPointsCommand,
} = require("../features/gamePoints/transferPoints.commands");
const {
  isRoomFeatureEnabled,
} = require("../features/roomSettings/roomSettings.guard");
const {
  isGameCommand,
  handleGameCommand,
} = require("../features/games/game.commands");
const {
  isWatchCommand,
  handleWatchCommand,
} = require("../features/watch/watch.commands");

const {
  createSession,
  nextPage,
  getPageItems,
  getPageInfo,
} = require("./paginationSessions");

const {
  handleControllerControlCommand,
} = require("../features/controllerControl/controllerControl.commands");

const {
  saveListActionSession,
  refreshListActionSession,
} = require("../features/listActions/listActionSessions");

const {
  handleInviteCommand,
} = require("../features/listActions/invite.commands");

const {
  handleProfileLookupCommand,
} = require("../features/profileLookup/profileLookup.commands");

const { RoomUsersRepository } = require("../store/RoomUsersRepository");

const { handleMasterCommand } = require("../features/masters/master.commands");
const { handleSilentBotCommand } = require("../features/silentBots/silentBot.commands");
const { handleProfileCommand } = require("../features/profile/profile.commands");
const { handleRoomCommand } = require("../features/rooms/room.commands");
const { handleSystemCommand } = require("../features/system/system.commands");
const { handleBotAdminCommand } = require("../features/admins/admin.commands");
const { handleVerificationCommand } = require("../features/verification/verification.commands");
const { handleVipCommand } = require("../features/vip/vip.commands");

const {
  isMusicCommand,
  handleMusicCommand,
} = require("../features/music/music.commands");

function formatUsersPage(title, session) {
  const items = getPageItems(session);
  const info = getPageInfo(session);

  const lines = items.map((user, index) => {
    const number = session.page * 10 + index + 1;
    const role = user.role ? ` - ${user.role}` : "";
    return `${number}. ${user.username}${role}`;
  });

  return [
    title,
    `Page: ${info.currentPage}/${info.totalPages}`,
    `Total: ${info.totalItems}`,
    "",
    ...lines,
    "",
    info.currentPage < info.totalPages ? "Next: .nx" : "Last page.",
  ].join("\n");
}

function handleUsersCommand(context) {
  const roomUsersRepository = new RoomUsersRepository();

  const users = roomUsersRepository.getRoomUsers(context.bot.roomName);

  if (!users.length) {
    context.socket.sendRoomMessage("No saved users.");
    return;
  }

  const session = createSession({
    roomName: context.bot.roomName,
    sender: context.sender,
    type: "users",
    items: users,
  });

  /*
    حتى تعمل أوامر الأرقام أيضًا مع !users:
    m@5 / k@5 / i@1-5
  */
  saveListActionSession({
    roomName: context.bot.roomName,
    sender: context.sender,
    type: "users",
    items: users,
    page: session.page || 0,
  });

  context.socket.sendRoomMessage(formatUsersPage("Current users:", session));
}

function handleRecentCommand(context) {
  const roomUsersRepository = new RoomUsersRepository();

  const users = roomUsersRepository.getRecentUsers(context.bot.roomName);

  if (!users.length) {
    context.socket.sendRoomMessage("No recent users.");
    return;
  }

  const session = createSession({
    roomName: context.bot.roomName,
    sender: context.sender,
    type: "recent",
    items: users,
  });

  saveListActionSession({
    roomName: context.bot.roomName,
    sender: context.sender,
    type: "recent",
    items: users,
    page: session.page || 0,
  });

  context.socket.sendRoomMessage(formatUsersPage("Recent users:", session));
}

function handleNextPageCommand(context) {
  const result = nextPage(context.bot.roomName, context.sender);

  if (!result.ok) {
    if (result.reason === "expired") {
      context.socket.sendRoomMessage("Page expired. Send !users or .r again.");
      return;
    }

    if (result.reason === "last_page") {
      context.socket.sendRoomMessage("No more pages.");
      return;
    }

    context.socket.sendRoomMessage("No active page.");
    return;
  }

  const title =
    result.session.type === "recent" ? "Recent users:" : "Current users:";

  /*
    يبدأ عدّاد الدقيقة من جديد بعد .nx
  */
  saveListActionSession({
    roomName: context.bot.roomName,
    sender: context.sender,
    type: result.session.type,
    items: result.session.items || [],
    page: result.session.page || 0,
  });

  refreshListActionSession(context.bot.roomName, context.sender);

  context.socket.sendRoomMessage(formatUsersPage(title, result.session));
}

function handleCommand(context) {
  const { text, socket, runtime } = context;

  const parsed = parseCommand(text);

  if (!parsed) {
    return;
  }

  context.parsed = parsed;

  const { command } = parsed;
  /*
  Game points transfer
  tr@username@points
*/
if (isTransferPointsCommand(command)) {
  handleTransferPointsCommand(context);
  return;
}
/*
  Games
*/
if (isGameCommand(command)) {
  const handled = handleGameCommand(context);

  if (handled) {
    return;
  }
}
  /*
    =====================================================
    1) Help pages
    تحتاج owner/master
    =====================================================
  */
  if (["help", "help1", "help2", "help3", "help4"].includes(command)) {
    const allowed = requirePermission(context, { silent: true });

    if (!allowed) return;

    if (command === "help") return sendHelp(socket);
    if (command === "help1") return sendHelp1(socket);
    if (command === "help2") return sendHelp2(socket);
    if (command === "help3") return sendHelp3(socket);
    if (command === "help4") return sendHelp4(socket);
  }

  /*
    =====================================================
    2) Settings commands
    يجب أن تعمل دائمًا للماستر/الأونر حتى لو كل شيء off
    =====================================================
  */
  if (isRoomSettingsCommand(command)) {
    if (!requirePermission(context)) {
      return;
    }

    handleRoomSettingsCommand(context);
    return;
  }

  /*
    =====================================================
    3) User lookup
    is@username
    مربوط بـ set@lookup@on/off
    =====================================================
  */
  if (isUserLookupCommand(command)) {
    if (!isRoomFeatureEnabled(context.bot.roomName, "lookupEnabled")) {
      context.socket.sendRoomMessage("Lookup is disabled in this room.");
      return;
    }

    handleUserLookupCommand(context);
    return;
  }

  /*
    =====================================================
    4) Watch
    watch@username / unwatch@username
    مربوط بـ set@watch@on/off
    =====================================================
  */
  if (isWatchCommand(command)) {
    if (!isRoomFeatureEnabled(context.bot.roomName, "watchEnabled")) {
      context.socket.sendRoomMessage("Watch is disabled in this room.");
      return;
    }

    handleWatchCommand(context);
    return;
  }

  /*
    =====================================================
    5) Bot Admin
    admin@username / radmin@username
    تعمل في أي غرفة، لكن ملف admin.commands يتحقق من BOT_OWNER_USERNAME
    =====================================================
  */
  if (command === "adminadd" || command === "adminremove") {
    handleBotAdminCommand(context);
    return;
  }

  /*
    =====================================================
    6) Verification
    v@username / unver@username
    =====================================================
  */
  if (command === "verify" || command === "unverify") {
    handleVerificationCommand(context);
    return;
  }

  /*
    =====================================================
    7) VIP
    vip@username / unvip@username
    =====================================================
  */
  if (command === "vip" || command === "unvip") {
    handleVipCommand(context);
    return;
  }

  /*
    =====================================================
    8) Music
    مربوط بـ set@music@on/off
    لو بوت الأغاني موجود في نفس الغرفة، بوت التحكم لا يرد حتى لا يتكرر الرد
    =====================================================
  */
  if (isMusicCommand(command)) {
    if (!isRoomFeatureEnabled(context.bot.roomName, "musicEnabled")) {
      context.socket.sendRoomMessage("Music is disabled in this room.");
      return;
    }

    if (
      runtime &&
      typeof runtime.hasMusicBot === "function" &&
      runtime.hasMusicBot(context.bot.roomName)
    ) {
      return;
    }

    handleMusicCommand(context).catch((err) => {
      console.log("❌ Music command error:", err.message);
      context.socket.sendRoomMessage("Music error.");
    });

    return;
  }

  /*
    =====================================================
    9) باقي الأوامر تحتاج owner/master
    =====================================================
  */
  if (!requirePermission(context)) {
    return;
  }

  /*
    Invite
    i@username / i@5 / i@1-5
    مربوط بـ set@invite@on/off
  */
  if (command === "invite_user") {
    if (!isRoomFeatureEnabled(context.bot.roomName, "inviteEnabled")) {
      context.socket.sendRoomMessage("Invite is disabled in this room.");
      return;
    }

    handleInviteCommand(context).catch((err) => {
      console.log("❌ Invite command error:", err.message);
      context.socket.sendRoomMessage("Invite error.");
    });

    return;
  }

  /*
    Control
    m@ / k@ / b@ / o@ / a@
    حماية VIP نفسها تكون داخل controllerControl.commands.js
    حسب set@vipprotect@on/off
  */
  if (
    command === "control_member" ||
    command === "control_kick" ||
    command === "control_ban" ||
    command === "control_owner" ||
    command === "control_admin"
  ) {
    handleControllerControlCommand(context);
    return;
  }

  /*
    Profile lookup
    p@username
    مربوط بـ set@profile@on/off
  */
  if (command === "profile_lookup") {
    if (!isRoomFeatureEnabled(context.bot.roomName, "profileEnabled")) {
      context.socket.sendRoomMessage("Profile lookup is disabled in this room.");
      return;
    }

    handleProfileLookupCommand(context);
    return;
  }

  if (command === "nx") {
    handleNextPageCommand(context);
    return;
  }

  if (command === "recent") {
    handleRecentCommand(context);
    return;
  }

  if (command === "whoami") {
    handleWhoami(context);
    return;
  }

  if (command === "status") {
    handleStatus(context);
    return;
  }

  if (command === "users") {
    handleUsersCommand(context);
    return;
  }

  if (command === "master" || command === "mas" || command === "rmas") {
    handleMasterCommand(context);
    return;
  }

  if (command === "silent") {
    handleSilentBotCommand(context);
    return;
  }

  if (command === "profile") {
    handleProfileCommand(context);
    return;
  }

  if (command === "room") {
    handleRoomCommand(context);
    return;
  }

  if (command === "system") {
    handleSystemCommand(context);
    return;
  }

  socket.sendRoomMessage("Unknown command. Send help");
}

module.exports = {
  handleCommand,
};
const { getUserRole, canUseController } = require("./permissions");

function sendHelp(socket) {
  socket.sendRoomMessage(
    [
      "╔══ Bot Help ══╗",
      "help1 : Masters",
      "help2 : Silent bots",
      "help3 : Room/System",
      "help4 : te-bot private",
      "╚══════════════╝",
    ].join("\n")
  );
}

function sendHelp1(socket) {
  socket.sendRoomMessage(
    [
      "╔══ Help 1 ══╗",
      "Masters",
      "",
      "mas@username",
      "rmas@username",
      "!whoami",
      "",
      "mas = add master",
      "rmas = remove master",
      "╚═══════════╝",
    ].join("\n")
  );
}

function sendHelp2(socket) {
  socket.sendRoomMessage(
    [
      "╔══ Help 2 ══╗",
      "🤫 Silent Bots",
      "",
      "!silent add user pass",
      "!silent add user pass room",
      "!silent remove username",
      "!silent list",
      "",
      "Only owner/master.",
      "╚═══════════╝",
    ].join("\n")
  );
}

function sendHelp3(socket) {
  socket.sendRoomMessage(
    [
      "╔══ Help 3 ══╗",
      "Room/System",
      "",
      "!status",
      "!users",
      ".r",
      ".nx",
      "",
      "Pages expire in 60s.",
      "╚═══════════╝",
    ].join("\n")
  );
}

function sendHelp4(socket) {
  socket.sendRoomMessage(
    [
      "╔══ Help 4 ══╗",
      "Bot Admin / Verify / VIP",
      "",
      "admin@username",
      "radmin@username",
      "",
      "v@username",
      "unver@username",
      "",
      "vip@username",
      "unvip@username",
      "",
      "admin/radmin: bot owner only",
      "vip/unvip: bot owner only",
      "v/unver: bot admins only",
      "╚═══════════╝",
    ].join("\n")
  );
}

function handleWhoami({ bot, sender, socket }) {
  const role = getUserRole(bot, sender);

  socket.sendRoomMessage(
    [
      "╔══ Whoami ══╗",
      `User: ${sender}`,
      `Role: ${role}`,
      "╚════════════╝",
    ].join("\n")
  );
}

function handleStatus({ bot, socket, repository }) {
  const silentBots = repository.getSilentBotsByRoom(bot.roomName);

  socket.sendRoomMessage(
    [
      "╔══ Bot Status ══╗",
      `Room: ${bot.roomName}`,
      `Owner: ${bot.owner}`,
      `Masters: ${(bot.masters || []).length}`,
      `Silent bots: ${silentBots.length}`,
      "╚═══════════════╝",
    ].join("\n")
  );
}

function requirePermission({ bot, sender, socket }, options = {}) {
  const silent = options.silent === true;

  if (!canUseController(bot, sender)) {
    if (!silent) {
      socket.sendRoomMessage("No permission.");
    }

    return false;
  }

  return true;
}

module.exports = {
  sendHelp,
  sendHelp1,
  sendHelp2,
  sendHelp3,
  sendHelp4,
  handleWhoami,
  handleStatus,
  requirePermission,
};
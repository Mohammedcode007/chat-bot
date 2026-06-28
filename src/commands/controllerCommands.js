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
      "ms@username",
      "rms@username",
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
function sendHelp5(socket) {
  socket.sendRoomMessage(
    [
      "💾 Save / Backup Commands",
      "",
      "Permissions:",
      ".rs@username  - allow user to use save/backup",
      ".rrs@username - remove user from save/backup list",
      ".rsl          - show allowed save users",
      "",
      "Save / Restore:",
      ".save         - save current room state",
      ".backup       - restore full saved room state",
      "",
      "Show saved data:",
      "l@all         - saved summary",
      "l@bo          - saved bot owner",
      "l@ms          - saved masters",
      "l@ow          - saved room owners",
      "l@ad          - saved admins",
      "l@mb          - saved members",
      "l@bl          - saved blocked users",
      "l@st          - saved settings",
      "",
      "Pages:",
      ".next         - next page within 1 minute",
      "",
      "Partial restore:",
      "r@all         - restore all saved data",
      "r@bo          - restore bot owner only",
      "r@ms          - restore masters only",
      "r@ow          - restore room owners only",
      "r@ad          - restore admins only",
      "r@mb          - restore members only",
      "r@bl          - restore blocked users only",
      "r@st          - restore settings only",
      "",
      "Example:",
      ".save",
      "l@all",
      "l@mb",
      ".next",
      "r@mb",
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
  sendHelp5,
  handleWhoami,
  handleStatus,
  requirePermission,
};
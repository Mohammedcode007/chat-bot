const LOG_PAGE_SIZE = 10;
const LOG_SESSION_TTL_MS = 60 * 1000;

const sessions = new Map();

function makeKey(username) {
  return String(username || "").trim().toLowerCase();
}

function createLogSession({ username, logs }) {
  const key = makeKey(username);

  const old = sessions.get(key);

  if (old && old.timer) {
    clearTimeout(old.timer);
  }

  const session = {
    username,
    logs: Array.isArray(logs) ? logs : [],
    page: 0,
    expiresAt: Date.now() + LOG_SESSION_TTL_MS,
    timer: setTimeout(() => {
      sessions.delete(key);
    }, LOG_SESSION_TTL_MS),
  };

  sessions.set(key, session);

  return session;
}

function getLogSession(username) {
  const key = makeKey(username);
  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    if (session.timer) clearTimeout(session.timer);
    sessions.delete(key);
    return null;
  }

  return session;
}

function nextLogPage(username) {
  const session = getLogSession(username);

  if (!session) {
    return {
      ok: false,
      reason: "expired",
    };
  }

  const totalPages = Math.max(1, Math.ceil(session.logs.length / LOG_PAGE_SIZE));

  if (session.page + 1 >= totalPages) {
    return {
      ok: false,
      reason: "last_page",
    };
  }

  session.page += 1;
  session.expiresAt = Date.now() + LOG_SESSION_TTL_MS;

  if (session.timer) clearTimeout(session.timer);

  session.timer = setTimeout(() => {
    sessions.delete(makeKey(username));
  }, LOG_SESSION_TTL_MS);

  sessions.set(makeKey(username), session);

  return {
    ok: true,
    session,
  };
}

function getCurrentLogPage(session) {
  const start = session.page * LOG_PAGE_SIZE;
  const end = start + LOG_PAGE_SIZE;

  return session.logs.slice(start, end);
}

function formatLogPage(session) {
  const logs = getCurrentLogPage(session);
  const totalPages = Math.max(1, Math.ceil(session.logs.length / LOG_PAGE_SIZE));
  const currentPage = session.page + 1;

  if (!logs.length) {
    return "No logs found.";
  }

  const lines = logs.map((log, index) => {
    const number = session.page * LOG_PAGE_SIZE + index + 1;
    const time = new Date(log.createdAt).toLocaleString();

    return [
      `${number}. ${log.action}`,
      `Target: ${log.target}`,
      `By: ${log.performer}`,
      `Room: ${log.roomName}`,
      `Time: ${time}`,
    ].join("\n");
  });

  return [
    "Control logs",
    `Page: ${currentPage}/${totalPages}`,
    `Total: ${session.logs.length}`,
    "",
    ...lines.map((item) => `${item}\n`),
    currentPage < totalPages ? "Send: more" : "Last page.",
  ].join("\n");
}

module.exports = {
  LOG_PAGE_SIZE,
  LOG_SESSION_TTL_MS,
  createLogSession,
  getLogSession,
  nextLogPage,
  formatLogPage,
};
const sessions = new Map();

const PAGE_SIZE = 10;
const SESSION_TTL_MS = 60 * 1000;

function makeKey(roomName, sender) {
  return `${String(roomName || "").trim()}::${String(sender || "").trim()}`.toLowerCase();
}

function createSession({ roomName, sender, type, items }) {
  const key = makeKey(roomName, sender);

  sessions.set(key, {
    roomName,
    sender,
    type,
    items: Array.isArray(items) ? items : [],
    page: 0,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return sessions.get(key);
}

function getSession(roomName, sender) {
  const key = makeKey(roomName, sender);
  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(key);
    return null;
  }

  return session;
}

function nextPage(roomName, sender) {
  const session = getSession(roomName, sender);

  if (!session) {
    return {
      ok: false,
      reason: "expired",
    };
  }

  const maxPage = Math.ceil(session.items.length / PAGE_SIZE) - 1;

  if (session.page >= maxPage) {
    return {
      ok: false,
      reason: "last_page",
      session,
    };
  }

  session.page += 1;
  session.expiresAt = Date.now() + SESSION_TTL_MS;

  return {
    ok: true,
    session,
  };
}

function getPageItems(session) {
  const start = session.page * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  return session.items.slice(start, end);
}

function getPageInfo(session) {
  return {
    currentPage: session.page + 1,
    totalPages: Math.max(1, Math.ceil(session.items.length / PAGE_SIZE)),
    totalItems: session.items.length,
  };
}

module.exports = {
  PAGE_SIZE,
  SESSION_TTL_MS,
  createSession,
  getSession,
  nextPage,
  getPageItems,
  getPageInfo,
};
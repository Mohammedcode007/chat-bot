const LIST_SESSION_TTL_MS = 60 * 1000;
const PAGE_SIZE = 10;

const sessions = new Map();

function makeKey(roomName, sender) {
  return `${String(roomName || "").trim().toLowerCase()}::${String(
    sender || ""
  ).trim().toLowerCase()}`;
}

function clearTimer(session) {
  if (session && session.timer) {
    clearTimeout(session.timer);
  }
}

function saveListActionSession({ roomName, sender, items, page = 0, type = "recent" }) {
  const key = makeKey(roomName, sender);

  const oldSession = sessions.get(key);
  clearTimer(oldSession);

  const safeItems = Array.isArray(items) ? items : [];

  const session = {
    roomName,
    sender,
    items: safeItems,
    page: Number(page || 0),
    type,
    createdAt: Date.now(),
    expiresAt: Date.now() + LIST_SESSION_TTL_MS,
    timer: setTimeout(() => {
      sessions.delete(key);
    }, LIST_SESSION_TTL_MS),
  };

  sessions.set(key, session);

  return session;
}

function refreshListActionSession(roomName, sender) {
  const key = makeKey(roomName, sender);
  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  clearTimer(session);

  session.expiresAt = Date.now() + LIST_SESSION_TTL_MS;
  session.timer = setTimeout(() => {
    sessions.delete(key);
  }, LIST_SESSION_TTL_MS);

  sessions.set(key, session);

  return session;
}

function getListActionSession(roomName, sender) {
  const key = makeKey(roomName, sender);
  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    clearTimer(session);
    sessions.delete(key);
    return null;
  }

  return session;
}

function getCurrentPageItems(session) {
  if (!session) {
    return [];
  }

  const page = Number(session.page || 0);
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  return session.items.slice(start, end);
}

function getUsernameFromItem(item) {
  if (!item) {
    return "";
  }

  if (typeof item === "string") {
    return item.trim();
  }

  return String(
    item.username ||
      item.name ||
      item.user ||
      item.from ||
      item.userName ||
      ""
  ).trim();
}

function resolveTargetFromSession({ roomName, sender, target }) {
  const rawTarget = String(target || "").trim();

  if (!rawTarget) {
    return {
      ok: false,
      reason: "missing_target",
    };
  }

  const session = getListActionSession(roomName, sender);

  /*
    لو الهدف ليس رقمًا ولا range، نرجعه كاسم عادي.
  */
  if (!/^\d+(-\d+)?$/.test(rawTarget)) {
    return {
      ok: true,
      type: "single",
      usernames: [rawTarget],
      fromSession: false,
    };
  }

  if (!session) {
    return {
      ok: false,
      reason: "expired_or_missing_session",
    };
  }

  const pageItems = getCurrentPageItems(session);

  if (!pageItems.length) {
    return {
      ok: false,
      reason: "empty_page",
    };
  }

  /*
    رقم واحد:
    5
  */
  if (/^\d+$/.test(rawTarget)) {
    const number = Number(rawTarget);
    const index = number - 1;

    if (index < 0 || index >= pageItems.length) {
      return {
        ok: false,
        reason: "number_out_of_page",
      };
    }

    const username = getUsernameFromItem(pageItems[index]);

    if (!username) {
      return {
        ok: false,
        reason: "empty_username",
      };
    }

    return {
      ok: true,
      type: "single",
      usernames: [username],
      fromSession: true,
    };
  }

  /*
    Range:
    1-5
  */
  const [startRaw, endRaw] = rawTarget.split("-");
  const start = Number(startRaw);
  const end = Number(endRaw);

  if (!start || !end || start > end) {
    return {
      ok: false,
      reason: "invalid_range",
    };
  }

  const usernames = [];

  for (let number = start; number <= end; number += 1) {
    const index = number - 1;

    if (index < 0 || index >= pageItems.length) {
      continue;
    }

    const username = getUsernameFromItem(pageItems[index]);

    if (username) {
      usernames.push(username);
    }
  }

  if (!usernames.length) {
    return {
      ok: false,
      reason: "range_empty",
    };
  }

  return {
    ok: true,
    type: "range",
    usernames,
    fromSession: true,
  };
}

module.exports = {
  LIST_SESSION_TTL_MS,
  PAGE_SIZE,
  saveListActionSession,
  refreshListActionSession,
  getListActionSession,
  getCurrentPageItems,
  resolveTargetFromSession,
};
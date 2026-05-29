const WebSocket = require("ws");

const {
  WS_URL,
  BOT_SESSION,
  BOT_SDK,
  BOT_VERSION,
} = require("../config/env");

/*
  هذا الملف مسؤول عن جلب بروفايل مستخدم من سيرفر الشات.

  يتم استخدامه من:
  src/features/profileLookup/profileApi.js

  بهذا الشكل:
  fetchUserProfile({
    username,
    password,
    targetId,
  })
*/

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createRoomMessage(roomName, body) {
  return {
    handler: "room_message",
    id: makeId("profile_msg"),
    room: roomName,
    type: "text",
    body: String(body || ""),
    url: "",
    length: "",
  };
}

function safeClose(ws) {
  try {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      ws.close();
    }
  } catch {
    // ignore
  }
}

function extractProfileFromMessage(data) {
  /*
    نحاول دعم أكثر من شكل محتمل للرد من السيرفر
    لأن بعض السيرفرات ترجع البيانات في profile
    وبعضها في user / data / result
  */

  if (!data || typeof data !== "object") {
    return null;
  }

  if (data.profile && typeof data.profile === "object") {
    return data.profile;
  }

  if (data.user && typeof data.user === "object") {
    return data.user;
  }

  if (data.data && typeof data.data === "object") {
    return data.data;
  }

  if (data.result && typeof data.result === "object") {
    return data.result;
  }

  /*
    لو نفس الرسالة تحتوي حقول البروفايل مباشرة
  */
  const profileKeys = [
    "user_id",
    "photo_url",
    "country",
    "gender",
    "views",
    "sent_gifts",
    "received_gifts",
    "roster_count",
    "is_vip",
    "status",
    "reg_date",
    "last_activity",
  ];

  const hasProfileKeys = profileKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(data, key)
  );

  if (hasProfileKeys) {
    return data;
  }

  return null;
}

function isProfileResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  /*
    أسماء محتملة للـ handler حسب السيرفر
  */
  const handler = String(data.handler || "").toLowerCase();
  const type = String(data.type || "").toLowerCase();

  if (
    handler.includes("profile") ||
    handler.includes("user_profile") ||
    handler.includes("get_profile") ||
    type.includes("profile")
  ) {
    return true;
  }

  return Boolean(extractProfileFromMessage(data));
}

function normalizeProfile(profile, targetId) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  return {
    ...profile,

    /*
      بعض الردود ترجع الاسم في username
      وبعضها في type
      الكود القديم عندك كان يستخدم profile.type
    */
    type:
      profile.type ||
      profile.username ||
      profile.name ||
      targetId,

    username:
      profile.username ||
      profile.type ||
      profile.name ||
      targetId,

    photo_url:
      profile.photo_url ||
      profile.photoUrl ||
      profile.avatar ||
      profile.image ||
      profile.photo ||
      "",
  };
}

function buildProfileRequestPayload(targetId) {
  /*
    مهم:
    لو السيرفر عندك يستخدم handler مختلف لجلب البروفايل،
    غيّر هذا الجزء فقط.

    هذا الكود يرسل أكثر من مفتاح شائع:
    targetId / target_id / username / user
    حتى يزيد فرصة توافقه مع السيرفر.
  */

  return {
    handler: "profile",
    id: makeId("profile"),
    type: "get",
    targetId: String(targetId),
    target_id: String(targetId),
    username: String(targetId),
    user: String(targetId),
  };
}

function fetchUserProfile({ username, password, targetId, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const botUsername = String(username || "").trim();
    const botPassword = String(password || "").trim();
    const targetUsername = String(targetId || "").trim();

    if (!botUsername || !botPassword) {
      reject(new Error("Missing profile bot username or password"));
      return;
    }

    if (!targetUsername) {
      reject(new Error("Missing targetId"));
      return;
    }

    const ws = new WebSocket(WS_URL);

    let finished = false;
    let loggedIn = false;

    const finish = (err, profile = null) => {
      if (finished) return;

      finished = true;
      clearTimeout(timer);
      safeClose(ws);

      if (err) {
        reject(err);
        return;
      }

      resolve(profile);
    };

    const timer = setTimeout(() => {
      finish(new Error("Profile request timeout"));
    }, timeoutMs);

    ws.on("open", () => {
      const loginPayload = {
        handler: "login",
        username: botUsername,
        password: botPassword,
        session: BOT_SESSION,
        sdk: BOT_SDK,
        ver: BOT_VERSION,
        id: makeId("login"),
      };

      console.log("🔐 [PROFILE_LOGIN_SEND]", {
        username: botUsername,
        targetId: targetUsername,
      });

      ws.send(JSON.stringify(loginPayload));
    });

    ws.on("message", (message) => {
      let data;

      try {
        data = JSON.parse(message.toString());
      } catch {
        return;
      }

      console.log("📥 [PROFILE_SOCKET_EVENT]", data);

      if (
        data.handler === "login_event" &&
        data.type === "success" &&
        !loggedIn
      ) {
        loggedIn = true;

        const requestPayload = buildProfileRequestPayload(targetUsername);

        console.log("📤 [PROFILE_REQUEST_SEND]", requestPayload);

        ws.send(JSON.stringify(requestPayload));
        return;
      }

      if (
        data.handler === "login_event" &&
        data.type !== "success"
      ) {
        finish(new Error("Profile bot login failed"));
        return;
      }

      if (
        data.handler === "error" ||
        data.type === "error" ||
        data.error
      ) {
        finish(
          new Error(
            data.message ||
              data.error ||
              "Profile server returned error"
          )
        );
        return;
      }

      if (isProfileResponse(data)) {
        const rawProfile = extractProfileFromMessage(data);
        const profile = normalizeProfile(rawProfile, targetUsername);

        if (!profile) {
          finish(new Error("Profile response received but profile is empty"));
          return;
        }

        finish(null, profile);
      }
    });

    ws.on("error", (error) => {
      finish(error);
    });

    ws.on("close", () => {
      if (!finished && !loggedIn) {
        finish(new Error("Profile socket closed before login"));
      }
    });
  });
}

function getGenderText(gender) {
  const value = String(gender || "").trim();

  if (value === "1") return "♂️ Male";
  if (value === "2") return "♀️ Female";

  return "❓ Unknown";
}

function getVipText(isVip) {
  return String(isVip || "").trim() === "1" ? "💎 Yes" : "❌ No";
}

function getOnlineText(lastActivity) {
  return String(lastActivity || "").trim() === "-1"
    ? "🟢 Online"
    : "⚫ Offline";
}

function getStatusText(status) {
  const value = String(status || "").trim();

  if (!value) return "No status";
  if (value.length > 100) return "Long status message";

  return value;
}

function formatProfileInfo(profile) {
  return `━━━━━━━━━━━━━━━━
👤 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━
🆔 Username: ${profile?.type || profile?.username || "N/A"}
🆕 User ID: ${profile?.user_id || "N/A"}
🌐 Country: ${profile?.country || "N/A"}
🚻 Gender: ${getGenderText(profile?.gender)}
👁️ Views: ${profile?.views || "0"}
🎁 Sent Gifts: ${profile?.sent_gifts || "0"}
🎉 Received Gifts: ${profile?.received_gifts || "0"}
👥 Friends: ${profile?.roster_count || "0"}
💎 VIP: ${getVipText(profile?.is_vip)}
🔋 Status: ${getStatusText(profile?.status)}
📅 Registered: ${profile?.reg_date || "N/A"}
📶 Status: ${getOnlineText(profile?.last_activity)}
━━━━━━━━━━━━━━━━`;
}

async function handleProfileCommand(context) {
  const { parsed, socket, bot } = context;

  const targetId = String(parsed?.args?.[0] || "").trim();

  if (!targetId) {
    socket.sendRoomMessage("Usage: profile username");
    return;
  }

  try {
    const profile = await fetchUserProfile({
      username: bot.username,
      password: bot.password,
      targetId,
    });

    if (!profile) {
      socket.sendRoomMessage("Profile not found.");
      return;
    }

    socket.sendRoomMessage(formatProfileInfo(profile));
  } catch (error) {
    console.log("❌ [HANDLE_PROFILE_COMMAND_ERROR]", {
      message: error.message,
      stack: error.stack,
    });

    socket.sendRoomMessage(`Profile error: ${error.message}`);
  }
}

module.exports = {
  handleProfileCommand,
  fetchUserProfile,
};
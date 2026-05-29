const path = require("path");
const { JsonStore } = require("../../store/JsonStore");
const { BOT_OWNER_USERNAME } = require("../../config/env");

/*
  مهم:
  عدّل هذا المسار حسب مكان دالة fetchUserProfile عندك.

  لو عندك ملف قديم:
  commands/profileCommand.js

  انقل منه دالة fetchUserProfile إلى:
  src/features/profileLookup/profileApi.js

  أو غيّر require هنا للمسار الصحيح.
*/
const { fetchUserProfile } = require("./profileApi");

const usersStore = new JsonStore(
  path.join(__dirname, "../../data/users.json"),
  []
);

function getTargetUsername(parsed) {
  return String(parsed?.args?.[0] || "").trim();
}

function createRoomTextPayload(roomName, body) {
  return {
    handler: "room_message",
    id: Date.now().toString(),
    room: roomName,
    type: "text",
    body: String(body || ""),
    url: "",
    length: "",
  };
}

function createRoomImagePayload(roomName, imageUrl) {
  return {
    handler: "room_message",
    id: Date.now().toString(),
    room: roomName,
    type: "image",
    body: "",
    url: String(imageUrl || ""),
    length: "",
  };
}

function getGenderText(gender) {
  const value = String(gender || "").trim();

  if (value === "1") {
    return "♂️ Male";
  }

  if (value === "2") {
    return "♀️ Female";
  }

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

  if (!value) {
    return "No status";
  }

  if (value.length > 100) {
    return "Long status message";
  }

  return value;
}

function formatProfileInfo(profile) {
  const username =
    profile?.type ||
    profile?.username ||
    profile?.name ||
    "N/A";

  return `━━━━━━━━━━━━━━━━
👤 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗜𝗻𝗳𝗼
━━━━━━━━━━━━━━━━
🆔 Username: ${username}
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

function loadUsers() {
  const users = usersStore.read();

  if (!Array.isArray(users)) {
    return [];
  }

  return users;
}

function isUserVipInLocalUsers(username) {
  const users = loadUsers();

  const target = users.find((user) => {
    return (
      String(user.username || "").trim().toLowerCase() ===
      String(username || "").trim().toLowerCase()
    );
  });

  return Boolean(target && target.vip === true);
}

function sendRoomImage(socket, roomName, imageUrl) {
  if (!socket || typeof socket.send !== "function") {
    return false;
  }

  return socket.send(createRoomImagePayload(roomName, imageUrl));
}

function sendRoomText(socket, roomName, text) {
  if (!socket || typeof socket.send !== "function") {
    return false;
  }

  return socket.send(createRoomTextPayload(roomName, text));
}

function notifyProfileTarget({ socket, targetUsername, searchedBy, roomName }) {
  const isVip = isUserVipInLocalUsers(targetUsername);

  if (isVip) {
    socket.sendPrivate(
      targetUsername,
      `📢 Your profile was searched by "${searchedBy}" inside room "${roomName}".`
    );
    return;
  }

  const ownerName = String(BOT_OWNER_USERNAME || "").trim();

  socket.sendPrivate(
    targetUsername,
    [
      "👁️ Someone searched for your profile.",
      ownerName
        ? `📩 To know who searched, contact: ${ownerName}`
        : "📩 To know who searched, contact the bot owner.",
    ].join("\n")
  );
}

async function handleProfileLookupCommand(context) {
  const { parsed, socket, bot, sender } = context;

  const targetUsername = getTargetUsername(parsed);

  if (!targetUsername) {
    socket.sendRoomMessage("❌ Please provide a valid username after p@");
    return;
  }

  const roomName = bot.roomName;

  try {
    /*
      نفس فكرة الكود القديم:
      fetchUserProfile({
        username: 'hb_bot',
        password: '12345678',
        targetId
      })

      الأفضل هنا أن تجعل بيانات الحساب في .env داخل profileApi.js
    */
    const profile = await fetchUserProfile({
      targetId: targetUsername,
    });

    if (!profile) {
      socket.sendRoomMessage("❌ Profile not found.");
      return;
    }

    console.log("✅ [PROFILE_LOOKUP_DATA]", {
      targetUsername,
      profile,
    });

    const profileImage =
      profile.photo_url ||
      profile.photoUrl ||
      "https://cdn.chatp.net/default_profile.png";

    /*
      إرسال صورة البروفايل في الغرفة
    */
    if (profileImage) {
      sendRoomImage(socket, roomName, profileImage);
    }

    /*
      إرسال بيانات البروفايل في الغرفة
    */
    sendRoomText(socket, roomName, formatProfileInfo(profile));

    /*
      إرسال تنبيه خاص للمستخدم المستهدف
    */
    notifyProfileTarget({
      socket,
      targetUsername,
      searchedBy: sender,
      roomName,
    });
  } catch (error) {
    console.log("❌ [PROFILE_LOOKUP_ERROR]", error.message);

    socket.sendRoomMessage("❌ Failed to fetch profile. Please try again.");
  }
}

module.exports = {
  handleProfileLookupCommand,
};
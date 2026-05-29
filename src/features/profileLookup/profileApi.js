const {
  PROFILE_BOT_USERNAME,
  PROFILE_BOT_PASSWORD,
} = require("../../config/env");

/*
  هذا الملف لا ينشئ منطق جديد.
  هو فقط يستدعي دالة fetchUserProfile الأصلية التي كانت تعمل في مشروعك القديم.

  مهم:
  يجب أن يكون عندك ملف:
  src/commands/profileCommand.js

  ويكون داخله:
  module.exports = {
    handleProfileCommand,
    fetchUserProfile,
  };
*/

const {
  fetchUserProfile: fetchUserProfileOriginal,
} = require("../../commands/profileCommand");

async function fetchUserProfile({ targetId }) {
  const username = String(PROFILE_BOT_USERNAME || "").trim();
  const password = String(PROFILE_BOT_PASSWORD || "").trim();

  if (!username || !password) {
    throw new Error(
      "Missing PROFILE_BOT_USERNAME or PROFILE_BOT_PASSWORD in .env"
    );
  }

  if (!targetId) {
    throw new Error("Missing targetId");
  }

  if (typeof fetchUserProfileOriginal !== "function") {
    throw new Error(
      "fetchUserProfileOriginal is not a function. Check ../../commands/profileCommand export."
    );
  }

  return fetchUserProfileOriginal({
    username,
    password,
    targetId,
  });
}

module.exports = {
  fetchUserProfile,
};
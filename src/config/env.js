require("dotenv").config();

module.exports = {
  WS_URL: process.env.WS_URL || "wss://chatp.net:5333/server",

  ADMIN_BOT_USERNAME: process.env.ADMIN_BOT_USERNAME || "tebot",
  ADMIN_BOT_PASSWORD: process.env.ADMIN_BOT_PASSWORD || "",

  BOT_OWNER_USERNAME: process.env.BOT_OWNER_USERNAME || "",

  BOT_SESSION: process.env.BOT_SESSION || "PQodgiKBfujFZfvJTnmM",
  BOT_SDK: process.env.BOT_SDK || "25",
  BOT_VERSION: process.env.BOT_VERSION || "332",

  RECONNECT_DELAY_MS: Number(process.env.RECONNECT_DELAY_MS || 5000),
  PING_INTERVAL_MS: Number(process.env.PING_INTERVAL_MS || 25000),
  MUSIC_BOT_USERNAME: process.env.MUSIC_BOT_USERNAME || "",
MUSIC_BOT_PASSWORD: process.env.MUSIC_BOT_PASSWORD || "",
};
// require("dotenv").config();

// const { BotRuntime } = require("./src/core/BotRuntime");

// const runtime = new BotRuntime();

// runtime.start();

// process.on("SIGINT", () => {
//   console.log("\n🛑 Stopping bot runtime...");
//   runtime.stop();
//   process.exit(0);
// });

// process.on("uncaughtException", (err) => {
//   console.error("❌ uncaughtException:", err);
// });

// process.on("unhandledRejection", (err) => {
//   console.error("❌ unhandledRejection:", err);
// });


require("dotenv").config();

const express = require("express");
const path = require("path");

const { BotRuntime } = require("./src/core/BotRuntime");
const {
  cleanupExpiredAudioFiles,
} = require("./src/features/music/audioDownload.service");

/* =====================================================
   Static Server For Audio Files
===================================================== */

const app = express();

const PORT = Number(process.env.PORT || 5000);

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public", "uploads"))
);

app.get("/", (req, res) => {
  res.send("Chat bot is running");
});

app.listen(PORT, () => {
  console.log(`🌐 Static server running on port ${PORT}`);
  console.log(
    `🎧 Audio URL base: ${
      process.env.APP_BASE_URL ||
      process.env.BASE_URL ||
      `http://localhost:${PORT}`
    }/uploads/audio-temp`
  );
});

/* =====================================================
   Cleanup Old Audio Files
===================================================== */

try {
  cleanupExpiredAudioFiles();
} catch (err) {
  console.error("❌ Audio cleanup failed:", err.message);
}

/*
  تنظيف كل 10 دقائق
*/
setInterval(() => {
  try {
    cleanupExpiredAudioFiles();
  } catch (err) {
    console.error("❌ Audio cleanup interval failed:", err.message);
  }
}, 10 * 60 * 1000);

/* =====================================================
   Bot Runtime
===================================================== */

const runtime = new BotRuntime();

runtime.start();

/* =====================================================
   Process Handlers
===================================================== */

process.on("SIGINT", () => {
  console.log("\n🛑 Stopping bot runtime...");
  runtime.stop();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("❌ uncaughtException:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ unhandledRejection:", err);
});
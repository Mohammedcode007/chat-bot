const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

/*
  مكان حفظ ملفات الصوت المؤقتة
  سيكون الرابط العام:
  /uploads/audio-temp/file.mp3
*/
const AUDIO_TEMP_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "audio-temp"
);

const AUDIO_TTL_MS = 60 * 60 * 1000; // 60 دقيقة

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildBaseUrl() {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;

  console.log("🌐 buildBaseUrl raw:", raw);

  return String(raw).replace(/\/+$/, "");
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

async function downloadAudioToLocal(params) {
  const sourceUrl = params && params.sourceUrl;

  if (!sourceUrl) {
    throw new Error("sourceUrl is required");
  }

  ensureDirExists(AUDIO_TEMP_DIR);

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputTemplate = path.join(AUDIO_TEMP_DIR, `${fileId}.%(ext)s`);

  /*
    مهم:
    ضع cookies.txt داخل جذر المشروع:
    /root/chat-bot/cookies.txt

    أو حدد مساره من .env:
    YT_DLP_COOKIES_PATH=/root/chat-bot/cookies.txt
  */
  const cookiesPath =
    process.env.YT_DLP_COOKIES_PATH ||
    process.env.YTDLP_COOKIES_PATH ||
    path.join(process.cwd(), "cookies.txt");

  if (!fileExists(cookiesPath)) {
    throw new Error(`cookies.txt not found at: ${cookiesPath}`);
  }

  const env = {
    ...process.env,
    PATH: `/root/.deno/bin:${process.env.PATH || ""}`,
  };

  const args = [
    "--cookies",
    cookiesPath,

    "--js-runtimes",
    "deno",

    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",

    "--no-playlist",
    "--restrict-filenames",

    "--socket-timeout",
    "30",
    "--retries",
    "3",
    "--fragment-retries",
    "3",

    "-o",
    outputTemplate,

    sourceUrl,
  ];

  console.log("🎧 yt-dlp sourceUrl:", sourceUrl);
  console.log("🎧 yt-dlp outputTemplate:", outputTemplate);
  console.log("🍪 yt-dlp cookiesPath:", cookiesPath);
  console.log("🧠 yt-dlp PATH:", env.PATH);
  console.log("🎛️ yt-dlp args:", args);

  try {
    const { stdout, stderr } = await execFileAsync("yt-dlp", args, {
      env,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
      timeout: Number(process.env.YT_DLP_TIMEOUT_MS || 180000),
    });

    if (stdout) console.log("🎧 yt-dlp stdout:", stdout);
    if (stderr) console.log("🎧 yt-dlp stderr:", stderr);
  } catch (error) {
    console.error(
      "❌ yt-dlp failed:",
      error && error.message ? error.message : error
    );

    console.error(
      "❌ yt-dlp stderr:",
      error && error.stderr ? error.stderr : ""
    );

    throw new Error(
      `yt-dlp failed: ${
        (error && error.stderr) ||
        (error && error.message) ||
        "unknown error"
      }`
    );
  }

  const files = fs.readdirSync(AUDIO_TEMP_DIR);

  const matched = files.find((file) => {
    return file.startsWith(fileId) && file.endsWith(".mp3");
  });

  if (!matched) {
    throw new Error("Downloaded mp3 file not found");
  }

  const absolutePath = path.join(AUDIO_TEMP_DIR, matched);
  const publicUrl = `${buildBaseUrl()}/uploads/audio-temp/${matched}`;

  console.log("🎧 FINAL filename:", matched);
  console.log("🎧 FINAL absolutePath:", absolutePath);
  console.log("🎧 FINAL publicUrl:", publicUrl);

  scheduleDeleteFile(absolutePath, AUDIO_TTL_MS);

  return {
    filename: matched,
    absolutePath,
    publicUrl,
    expiresInMs: AUDIO_TTL_MS,
  };
}

function scheduleDeleteFile(filePath, delayMs) {
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("❌ Failed to delete temp audio:", filePath, err.message);
        return;
      }

      console.log("🗑️ Temp audio deleted:", filePath);
    });
  }, delayMs);
}

function cleanupExpiredAudioFiles() {
  ensureDirExists(AUDIO_TEMP_DIR);

  const now = Date.now();
  const files = fs.readdirSync(AUDIO_TEMP_DIR);

  for (const file of files) {
    try {
      const filePath = path.join(AUDIO_TEMP_DIR, file);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs >= AUDIO_TTL_MS) {
        fs.unlinkSync(filePath);
        console.log("🧹 Removed expired audio:", file);
      }
    } catch (error) {
      console.error(
        "❌ Cleanup error for audio file:",
        file,
        error && error.message ? error.message : error
      );
    }
  }
}

module.exports = {
  AUDIO_TEMP_DIR,
  AUDIO_TTL_MS,
  downloadAudioToLocal,
  scheduleDeleteFile,
  cleanupExpiredAudioFiles,
};
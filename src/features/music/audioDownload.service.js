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

function buildYtDlpArgs({ sourceUrl, outputTemplate, cookiesPath }) {
  const args = [];

  /*
    مهم:
    لا نستخدم cookies إلا لو YT_DLP_USE_COOKIES=1
    لأن cookies.txt عندك سبب فشل التحميل.
  */
  const useCookies = process.env.YT_DLP_USE_COOKIES === "1";

  if (useCookies && fileExists(cookiesPath)) {
    args.push("--cookies", cookiesPath);
  } else {
    console.log("🍪 yt-dlp cookies disabled or not found:", {
      useCookies,
      cookiesPath,
    });
  }

  /*
    Deno ضروري عندك لأن yt-dlp نجح يدويًا مع:
    --js-runtimes deno
  */
  if (process.env.YT_DLP_USE_DENO === "1") {
    args.push("--js-runtimes", "deno");
  }

  /*
    إعدادات ثبات لتقليل التعليق وإعادة المحاولة.
  */
  args.push(
    "--socket-timeout",
    "20",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    "--no-playlist",
    "--restrict-filenames"
  );

  /*
    طالما ffmpeg أصبح مثبتًا عندك، سنحول إلى mp3.
    لو أردت لاحقًا تعطيل التحويل ضع AUDIO_FORCE_MP3=0.
  */
  if (process.env.AUDIO_FORCE_MP3 === "0") {
    args.push(
      "-f",
      "bestaudio[ext=m4a]/bestaudio"
    );
  } else {
    args.push(
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0"
    );
  }

  args.push(
    "-o",
    outputTemplate,
    sourceUrl
  );

  return args;
}

async function downloadAudioToLocal(params) {
  const sourceUrl = params && params.sourceUrl;

  if (!sourceUrl) {
    throw new Error("sourceUrl is required");
  }

  ensureDirExists(AUDIO_TEMP_DIR);

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputTemplate = path.join(AUDIO_TEMP_DIR, `${fileId}.%(ext)s`);

  const cookiesPath =
    process.env.YT_DLP_COOKIES_PATH ||
    process.env.YTDLP_COOKIES_PATH ||
    path.join(process.cwd(), "cookies.txt");

  const args = buildYtDlpArgs({
    sourceUrl,
    outputTemplate,
    cookiesPath,
  });

  const env = {
    ...process.env,
    PATH: `/root/.deno/bin:${process.env.PATH || ""}`,
  };

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

  const expectedMp3 = files.find((file) => {
    return file.startsWith(fileId) && file.endsWith(".mp3");
  });

  const anyMatchedAudio = files.find((file) => {
    return file.startsWith(fileId);
  });

  const matched = expectedMp3 || anyMatchedAudio;

  if (!matched) {
    throw new Error("Downloaded audio file not found");
  }

  const absolutePath = path.join(AUDIO_TEMP_DIR, matched);
  const publicUrl = `${buildBaseUrl()}/uploads/audio-temp/${matched}`;

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
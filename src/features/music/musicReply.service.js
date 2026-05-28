// const axios = require("axios");
// const { downloadAudioToLocal } = require("./audioDownload.service");

// function normalizeText(value) {
//   return String(value || "").trim();
// }

// function parsePlayCommand(raw) {
//   const text = normalizeText(raw);
//   const lower = text.toLowerCase();

//   if (lower.startsWith("play ")) {
//     return {
//       matched: true,
//       query: text.slice("play ".length).trim(),
//       lang: "en",
//     };
//   }

//   if (text.startsWith("تشغيل ")) {
//     return {
//       matched: true,
//       query: text.slice("تشغيل ".length).trim(),
//       lang: "ar",
//     };
//   }

//   return {
//     matched: false,
//     query: "",
//     lang: "ar",
//   };
// }

// async function searchYoutubeFirstResult(query) {
//   try {
//     const apiKey = normalizeText(process.env.YOUTUBE_DATA_API_KEY);

//     if (!apiKey) {
//       return {
//         ok: false,
//         error: "YOUTUBE_DATA_API_KEY is missing",
//       };
//     }

//     const q = normalizeText(query);

//     if (!q) {
//       return {
//         ok: false,
//         error: "Empty search query",
//       };
//     }

//     const response = await axios.get(
//       "https://www.googleapis.com/youtube/v3/search",
//       {
//         params: {
//           key: apiKey,
//           part: "snippet",
//           q,
//           type: "video",
//           maxResults: 1,
//           safeSearch: "moderate",
//           videoEmbeddable: true,
//         },
//         timeout: 15000,
//       }
//     );

//     const item = response.data && response.data.items && response.data.items[0];

//     if (!item || !item.id || !item.id.videoId) {
//       return {
//         ok: false,
//         error: "No YouTube results found",
//       };
//     }

//     const videoId = String(item.id.videoId);
//     const snippet = item.snippet || {};

//     return {
//       ok: true,
//       title: String(snippet.title || ""),
//       videoId,
//       youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
//       channelTitle: String(snippet.channelTitle || ""),
//       thumbnail:
//         (snippet.thumbnails &&
//           snippet.thumbnails.high &&
//           snippet.thumbnails.high.url) ||
//         (snippet.thumbnails &&
//           snippet.thumbnails.medium &&
//           snippet.thumbnails.medium.url) ||
//         (snippet.thumbnails &&
//           snippet.thumbnails.default &&
//           snippet.thumbnails.default.url) ||
//         "",
//     };
//   } catch (error) {
//     return {
//       ok: false,
//       error:
//         (error.response &&
//           error.response.data &&
//           error.response.data.error &&
//           error.response.data.error.message) ||
//         error.message ||
//         "YouTube search failed",
//     };
//   }
// }

// function makeSafeFileName(value) {
//   return String(value || "audio")
//     .replace(/[\\/:*?"<>|]/g, "")
//     .replace(/\s+/g, " ")
//     .trim()
//     .slice(0, 120);
// }

// async function buildMusicReply(rawText, extra = {}) {
//   const parsed = parsePlayCommand(rawText);

//   if (!parsed.matched) {
//     return {
//       handled: false,
//     };
//   }

//   if (!parsed.query) {
//     return {
//       handled: true,
//       success: false,
//       text:
//         parsed.lang === "ar"
//           ? "اكتب اسم الأغنية بعد الأمر"
//           : "Write the song name after the command",
//     };
//   }

//   const yt = await searchYoutubeFirstResult(parsed.query);

//   if (!yt.ok || !yt.youtubeUrl) {
//     return {
//       handled: true,
//       success: false,
//       text:
//         parsed.lang === "ar"
//           ? `تعذر العثور على الأغنية: ${yt.error || "حدث خطأ"}`
//           : `Failed to find song: ${yt.error || "Unknown error"}`,
//       meta: {
//         action: "music_search_failed",
//         query: parsed.query,
//         requestedBy: extra.requestedBy || "",
//         roomName: extra.roomName || "",
//       },
//     };
//   }

//   try {
//     const safeTitle = makeSafeFileName(yt.title || parsed.query || "audio");

//     const saved = await downloadAudioToLocal({
//       sourceUrl: yt.youtubeUrl,
//       filename: `${safeTitle}.mp3`,
//     });

//     return {
//       handled: true,
//       success: true,
//       text: [
//         "🎵 تم تجهيز الأغنية",
//         `الاسم: ${yt.title || parsed.query}`,
//         `بواسطة: ${extra.requestedBy || "unknown"}`,
//         `الغرفة: ${extra.roomName || "unknown"}`,
//         `الرابط: ${saved.publicUrl}`,
//       ].join("\n"),
//       meta: {
//         action: "music_mp3_ready",
//         query: parsed.query,
//         youtubeTitle: yt.title,
//         youtubeUrl: yt.youtubeUrl,
//         thumbnail: yt.thumbnail,
//         channelTitle: yt.channelTitle,
//         mp3Url: saved.publicUrl,
//         filename: saved.filename,
//         expiresInMs: saved.expiresInMs,
//         provider: "temporary_local_cache",
//         requestedBy: extra.requestedBy || "",
//         roomName: extra.roomName || "",
//       },
//     };
//   } catch (error) {
//     return {
//       handled: true,
//       success: false,
//       text:
//         parsed.lang === "ar"
//           ? `تم العثور على: ${yt.title}\nلكن فشل تجهيز ملف الصوت`
//           : `Found: ${yt.title}\nBut failed to prepare the audio file`,
//       meta: {
//         action: "music_prepare_failed",
//         query: parsed.query,
//         youtubeTitle: yt.title,
//         youtubeUrl: yt.youtubeUrl,
//         error: error && error.message ? error.message : "unknown_error",
//       },
//     };
//   }
// }

// module.exports = {
//   normalizeText,
//   parsePlayCommand,
//   searchYoutubeFirstResult,
//   buildMusicReply,
// };


const { downloadAudioToLocal } = require("./audioDownload.service");

function normalizeText(value) {
  return String(value || "").trim();
}

function parsePlayCommand(raw) {
  const text = normalizeText(raw);
  const lower = text.toLowerCase();

  if (lower.startsWith("play ")) {
    return {
      matched: true,
      query: text.slice("play ".length).trim(),
      lang: "en",
    };
  }

  if (text.startsWith("تشغيل ")) {
    return {
      matched: true,
      query: text.slice("تشغيل ".length).trim(),
      lang: "ar",
    };
  }

  return {
    matched: false,
    query: "",
    lang: "ar",
  };
}

function makeSafeFileName(value) {
  return String(value || "audio")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function buildMusicReply(rawText, extra = {}) {
  const parsed = parsePlayCommand(rawText);

  if (!parsed.matched) {
    return {
      handled: false,
    };
  }

  if (!parsed.query) {
    return {
      handled: true,
      success: false,
      text:
        parsed.lang === "ar"
          ? "اكتب اسم الأغنية بعد الأمر"
          : "Write the song name after the command",
    };
  }

  try {
    /*
      الاستغناء عن YouTube Data API.
      yt-dlp سيبحث في يوتيوب عن أول نتيجة بنفسه.
    */
    const ytSearchQuery = `ytsearch1:${parsed.query}`;
    const safeTitle = makeSafeFileName(parsed.query || "audio");

    const saved = await downloadAudioToLocal({
      sourceUrl: ytSearchQuery,
      filename: `${safeTitle}.mp3`,
    });

    return {
      handled: true,
      success: true,
      text: [
        "🎵 تم تجهيز الأغنية",
        `الاسم: ${parsed.query}`,
        `بواسطة: ${extra.requestedBy || "unknown"}`,
        `الغرفة: ${extra.roomName || "unknown"}`,
        `الرابط: ${saved.publicUrl}`,
      ].join("\n"),
      meta: {
        action: "music_mp3_ready",
        query: parsed.query,

        /*
          هنا نخزن اسم البحث نفسه كعنوان.
          لأننا لم نعد نستخدم YouTube API لجلب title.
        */
        youtubeTitle: parsed.query,
        youtubeUrl: ytSearchQuery,

        mp3Url: saved.publicUrl,
        filename: saved.filename,
        durationMs: saved.durationMs || 0,
        expiresInMs: saved.expiresInMs,
        provider: "yt_dlp_search",

        requestedBy: extra.requestedBy || "",
        roomName: extra.roomName || "",
      },
    };
  } catch (error) {
    return {
      handled: true,
      success: false,
      text:
        parsed.lang === "ar"
          ? `فشل تجهيز الأغنية: ${
              error && error.message ? error.message : "حدث خطأ"
            }`
          : `Failed to prepare song: ${
              error && error.message ? error.message : "Unknown error"
            }`,
      meta: {
        action: "music_prepare_failed",
        query: parsed.query,
        error: error && error.message ? error.message : "unknown_error",
      },
    };
  }
}

module.exports = {
  normalizeText,
  parsePlayCommand,
  buildMusicReply,
};
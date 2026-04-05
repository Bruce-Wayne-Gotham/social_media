const { fetchJson } = require("./http");

function guessContentType(url) {
  if (/\.(mp4|m4v)(\?.*)?$/i.test(url)) {
    return "video/mp4";
  }
  if (/\.mov(\?.*)?$/i.test(url)) {
    return "video/quicktime";
  }
  if (/\.webm(\?.*)?$/i.test(url)) {
    return "video/webm";
  }
  return "application/octet-stream";
}

// TODO: Implement Telegram publishing via Telegram Bot API
// Relevant API calls:
//   POST https://api.telegram.org/bot<token>/sendMessage  (text posts)
//   POST https://api.telegram.org/bot<token>/sendPhoto    (image posts)
//   POST https://api.telegram.org/bot<token>/sendVideo    (video posts)
// payload fields: text, mediaUrl
async function publishTelegramPost({ accessToken, payload }) {
  // TODO: POST to Telegram Bot API with chat_id (from account) and text
  return { externalPostId: `stub_telegram_${Date.now()}` };
}

// TODO: Implement Reddit publishing via Reddit OAuth REST API
// Relevant API calls:
//   POST https://oauth.reddit.com/api/submit
//   Fields: sr (subreddit), kind ('self' or 'link'), title, text/url
// payload fields: title, text, subreddit, mediaUrl
async function publishRedditPost({ accessToken, payload }) {
  // TODO: POST to https://oauth.reddit.com/api/submit with sr=payload.subreddit
  return { externalPostId: `stub_reddit_${Date.now()}` };
}

// TODO: Implement Pinterest publishing via Pinterest API v5
// Relevant API calls:
//   POST https://api.pinterest.com/v5/pins
//   Fields: board_id, title, description, media_source (image_url / video_id)
// payload fields: title, description, boardId, mediaUrl
async function publishPinterestPost({ accessToken, payload }) {
  // TODO: POST to https://api.pinterest.com/v5/pins with board_id=payload.boardId
  return { externalPostId: `stub_pinterest_${Date.now()}` };
}

async function publishYoutubeMetadata({ accessToken, payload }) {
  if (!payload.mediaUrl) {
    throw new Error("YouTube publishing requires a public video URL");
  }

  const mediaResponse = await fetch(payload.mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error("Unable to download media for YouTube upload");
  }

  const contentType = mediaResponse.headers.get("content-type") || guessContentType(payload.mediaUrl);
  if (!contentType.startsWith("video/")) {
    throw new Error("YouTube uploads require video media");
  }

  const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
  const metadata = {
    snippet: {
      title: payload.title,
      description: payload.description,
      tags: payload.tags || []
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || "unlisted"
    }
  };
  const boundary = `socialhub-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    mediaBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const result = await fetchJson("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  return {
    externalPostId: result.id || `youtube_${Date.now()}`
  };
}

module.exports = {
  publishTelegramPost,
  publishRedditPost,
  publishPinterestPost,
  publishYoutubeMetadata
};

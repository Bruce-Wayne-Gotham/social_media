function normalizeHashtags(hashtags = []) {
  return hashtags
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function adaptPost(post, platform) {
  const hashtags = normalizeHashtags(post.hashtags);
  const hashtagSuffix = hashtags.length ? `\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}` : "";

  if (platform === "telegram") {
    // Telegram: no title, markdown-friendly text, max 4096 chars
    return {
      text: `${post.content}${hashtagSuffix}`.trim().slice(0, 4096),
      mediaUrl: post.media_url || null
    };
  }

  if (platform === "reddit") {
    // Reddit: title required (max 300), no hashtags, subreddit from providerMeta
    return {
      title: (post.adapted_title || post.content).slice(0, 300),
      text: post.content || null,
      subreddit: post.provider_meta?.subreddit || null,
      mediaUrl: post.media_url || null
    };
  }

  if (platform === "youtube") {
    // YouTube: title required (max 100), description max 5000, 3-5 hashtags
    return {
      title: (post.adapted_title || post.content).slice(0, 100),
      description: `${post.content}${hashtagSuffix}`.trim().slice(0, 5000),
      tags: hashtags,
      mediaUrl: post.media_url || null
    };
  }

  if (platform === "pinterest") {
    // Pinterest: title required (max 100), description max 500, boardId from providerMeta
    return {
      title: (post.adapted_title || post.content).slice(0, 100),
      description: `${post.content}${hashtagSuffix}`.trim().slice(0, 500),
      boardId: post.provider_meta?.boardId || null,
      mediaUrl: post.media_url || null
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

module.exports = {
  adaptPost
};

function normalizeHashtags(hashtags = []) {
  return hashtags
    .filter(Boolean)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function adaptPost(post, platform) {
  const hashtags = normalizeHashtags(post.hashtags);
  const hashtagSuffix = hashtags.length ? `\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}` : "";

  if (platform === "linkedin") {
    return {
      text: `${post.content}${hashtagSuffix}`.trim(),
      mediaUrl: post.media_url || null
    };
  }

  if (platform === "instagram") {
    return {
      caption: `${post.content}${hashtagSuffix}`.trim(),
      mediaUrl: post.media_url || null,
      hashtags
    };
  }

  if (platform === "youtube") {
    return {
      title: post.content.slice(0, 100),
      description: `${post.content}${hashtagSuffix}`.trim(),
      tags: hashtags,
      mediaUrl: post.media_url || null
    };
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

module.exports = {
  adaptPost
};

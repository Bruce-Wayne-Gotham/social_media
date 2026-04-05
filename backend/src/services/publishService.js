const { query } = require("../config/db");
const { decrypt } = require("../utils/crypto");
const { adaptPost } = require("./platformAdapters");
const { publishTelegramPost } = require("./linkedinPublisher");
const { publishRedditPost } = require("./instagramPublisher");
const { publishPinterestPost } = require("./pinterestPublisher");
const { publishYoutubeMetadata } = require("./youtubePublisher");

async function publishPost(postId) {
  const postResult = await query(
    `SELECT id, user_id, content, media_url, hashtags, scheduled_time
     FROM posts
     WHERE id = $1`,
    [postId]
  );
  const post = postResult.rows[0];

  if (!post) {
    throw new Error("Post not found");
  }

  await query("UPDATE posts SET status = 'publishing', updated_at = NOW() WHERE id = $1", [postId]);

  const targetsResult = await query(
    `SELECT pt.id, pt.platform, sa.access_token
     FROM post_targets pt
     LEFT JOIN social_profiles sa
       ON sa.user_id = $1 AND sa.platform = pt.platform
     WHERE pt.post_id = $2`,
    [post.user_id, postId]
  );

  for (const target of targetsResult.rows) {
    try {
      const payload = adaptPost(post, target.platform);
      const accessToken = target.access_token ? decrypt(target.access_token) : "";
      const result = await dispatchPublisher(target.platform, { accessToken, payload });

      await query(
        `UPDATE post_targets
         SET publish_status = 'published', external_post_id = $2, error_message = NULL, updated_at = NOW()
         WHERE id = $1`,
        [target.id, result.externalPostId]
      );
    } catch (error) {
      await query(
        `UPDATE post_targets
         SET publish_status = 'failed', error_message = $2, updated_at = NOW()
         WHERE id = $1`,
        [target.id, error.message]
      );
    }
  }

  const failuresResult = await query(
    "SELECT COUNT(*)::int AS failures FROM post_targets WHERE post_id = $1 AND publish_status = 'failed'",
    [postId]
  );
  const status = failuresResult.rows[0].failures > 0 ? "failed" : "published";

  await query("UPDATE posts SET status = $2, updated_at = NOW() WHERE id = $1", [postId, status]);
  return { id: postId, status };
}

async function dispatchPublisher(platform, context) {
  if (platform === "telegram") {
    return publishTelegramPost(context);
  }
  if (platform === "reddit") {
    return publishRedditPost(context);
  }
  if (platform === "youtube") {
    return publishYoutubeMetadata(context);
  }
  if (platform === "pinterest") {
    return publishPinterestPost(context);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

module.exports = {
  publishPost
};

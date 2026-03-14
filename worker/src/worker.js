require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { Pool } = require("pg");
const { adaptPost } = require("./platformAdapters");
const { resolveAccessToken } = require("./auth");
const {
  publishTwitterPost,
  publishLinkedInPost,
  publishInstagramPost,
  publishYoutubeMetadata
} = require("./publishers");

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function publishPost(postId) {
  const client = await pool.connect();

  try {
    const postResult = await client.query(
      `SELECT id, user_id, content, media_url, hashtags
       FROM posts
       WHERE id = $1`,
      [postId]
    );

    if (postResult.rowCount === 0) {
      throw new Error("Post does not exist");
    }

    const post = postResult.rows[0];

    await client.query("UPDATE posts SET status = 'publishing', updated_at = NOW() WHERE id = $1", [postId]);

    const targetsResult = await client.query(
      `SELECT pt.id,
              pt.platform,
              sa.id AS social_account_id,
              sa.access_token,
              sa.refresh_token,
              sa.expiry
       FROM post_targets pt
       LEFT JOIN social_accounts sa
         ON sa.user_id = $1 AND sa.platform = pt.platform
       WHERE pt.post_id = $2`,
      [post.user_id, postId]
    );

    for (const target of targetsResult.rows) {
      try {
        const payload = adaptPost(post, target.platform);
        const accessToken = await resolveAccessToken(client, target);
        const result = await dispatchPublisher(target.platform, { accessToken, payload });

        await client.query(
          `UPDATE post_targets
           SET publish_status = 'published', external_post_id = $2, error_message = NULL, updated_at = NOW()
           WHERE id = $1`,
          [target.id, result.externalPostId]
        );
      } catch (error) {
        await client.query(
          `UPDATE post_targets
           SET publish_status = 'failed', error_message = $2, updated_at = NOW()
           WHERE id = $1`,
          [target.id, error.message]
        );
      }
    }

    const failuresResult = await client.query(
      "SELECT COUNT(*)::int AS failures FROM post_targets WHERE post_id = $1 AND publish_status = 'failed'",
      [postId]
    );
    const status = failuresResult.rows[0].failures > 0 ? "failed" : "published";
    await client.query("UPDATE posts SET status = $2, updated_at = NOW() WHERE id = $1", [postId, status]);
  } finally {
    client.release();
  }
}

async function dispatchPublisher(platform, context) {
  if (platform === "twitter") {
    return publishTwitterPost(context);
  }
  if (platform === "linkedin") {
    return publishLinkedInPost(context);
  }
  if (platform === "instagram") {
    return publishInstagramPost(context);
  }
  if (platform === "youtube") {
    return publishYoutubeMetadata(context);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

const worker = new Worker(
  "post-publish",
  async (job) => {
    await publishPost(job.data.postId);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Published post ${job.data.postId}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed to publish post ${job?.data?.postId}`, error);
});

console.log("SocialHub worker listening for scheduled jobs");

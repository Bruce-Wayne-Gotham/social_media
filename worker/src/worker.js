require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { Pool } = require("pg");
const { adaptPost } = require("./platformAdapters");
const { resolveAccessToken } = require("./auth");
const {
  publishTelegramPost,
  publishRedditPost,
  publishPinterestPost,
  publishYoutubeMetadata
} = require("./publishers");

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt) {
  // attempt: 1..N
  const base = Number(process.env.PUBLISH_RETRY_BASE_MS || 1000);
  // Exponential backoff: 1s, 2s, 4s (default)
  return base * Math.pow(2, Math.max(0, attempt - 1));
}

async function publishWithRetries({ platform, publishFn, maxAttempts = 3 }) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await publishFn();
    } catch (error) {
      lastError = error;
      const isLast = attempt === maxAttempts;
      if (isLast) break;

      const delay = backoffDelayMs(attempt);
      console.warn(`Publish attempt ${attempt}/${maxAttempts} failed for ${platform}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

async function publishPost(postId) {
  const client = await pool.connect();

  try {
    const postResult = await client.query(
      `SELECT id, user_id, client_id, content, media_url, hashtags, status
       FROM posts
       WHERE id = $1`,
      [postId]
    );

    if (postResult.rowCount === 0) {
      throw new Error("Post does not exist");
    }

    const post = postResult.rows[0];

    if (post.status !== "approved" && post.status !== "scheduled") {
      throw new Error("Post is not approved for publishing");
    }

    if (post.status === "published") {
      // Best-effort idempotency: if a post is already marked published, do not re-publish.
      return;
    }

    await client.query("UPDATE posts SET status = 'publishing', updated_at = NOW() WHERE id = $1", [postId]);

    const targetsResult = await client.query(
      `SELECT pt.id,
              pt.platform,
              sa.id AS social_profile_id,
              sa.access_token,
              sa.refresh_token,
              sa.expiry,
              pt.publish_status,
              pt.external_post_id
       FROM post_targets pt
       LEFT JOIN LATERAL (
         SELECT id, access_token, refresh_token, expiry
         FROM social_profiles
         WHERE client_id = $1
           AND (
             (pt.social_profile_id IS NOT NULL AND id = pt.social_profile_id)
             OR (pt.social_profile_id IS NULL AND platform = pt.platform)
           )
         ORDER BY updated_at DESC
         LIMIT 1
       ) sa ON true
       WHERE pt.post_id = $2`,
      [post.client_id, postId]
    );

    for (const target of targetsResult.rows) {
      if (target.publish_status === "published") {
        // Already completed from a prior run (best-effort idempotency).
        continue;
      }

      try {
        const payload = adaptPost(post, target.platform);
        const accessToken = await resolveAccessToken(client, target);
        const result = await publishWithRetries({
          platform: target.platform,
          maxAttempts: Number(process.env.PUBLISH_RETRY_ATTEMPTS || 3),
          publishFn: async () => dispatchPublisher(target.platform, { accessToken, payload })
        });

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

const { pool, query } = require("../config/db");
const { postQueue } = require("../config/queue");
const { normalizePlatform } = require("../utils/platforms");

async function createPost(userId, payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const postResult = await client.query(
      `INSERT INTO posts (user_id, content, media_url, hashtags, scheduled_time, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userId,
        payload.content,
        payload.mediaUrl || null,
        payload.hashtags || [],
        payload.scheduledTime || null,
        payload.scheduledTime ? "queued" : "publishing"
      ]
    );

    const post = postResult.rows[0];

    for (const platform of payload.platforms) {
      await client.query(
        `INSERT INTO post_targets (post_id, platform, publish_status)
         VALUES ($1, $2, $3)`,
        [post.id, normalizePlatform(platform), payload.scheduledTime ? "queued" : "pending"]
      );
    }

    await client.query("COMMIT");

    const delay = payload.scheduledTime
      ? Math.max(new Date(payload.scheduledTime).getTime() - Date.now(), 0)
      : 0;

    await postQueue.add(
      "publish-post",
      { postId: post.id },
      {
        delay,
        removeOnComplete: 50,
        removeOnFail: 100
      }
    );

    return getPostById(userId, post.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPostsByUser(userId) {
  const result = await query(
    `SELECT
       p.id,
       p.content,
       p.media_url,
       p.hashtags,
       p.scheduled_time,
       p.status,
       p.created_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'platform', pt.platform,
             'publishStatus', pt.publish_status,
             'externalPostId', pt.external_post_id,
             'errorMessage', pt.error_message
           )
         ) FILTER (WHERE pt.id IS NOT NULL),
         '[]'
       ) AS targets
     FROM posts p
     LEFT JOIN post_targets pt ON pt.post_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function getPostById(userId, postId) {
  const result = await query(
    `SELECT
       p.id,
       p.content,
       p.media_url,
       p.hashtags,
       p.scheduled_time,
       p.status,
       p.created_at,
       COALESCE(
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'platform', pt.platform,
             'publishStatus', pt.publish_status,
             'externalPostId', pt.external_post_id,
             'errorMessage', pt.error_message
           )
         ) FILTER (WHERE pt.id IS NOT NULL),
         '[]'
       ) AS targets
     FROM posts p
     LEFT JOIN post_targets pt ON pt.post_id = p.id
     WHERE p.user_id = $1 AND p.id = $2
     GROUP BY p.id`,
    [userId, postId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createPost,
  getPostsByUser,
  getPostById
};

const crypto = require("crypto");
const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { assertClientAccess } = require("./accessService");
const postService = require("./postService");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildFrontendBaseUrl() {
  return process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:3000";
}

async function createApprovalMagicLink(userId, clientId, { label, expiresInDays }) {
  const access = await assertClientAccess(userId, clientId);
  const rawToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO approval_magic_links (client_id, created_by, label, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [clientId, userId, label || access.client_name, tokenHash, expiresAt.toISOString()]
  );

  return {
    clientId,
    clientName: access.client_name,
    label: label || access.client_name,
    expiresAt: expiresAt.toISOString(),
    url: `${buildFrontendBaseUrl()}/approve/${rawToken}`
  };
}

async function resolveApprovalMagicLink(token) {
  const result = await query(
    `SELECT l.id, l.client_id, l.label, l.expires_at, c.name AS client_name
     FROM approval_magic_links l
     JOIN clients c ON c.id = l.client_id
     WHERE l.token_hash = $1
       AND l.revoked_at IS NULL
       AND l.expires_at > NOW()`,
    [hashToken(token)]
  );

  const link = result.rows[0];
  if (!link) {
    throw httpError("Approval link is invalid or expired", 404);
  }

  return link;
}

async function getApprovalMagicLinkOverview(token) {
  const link = await resolveApprovalMagicLink(token);
  const posts = await postService.getPendingApprovalPostsByClient(link.client_id);
  return {
    link: {
      label: link.label,
      clientId: link.client_id,
      clientName: link.client_name,
      expiresAt: link.expires_at
    },
    posts
  };
}

async function getApprovalMagicLinkPost(token, postId) {
  const link = await resolveApprovalMagicLink(token);
  const post = await postService.getPostByIdForClient(link.client_id, postId);
  if (!post) {
    throw httpError("Post not found", 404);
  }

  return {
    link: {
      label: link.label,
      clientId: link.client_id,
      clientName: link.client_name,
      expiresAt: link.expires_at
    },
    post
  };
}

async function commentWithApprovalMagicLink(token, postId, note) {
  const link = await resolveApprovalMagicLink(token);
  const post = await postService.addApprovalCommentForClient(
    link.client_id,
    postId,
    note,
    link.label || `${link.client_name} approval link`
  );
  return { post };
}

async function approveWithApprovalMagicLink(token, postId, note) {
  const link = await resolveApprovalMagicLink(token);
  const post = await postService.approvePostForClient(
    link.client_id,
    postId,
    note,
    link.label || `${link.client_name} approval link`
  );
  return { post };
}

async function rejectWithApprovalMagicLink(token, postId, note) {
  const link = await resolveApprovalMagicLink(token);
  const post = await postService.rejectPostForClient(
    link.client_id,
    postId,
    note,
    link.label || `${link.client_name} approval link`
  );
  return { post };
}

module.exports = {
  approveWithApprovalMagicLink,
  commentWithApprovalMagicLink,
  createApprovalMagicLink,
  getApprovalMagicLinkOverview,
  getApprovalMagicLinkPost,
  rejectWithApprovalMagicLink,
  resolveApprovalMagicLink
};

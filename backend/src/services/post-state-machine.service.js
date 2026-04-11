"use strict";

// State machine for post status transitions.
// CRITICAL: this is the ONLY place that may write `UPDATE posts SET status = ...`.
// Controllers must never bypass this function.

const { pool } = require("../config/db");
const { updatePostStatus }  = require("../db/queries/posts.queries");
const { insertApprovalLog } = require("../db/queries/approval-logs.queries");
const { Errors }            = require("../utils/ApiError");

// ─── transition table ────────────────────────────────────────────────────────
// Worker-only transitions (approved→scheduled, approved→publishing,
// scheduled→publishing, publishing→published, publishing→failed) are listed
// so the machine can report a meaningful error when a controller tries to
// trigger them manually.

const TRANSITIONS = {
  draft:          { submit:  "needs_approval" },
  needs_approval: { approve: "approved", reject: "draft", recall: "draft" },
  // Worker-owned — included for completeness, not reachable via API actions:
  approved:       { _worker_schedule: "scheduled", _worker_publish: "publishing" },
  scheduled:      { _worker_publish:  "publishing" },
  publishing:     { _worker_complete: "published", _worker_fail: "failed" },
};

// Actions that are log-worthy (all human-triggered ones):
const LOG_ACTIONS = new Set(["submit", "approve", "reject", "recall"]);

// Map action → approval_logs.action value (contract enum):
const LOG_ACTION_MAP = {
  submit:  "submitted",
  approve: "approved",
  reject:  "rejected",
  recall:  "recalled",
};

// ─── transition ──────────────────────────────────────────────────────────────
/**
 * Transitions postId to the next status for the given action.
 *
 * @param {string}      postId
 * @param {string}      action      — "submit" | "approve" | "reject" | "recall"
 * @param {string}      actorId     — user UUID
 * @param {string}      actorName   — display name (email used as fallback)
 * @param {string|null} comment
 * @param {object|null} dbClient    — optional pg PoolClient for caller-managed transactions.
 *                                    When null, this function manages its own transaction.
 *
 * @returns {{ postId, previousStatus, newStatus }}
 * @throws  {ApiError}  INVALID_TRANSITION (409) | POST_NOT_FOUND (404)
 */
async function transition(postId, action, actorId, actorName, comment = null, dbClient = null) {
  const ownTx = dbClient == null;
  const db    = dbClient ?? (await pool.connect());

  try {
    if (ownTx) await db.query("BEGIN");

    // Lock the post row so concurrent requests can't race through the machine.
    const lockResult = await db.query(
      `SELECT id, status FROM posts WHERE id = $1 FOR UPDATE`,
      [postId]
    );
    if (lockResult.rowCount === 0) {
      throw Errors.postNotFound();
    }

    const currentStatus = lockResult.rows[0].status;
    const allowed       = TRANSITIONS[currentStatus] ?? {};
    const nextStatus    = allowed[action];

    if (!nextStatus) {
      throw Errors.invalidTransition(currentStatus, action);
    }

    // Write the new status.
    await updatePostStatus(db, postId, nextStatus);

    // Write the approval log entry for human actions.
    if (LOG_ACTIONS.has(action)) {
      await insertApprovalLog(db, {
        postId,
        action:    LOG_ACTION_MAP[action],
        actorId,
        actorName: actorName ?? actorId,
        comment,
      });
    }

    if (ownTx) await db.query("COMMIT");
    return { postId, previousStatus: currentStatus, newStatus: nextStatus };
  } catch (err) {
    if (ownTx) await db.query("ROLLBACK");
    throw err;
  } finally {
    if (ownTx && db.release) db.release();
  }
}

module.exports = { transition };

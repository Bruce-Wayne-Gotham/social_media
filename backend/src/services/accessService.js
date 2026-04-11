const { query } = require("../config/db");
const { Errors } = require("../utils/ApiError");

async function getWorkspaceMemberRecord(userId, workspaceId) {
  const result = await query(
    `SELECT workspace_id, user_id, role
     FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );

  return result.rows[0] || null;
}

async function getClientAccessRecord(userId, clientId) {
  const result = await query(
    `SELECT
       c.id AS client_id,
       c.workspace_id,
       c.name AS client_name,
       wm.role,
       EXISTS (
         SELECT 1
         FROM client_approver_assignments ca
         WHERE ca.user_id = wm.user_id AND ca.client_id = c.id
       ) AS is_assigned
     FROM clients c
     JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
     WHERE c.id = $1 AND wm.user_id = $2`,
    [clientId, userId]
  );

  return result.rows[0] || null;
}

async function assertClientAccess(userId, clientId) {
  // Step 1: does the client exist at all? → 404 if not
  const { rows: clientRows } = await query(`SELECT id FROM clients WHERE id = $1`, [clientId]);
  if (!clientRows[0]) throw Errors.clientNotFound();

  // Step 2: is the user a member of the owning workspace? → 403 if not
  const access = await getClientAccessRecord(userId, clientId);
  if (!access) throw Errors.forbidden();

  // Step 3: client_approver must be explicitly assigned to this client
  if (access.role === "client_approver" && !access.is_assigned) {
    throw Errors.forbidden();
  }

  return access;
}

module.exports = {
  assertClientAccess,
  getClientAccessRecord,
  getWorkspaceMemberRecord
};

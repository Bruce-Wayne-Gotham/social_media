const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");

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
  const access = await getClientAccessRecord(userId, clientId);
  if (!access) {
    throw httpError("Client not found", 404);
  }

  if (access.role === "client_approver" && !access.is_assigned) {
    throw httpError("Client not found", 404);
  }

  return access;
}

module.exports = {
  assertClientAccess,
  getClientAccessRecord,
  getWorkspaceMemberRecord
};

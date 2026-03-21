const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { pool, query } = require("../config/db");
const { httpError } = require("../utils/httpError");
const { ensureWorkspaceBillingRecord } = require("./billingService");

async function register({ email, password }) {
  const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rowCount > 0) {
    throw httpError("Email already in use", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash]
    );
    const user = userResult.rows[0];

    const workspaceResult = await client.query(
      `INSERT INTO workspaces (name, created_by)
       VALUES ($1, $2)
       RETURNING id`,
      ["My Workspace", user.id]
    );
    const workspaceId = workspaceResult.rows[0].id;

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [workspaceId, user.id, "owner"]
    );

    const clientResult = await client.query(
      `INSERT INTO clients (workspace_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [workspaceId, "Default Client"]
    );
    const defaultClientId = clientResult.rows[0].id;

    await client.query(
      `UPDATE users
       SET default_workspace_id = $2, default_client_id = $3
       WHERE id = $1`,
      [user.id, workspaceId, defaultClientId]
    );

    await client.query("COMMIT");
    await ensureWorkspaceBillingRecord(workspaceId);
    return issueToken(user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  const result = await query(
    "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];

  if (!user) {
    throw httpError("Invalid email or password", 401);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    throw httpError("Invalid email or password", 401);
  }

  return issueToken(user);
}

async function getUserById(userId) {
  const result = await query(
    "SELECT id, email, default_workspace_id, default_client_id, created_at FROM users WHERE id = $1",
    [userId]
  );
  const user = result.rows[0];
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    defaultWorkspaceId: user.default_workspace_id,
    defaultClientId: user.default_client_id,
    createdAt: user.created_at
  };
}

function issueToken(user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET || "change-me",
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at
    }
  };
}

module.exports = {
  register,
  login,
  getUserById
};


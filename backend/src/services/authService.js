const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { query } = require("../config/db");
const { httpError } = require("../utils/httpError");

async function register({ email, password }) {
  const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existingUser.rowCount > 0) {
    throw httpError("Email already in use", 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash]
  );

  return issueToken(result.rows[0]);
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
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] || null;
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


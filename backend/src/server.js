require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");

const port = process.env.PORT || 4000;
const host = process.env.HOST || "0.0.0.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 30);
  const baseDelayMs = Number(process.env.DB_CONNECT_DELAY_MS || 500);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await testConnection();
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      const delay = Math.min(baseDelayMs * attempt, 5000);
      console.warn(
        `Database connection failed (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`
      );
      if (isLastAttempt) {
        throw error;
      }
      await sleep(delay);
    }
  }
}

async function start() {
  await waitForDatabase();
  app.listen(port, host, () => {
    console.log(`Backend listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});


require("dotenv").config();

const app = require("./app");
const { testConnection } = require("./config/db");

const port = process.env.PORT || 4000;

async function start() {
  await testConnection();
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});


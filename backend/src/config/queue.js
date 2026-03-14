const { Queue } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const postQueue = new Queue("post-publish", { connection });

module.exports = {
  connection,
  postQueue
};


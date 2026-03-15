const { z } = require("zod");

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120)
});

module.exports = {
  createWorkspaceSchema
};


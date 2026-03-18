const { z } = require("zod");

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120)
});

const switchWorkspaceSchema = z.object({
  workspaceId: z.string().uuid()
});

module.exports = {
  createWorkspaceSchema,
  switchWorkspaceSchema
};

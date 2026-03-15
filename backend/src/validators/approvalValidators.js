const { z } = require("zod");

const requestApprovalSchema = z.object({
  note: z.string().max(2000).optional()
});

const approvePostSchema = z.object({
  note: z.string().max(2000).optional()
});

const rejectPostSchema = z.object({
  note: z.string().max(2000).optional()
});

module.exports = {
  requestApprovalSchema,
  approvePostSchema,
  rejectPostSchema
};


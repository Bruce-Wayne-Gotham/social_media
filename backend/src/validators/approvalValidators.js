const { z } = require("zod");

const optionalNote = z.string().trim().min(1).max(2000).optional();
const requiredNote = z.string().trim().min(1).max(2000);

const requestApprovalSchema = z.object({
  note: optionalNote
});

const approvePostSchema = z.object({
  note: optionalNote
});

const rejectPostSchema = z.object({
  note: optionalNote
});

const commentOnPostSchema = z.object({
  note: requiredNote
});

const createApprovalMagicLinkSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7)
});

module.exports = {
  approvePostSchema,
  commentOnPostSchema,
  createApprovalMagicLinkSchema,
  rejectPostSchema,
  requestApprovalSchema
};

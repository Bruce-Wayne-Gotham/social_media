const { z } = require("zod");

const createUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().min(1)
});

module.exports = {
  createUploadUrlSchema
};

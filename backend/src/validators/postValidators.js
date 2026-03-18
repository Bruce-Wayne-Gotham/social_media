const { z } = require("zod");
const { normalizePlatform, SUPPORTED_PLATFORMS } = require("../utils/platforms");

const platformSchema = z.preprocess(
  normalizePlatform,
  z.enum(SUPPORTED_PLATFORMS)
);

const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaAssetId: z.string().uuid().optional().nullable(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  hashtags: z.array(z.string().min(1)).default([]),
  scheduledTime: z.string().datetime().optional().nullable(),
  platforms: z.array(platformSchema).min(1)
});

const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  mediaAssetId: z.string().uuid().optional().nullable(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  hashtags: z.array(z.string().min(1)).optional(),
  scheduledTime: z.string().datetime().optional().nullable(),
  platforms: z.array(platformSchema).min(1).optional()
});

module.exports = {
  createPostSchema,
  updatePostSchema
};

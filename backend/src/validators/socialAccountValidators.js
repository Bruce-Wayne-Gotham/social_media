const { z } = require("zod");
const { normalizePlatform, SUPPORTED_PLATFORMS } = require("../utils/platforms");

const connectAccountSchema = z.object({
  platform: z.preprocess(normalizePlatform, z.enum(SUPPORTED_PLATFORMS)),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  accountName: z.string().optional(),
  expiry: z.string().datetime().optional()
});

module.exports = {
  connectAccountSchema
};

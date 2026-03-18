const { z } = require("zod");

const createTrackedLinkSchema = z.object({
  originalUrl: z.string().url(),
  postId: z.string().uuid().optional().nullable(),
  utmSource: z.string().trim().max(120).optional().nullable(),
  utmMedium: z.string().trim().max(120).optional().nullable(),
  utmCampaign: z.string().trim().max(120).optional().nullable(),
  utmContent: z.string().trim().max(120).optional().nullable(),
  utmTerm: z.string().trim().max(120).optional().nullable()
});

module.exports = {
  createTrackedLinkSchema
};

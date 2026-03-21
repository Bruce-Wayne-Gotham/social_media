const { z } = require("zod");

function normalizeList(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter(Boolean);
}

const listSchema = z.preprocess(
  normalizeList,
  z.array(z.string().min(1).max(160)).max(50)
);

const createClientSchema = z.object({
  name: z.string().min(1).max(120)
});

const clientStrategySchema = z.object({
  brandVoiceNotes: z.string().max(4000).optional().nullable(),
  contentDo: listSchema.optional(),
  contentDont: listSchema.optional(),
  contentPillars: listSchema.optional(),
  ctaStyle: z.string().max(500).optional().nullable(),
  defaultHashtags: listSchema.optional(),
  bannedTerms: listSchema.optional(),
  requiredDisclaimer: z.string().max(1000).optional().nullable()
});

const updateClientSchema = clientStrategySchema.extend({
  name: z.string().min(1).max(120).optional()
});

const generateDraftsSchema = z.object({
  count: z.number().int().min(1).max(12).default(3),
  platforms: z.array(z.enum(["linkedin", "instagram", "youtube"]))
    .min(1)
    .max(3)
});

module.exports = {
  createClientSchema,
  clientStrategySchema,
  generateDraftsSchema,
  updateClientSchema
};

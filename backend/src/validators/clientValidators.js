const { z } = require("zod");

const createClientSchema = z.object({
  name: z.string().min(1).max(120)
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(120).optional()
});

module.exports = {
  createClientSchema,
  updateClientSchema
};


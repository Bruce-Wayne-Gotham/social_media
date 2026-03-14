const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = registerSchema;

module.exports = {
  registerSchema,
  loginSchema
};


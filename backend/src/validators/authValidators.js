const { z } = require("zod");

const PASSWORD_HELP_TEXT =
  "At least 8 chars, with minimum one uppercase, lowercase, number, and special character.";

function isStrongPassword(value) {
  if (typeof value !== "string") return false;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  return value.length >= 8 && hasLower && hasUpper && hasNumber && hasSpecial;
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(1, { message: "Password is required." })
    .refine(isStrongPassword, { message: `Password must be strong. ${PASSWORD_HELP_TEXT}` })
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "Password is required." })
});

module.exports = {
  PASSWORD_HELP_TEXT,
  registerSchema,
  loginSchema
};


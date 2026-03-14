const { registerSchema, loginSchema } = require("../validators/authValidators");
const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);
    const response = await authService.register(payload);
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const response = await authService.login(payload);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.sub);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  me
};


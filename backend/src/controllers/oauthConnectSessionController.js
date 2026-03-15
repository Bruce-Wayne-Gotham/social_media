const { z } = require("zod");
const sessionService = require("../services/oauthConnectSessionService");

const consumeSchema = z.object({
  clientId: z.string().uuid().optional(),
  providerAccountIds: z.array(z.string().min(1)).min(1)
});

async function getSession(req, res, next) {
  try {
    const session = await sessionService.getSessionForUser(req.user.sub, req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Connect session not found" });
    }

    // Do not expose tokens to the frontend.
    return res.json({
      session: {
        id: session.id,
        platform: session.platform,
        clientId: session.client_id,
        candidates: session.profile_candidates,
        consumedAt: session.consumed_at,
        createdAt: session.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function consume(req, res, next) {
  try {
    const payload = consumeSchema.parse(req.body);
    const result = await sessionService.consumeSession(req.user.sub, req.params.sessionId, payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  consume,
  getSession
};


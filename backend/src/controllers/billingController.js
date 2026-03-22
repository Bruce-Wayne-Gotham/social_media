const { z } = require("zod");

const billingService = require("../services/billingService");
const workspaceService = require("../services/workspaceService");

const checkoutSchema = z.object({});

async function getWorkspaceBilling(req, res, next) {
  try {
    await workspaceService.assertWorkspaceMember(req.user.sub, req.params.workspaceId);
    const billing = await billingService.getWorkspaceBillingSnapshot(req.params.workspaceId);
    res.json({ billing });
  } catch (error) {
    next(error);
  }
}

async function createCheckoutSession(req, res, next) {
  try {
    checkoutSchema.parse(req.body || {});
    const result = await billingService.createCheckoutSession({
      userId: req.user.sub,
      workspaceId: req.params.workspaceId
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function handleStripeWebhook(req, res, next) {
  try {
    await billingService.handleStripeWebhook(
      req.body,
      req.headers["stripe-signature"]
    );
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCheckoutSession,
  getWorkspaceBilling,
  handleStripeWebhook
};

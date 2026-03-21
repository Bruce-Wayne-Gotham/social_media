function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(`${value}`.trim().toLowerCase());
}

function getBillingConfig(env = process.env) {
  const frontendUrl = (env.FRONTEND_URL || "http://localhost:3000").trim().replace(/\/+$/, "");

  return {
    enabled: parseBoolean(env.BILLING_ENABLED, true),
    provider: "stripe",
    checkoutSuccessUrl: (env.STRIPE_CHECKOUT_SUCCESS_URL || `${frontendUrl}/dashboard?billing=success`).trim(),
    checkoutCancelUrl: (env.STRIPE_CHECKOUT_CANCEL_URL || `${frontendUrl}/dashboard?billing=cancelled`).trim(),
    stripe: {
      secretKey: (env.STRIPE_SECRET_KEY || "").trim(),
      webhookSecret: (env.STRIPE_WEBHOOK_SECRET || "").trim(),
      paidPriceId: (env.STRIPE_PRICE_ID_PRO || "").trim(),
      apiBaseUrl: (env.STRIPE_API_BASE_URL || "https://api.stripe.com/v1").trim().replace(/\/+$/, "")
    },
    plans: {
      free: {
        code: "free",
        name: "Free",
        limits: {
          seats: parseNumber(env.BILLING_FREE_SEATS, 1),
          clients: parseNumber(env.BILLING_FREE_CLIENTS, 1),
          profiles: parseNumber(env.BILLING_FREE_PROFILES, 3),
          postsPerMonth: parseNumber(env.BILLING_FREE_POSTS_PER_MONTH, 25),
          aiCredits: parseNumber(env.BILLING_FREE_AI_CREDITS, 10)
        }
      },
      pro: {
        code: "pro",
        name: "Agency Pro",
        limits: {
          seats: parseNumber(env.BILLING_PRO_SEATS, 5),
          clients: parseNumber(env.BILLING_PRO_CLIENTS, 25),
          profiles: parseNumber(env.BILLING_PRO_PROFILES, 75),
          postsPerMonth: parseNumber(env.BILLING_PRO_POSTS_PER_MONTH, 500),
          aiCredits: parseNumber(env.BILLING_PRO_AI_CREDITS, 250)
        }
      }
    }
  };
}

module.exports = {
  getBillingConfig
};

const crypto = require("node:crypto");

const { query } = require("../config/db");
const { getBillingConfig } = require("../config/billing");
const { httpError } = require("../utils/httpError");
const { getWorkspaceMemberRecord } = require("./accessService");

const LIMIT_LABELS = {
  seats: "team seats",
  clients: "clients",
  profiles: "social profiles",
  postsPerMonth: "posts this month",
  aiCredits: "AI credits this month"
};

function getPlanDefinition(planCode, config = getBillingConfig()) {
  return config.plans[planCode] || config.plans.free;
}

function normalizeBillingRow(row) {
  if (!row) {
    return null;
  }

  return {
    workspaceId: row.workspace_id,
    planCode: row.plan_code || "free",
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    stripePriceId: row.stripe_price_id || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripeSubscriptionStatus: row.stripe_subscription_status || null,
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end)
  };
}

function buildSnapshot({ billingRow, usage, config = getBillingConfig() }) {
  const plan = getPlanDefinition(billingRow.planCode, config);

  return {
    workspaceId: billingRow.workspaceId,
    provider: config.provider,
    plan: {
      code: plan.code,
      name: plan.name,
      limits: plan.limits
    },
    subscription: {
      status: billingRow.stripeSubscriptionStatus,
      currentPeriodStart: billingRow.currentPeriodStart,
      currentPeriodEnd: billingRow.currentPeriodEnd,
      cancelAtPeriodEnd: billingRow.cancelAtPeriodEnd
    },
    usage: {
      seats: usage.seats,
      clients: usage.clients,
      profiles: usage.profiles,
      postsPerMonth: usage.postsPerMonth,
      aiCredits: usage.aiCredits
    },
    upgradeAvailable: Boolean(config.stripe.secretKey && config.stripe.paidPriceId && plan.code === "free")
  };
}

function normalizeStripeObject(object = {}) {
  const periodStart = object.current_period_start
    ? new Date(Number(object.current_period_start) * 1000).toISOString()
    : null;
  const periodEnd = object.current_period_end
    ? new Date(Number(object.current_period_end) * 1000).toISOString()
    : null;
  const priceId = object.items?.data?.[0]?.price?.id || object.plan?.id || null;

  return {
    stripeCustomerId: object.customer || null,
    stripeSubscriptionId: object.id || null,
    stripePriceId: priceId,
    stripeSubscriptionStatus: object.status || null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(object.cancel_at_period_end)
  };
}

function resolvePlanCodeFromStripe({ stripePriceId, stripeSubscriptionStatus }, config = getBillingConfig()) {
  if (!stripePriceId || stripePriceId !== config.stripe.paidPriceId) {
    return "free";
  }

  if (["active", "trialing", "past_due"].includes(stripeSubscriptionStatus)) {
    return "pro";
  }

  return "free";
}

function parseStripeSignatureHeader(header) {
  const parts = `${header || ""}`.split(",").map((part) => part.trim()).filter(Boolean);
  const parsed = {};

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key && value) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function timingSafeMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual || "", "utf8");
  const expectedBuffer = Buffer.from(expected || "", "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifyStripeWebhookSignature(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) {
    throw httpError("Stripe webhook secret is not configured", 500);
  }

  const { t: timestamp, v1: signature } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || !signature) {
    throw httpError("Invalid Stripe signature header", 400);
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!timingSafeMatch(signature, expected)) {
    throw httpError("Stripe webhook signature verification failed", 400);
  }
}

async function stripeRequest({
  method = "GET",
  path,
  body,
  config = getBillingConfig(),
  fetchImpl = fetch
}) {
  if (!config.stripe.secretKey) {
    throw httpError("Stripe is not configured: missing STRIPE_SECRET_KEY", 503);
  }

  const headers = {
    Authorization: `Bearer ${config.stripe.secretKey}`
  };

  let payload;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(body).toString();
  }

  const response = await fetchImpl(`${config.stripe.apiBaseUrl}${path}`, {
    method,
    headers,
    body: payload
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(result?.error?.message || "Stripe request failed", response.status >= 400 ? response.status : 502);
  }

  return result;
}

async function ensureWorkspaceBillingRecord(workspaceId, queryFn = query) {
  await queryFn(
    `INSERT INTO workspace_billing (workspace_id)
     VALUES ($1)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId]
  );
}

async function getWorkspaceBillingRow(workspaceId, queryFn = query) {
  await ensureWorkspaceBillingRecord(workspaceId, queryFn);
  const result = await queryFn(
    `SELECT workspace_id, plan_code, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_checkout_session_id,
            stripe_subscription_status, current_period_start, current_period_end, cancel_at_period_end
     FROM workspace_billing
     WHERE workspace_id = $1`,
    [workspaceId]
  );

  return normalizeBillingRow(result.rows[0]);
}

async function getWorkspaceUsage(workspaceId, queryFn = query) {
  const result = await queryFn(
    `SELECT
       (SELECT COUNT(*)::int FROM workspace_members WHERE workspace_id = $1) AS seats,
       (SELECT COUNT(*)::int FROM clients WHERE workspace_id = $1) AS clients,
       (
         SELECT COUNT(*)::int
         FROM social_profiles sa
         JOIN clients c ON c.id = sa.client_id
         WHERE c.workspace_id = $1
       ) AS profiles,
       (
         SELECT COUNT(*)::int
         FROM posts p
         JOIN clients c ON c.id = p.client_id
         WHERE c.workspace_id = $1
           AND p.created_at >= DATE_TRUNC('month', NOW())
       ) AS posts_per_month,
       (
         SELECT COALESCE(SUM(generated_count), 0)::int
         FROM workspace_ai_generation_usage
         WHERE workspace_id = $1
           AND status = 'succeeded'
           AND created_at >= DATE_TRUNC('month', NOW())
       ) AS ai_credits`,
    [workspaceId]
  );

  const row = result.rows[0] || {};
  return {
    seats: row.seats || 0,
    clients: row.clients || 0,
    profiles: row.profiles || 0,
    postsPerMonth: row.posts_per_month || 0,
    aiCredits: row.ai_credits || 0
  };
}

async function getWorkspaceBillingSnapshot(workspaceId, { queryFn = query, config = getBillingConfig() } = {}) {
  const [billingRow, usage] = await Promise.all([
    getWorkspaceBillingRow(workspaceId, queryFn),
    getWorkspaceUsage(workspaceId, queryFn)
  ]);

  return buildSnapshot({ billingRow, usage, config });
}

async function assertCanManageBilling(userId, workspaceId) {
  const membership = await getWorkspaceMemberRecord(userId, workspaceId);
  if (!membership) {
    throw httpError("Not a workspace member", 403);
  }

  if (!["owner", "admin"].includes(membership.role)) {
    throw httpError("Only workspace owners and admins can manage billing", 403);
  }

  return membership;
}

async function assertWithinWorkspacePlanLimit({
  workspaceId,
  metric,
  amount = 1,
  queryFn = query,
  config = getBillingConfig()
}) {
  const snapshot = await getWorkspaceBillingSnapshot(workspaceId, { queryFn, config });
  const limit = snapshot.plan.limits[metric];
  const current = snapshot.usage[metric];

  if (!Number.isFinite(limit) || limit < 0) {
    return snapshot;
  }

  if (current + amount > limit) {
    throw httpError(
      `Your ${snapshot.plan.name} plan has reached its limit for ${LIMIT_LABELS[metric] || metric}. Upgrade to continue.`,
      403
    );
  }

  return snapshot;
}

async function getOrCreateStripeCustomer({ workspaceId, userId, queryFn = query, config = getBillingConfig(), fetchImpl = fetch }) {
  const billingRow = await getWorkspaceBillingRow(workspaceId, queryFn);
  if (billingRow.stripeCustomerId) {
    return billingRow.stripeCustomerId;
  }

  const userResult = await queryFn(
    `SELECT email
     FROM users
     WHERE id = $1`,
    [userId]
  );
  const email = userResult.rows[0]?.email || "";

  const customer = await stripeRequest({
    method: "POST",
    path: "/customers",
    body: {
      email,
      "metadata[workspace_id]": workspaceId
    },
    config,
    fetchImpl
  });

  await queryFn(
    `UPDATE workspace_billing
     SET stripe_customer_id = $2,
         updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId, customer.id]
  );

  return customer.id;
}

async function createCheckoutSession({
  userId,
  workspaceId,
  queryFn = query,
  config = getBillingConfig(),
  fetchImpl = fetch
}) {
  if (!config.enabled) {
    throw httpError("Billing is currently disabled", 503);
  }

  if (!config.stripe.paidPriceId) {
    throw httpError("Stripe paid plan is not configured", 503);
  }

  await assertCanManageBilling(userId, workspaceId);
  await ensureWorkspaceBillingRecord(workspaceId, queryFn);

  const customerId = await getOrCreateStripeCustomer({ workspaceId, userId, queryFn, config, fetchImpl });
  const session = await stripeRequest({
    method: "POST",
    path: "/checkout/sessions",
    body: {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": config.stripe.paidPriceId,
      "line_items[0][quantity]": "1",
      success_url: config.checkoutSuccessUrl,
      cancel_url: config.checkoutCancelUrl,
      client_reference_id: workspaceId,
      "metadata[workspace_id]": workspaceId,
      "subscription_data[metadata][workspace_id]": workspaceId
    },
    config,
    fetchImpl
  });

  await queryFn(
    `UPDATE workspace_billing
     SET stripe_customer_id = $2,
         stripe_checkout_session_id = $3,
         updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId, customerId, session.id]
  );

  return {
    checkoutUrl: session.url,
    sessionId: session.id
  };
}

async function applyStripeSubscriptionToWorkspace({
  workspaceId,
  subscription,
  queryFn = query,
  config = getBillingConfig()
}) {
  const normalized = normalizeStripeObject(subscription);
  const planCode = resolvePlanCodeFromStripe(normalized, config);

  await ensureWorkspaceBillingRecord(workspaceId, queryFn);
  await queryFn(
    `UPDATE workspace_billing
     SET plan_code = $2,
         stripe_customer_id = $3,
         stripe_subscription_id = $4,
         stripe_price_id = $5,
         stripe_subscription_status = $6,
         current_period_start = $7,
         current_period_end = $8,
         cancel_at_period_end = $9,
         updated_at = NOW()
     WHERE workspace_id = $1`,
    [
      workspaceId,
      planCode,
      normalized.stripeCustomerId,
      normalized.stripeSubscriptionId,
      normalized.stripePriceId,
      normalized.stripeSubscriptionStatus,
      normalized.currentPeriodStart,
      normalized.currentPeriodEnd,
      normalized.cancelAtPeriodEnd
    ]
  );
}

async function resolveWorkspaceIdForStripeEvent(object, queryFn = query) {
  const explicitWorkspaceId = object?.metadata?.workspace_id || object?.client_reference_id || null;
  if (explicitWorkspaceId) {
    return explicitWorkspaceId;
  }

  if (object?.subscription) {
    const bySubscription = await queryFn(
      `SELECT workspace_id
       FROM workspace_billing
       WHERE stripe_subscription_id = $1`,
      [object.subscription]
    );
    if (bySubscription.rows[0]?.workspace_id) {
      return bySubscription.rows[0].workspace_id;
    }
  }

  if (object?.id) {
    const byObjectId = await queryFn(
      `SELECT workspace_id
       FROM workspace_billing
       WHERE stripe_subscription_id = $1 OR stripe_checkout_session_id = $1`,
      [object.id]
    );
    if (byObjectId.rows[0]?.workspace_id) {
      return byObjectId.rows[0].workspace_id;
    }
  }

  if (object?.customer) {
    const byCustomer = await queryFn(
      `SELECT workspace_id
       FROM workspace_billing
       WHERE stripe_customer_id = $1`,
      [object.customer]
    );
    return byCustomer.rows[0]?.workspace_id || null;
  }

  return null;
}

async function fetchStripeSubscription(subscriptionId, { config = getBillingConfig(), fetchImpl = fetch }) {
  return stripeRequest({
    path: `/subscriptions/${subscriptionId}`,
    config,
    fetchImpl
  });
}

async function handleStripeWebhook(rawBodyBuffer, signatureHeader, { queryFn = query, config = getBillingConfig(), fetchImpl = fetch } = {}) {
  const rawBody = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer.toString("utf8") : `${rawBodyBuffer || ""}`;
  verifyStripeWebhookSignature(rawBody, signatureHeader, config.stripe.webhookSecret);

  const event = JSON.parse(rawBody || "{}");
  const object = event?.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const workspaceId = await resolveWorkspaceIdForStripeEvent(object, queryFn);
    if (!workspaceId) {
      return { received: true };
    }

    await ensureWorkspaceBillingRecord(workspaceId, queryFn);
    await queryFn(
      `UPDATE workspace_billing
       SET stripe_customer_id = COALESCE($2, stripe_customer_id),
           stripe_subscription_id = COALESCE($3, stripe_subscription_id),
           stripe_checkout_session_id = COALESCE($4, stripe_checkout_session_id),
           updated_at = NOW()
       WHERE workspace_id = $1`,
      [workspaceId, object.customer || null, object.subscription || null, object.id || null]
    );

    if (object.subscription) {
      const subscription = await fetchStripeSubscription(object.subscription, { config, fetchImpl });
      await applyStripeSubscriptionToWorkspace({ workspaceId, subscription, queryFn, config });
    }

    return { received: true };
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const workspaceId = await resolveWorkspaceIdForStripeEvent(object, queryFn);
    if (workspaceId) {
      await applyStripeSubscriptionToWorkspace({ workspaceId, subscription: object, queryFn, config });
    }
    return { received: true };
  }

  if (event.type === "customer.subscription.deleted") {
    const workspaceId = await resolveWorkspaceIdForStripeEvent(object, queryFn);
    if (workspaceId) {
      await queryFn(
        `UPDATE workspace_billing
         SET plan_code = 'free',
             stripe_subscription_status = $2,
             cancel_at_period_end = FALSE,
             current_period_start = NULL,
             current_period_end = NULL,
             updated_at = NOW()
         WHERE workspace_id = $1`,
        [workspaceId, object.status || "canceled"]
      );
    }
    return { received: true };
  }

  return { received: true };
}

async function countAdditionalProfilesForClient(clientId, platform, providerAccountIds, queryFn = query) {
  const dedupedIds = Array.from(new Set((providerAccountIds || []).filter(Boolean)));
  if (dedupedIds.length === 0) {
    return 0;
  }

  const result = await queryFn(
    `SELECT COUNT(*)::int AS existing_count
     FROM social_profiles
     WHERE client_id = $1
       AND platform = $2
       AND provider_account_id = ANY($3::text[])`,
    [clientId, platform, dedupedIds]
  );

  return Math.max(0, dedupedIds.length - (result.rows[0]?.existing_count || 0));
}

module.exports = {
  assertCanManageBilling,
  assertWithinWorkspacePlanLimit,
  countAdditionalProfilesForClient,
  createCheckoutSession,
  ensureWorkspaceBillingRecord,
  getWorkspaceBillingSnapshot,
  handleStripeWebhook
};

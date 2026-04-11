const { generateDraftsSchema, updateClientSchema, createClientSchema } = require("../validators/clientValidators");
const clientService = require("../services/clientService");
const workspaceService = require("../services/workspaceService");
const postService = require("../services/postService");

// ─── GET /api/clients/:clientId ───────────────────────────────────────────────

async function getClient(req, res, next) {
  try {
    const client = await clientService.getClient(req.user.sub, req.params.clientId);
    if (!client) {
      return res.status(404).json({ error: { code: "CLIENT_NOT_FOUND", message: "Client not found" } });
    }
    return res.json({ data: client });
  } catch (error) {
    return next(error);
  }
}

// ─── PATCH /api/clients/:clientId ────────────────────────────────────────────

async function updateClient(req, res, next) {
  try {
    const patch = updateClientSchema.parse(req.body);
    const client = await clientService.updateClient(req.user.sub, req.params.clientId, patch);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
}

// ─── DELETE /api/clients/:clientId ───────────────────────────────────────────

async function deleteClient(req, res, next) {
  try {
    await clientService.deleteClient(req.user.sub, req.params.clientId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/clients/:clientId/generate-drafts ─────────────────────────────

async function generateDrafts(req, res, next) {
  try {
    const payload = generateDraftsSchema.parse(req.body);
    const posts = await postService.generateDraftsForClient(req.user.sub, req.params.clientId, payload);
    res.status(201).json({ posts });
  } catch (error) {
    next(error);
  }
}

// ─── GET /api/clients — contract path (workspace derived from JWT) ────────────

async function listClientsForCurrentWorkspace(req, res, next) {
  try {
    const workspace = await workspaceService.getCurrentWorkspace(req.user.sub);
    if (!workspace) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No workspace configured" } });
    }
    const result = await clientService.listClients(req.user.sub, workspace.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ─── POST /api/clients — contract path (workspace derived from JWT) ───────────

async function createClientForCurrentWorkspace(req, res, next) {
  try {
    const workspace = await workspaceService.getCurrentWorkspace(req.user.sub);
    if (!workspace) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No workspace configured" } });
    }
    const payload = createClientSchema.parse(req.body);
    const client = await clientService.createClient(req.user.sub, workspace.id, payload);
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createClientForCurrentWorkspace,
  deleteClient,
  generateDrafts,
  getClient,
  listClientsForCurrentWorkspace,
  updateClient,
};

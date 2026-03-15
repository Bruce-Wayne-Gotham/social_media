const { createWorkspaceSchema } = require("../validators/workspaceValidators");
const workspaceService = require("../services/workspaceService");
const clientService = require("../services/clientService");
const { createClientSchema } = require("../validators/clientValidators");

async function listWorkspaces(req, res, next) {
  try {
    const workspaces = await workspaceService.listWorkspacesForUser(req.user.sub);
    res.json({ workspaces });
  } catch (error) {
    next(error);
  }
}

async function createWorkspace(req, res, next) {
  try {
    const payload = createWorkspaceSchema.parse(req.body);
    const workspace = await workspaceService.createWorkspace(req.user.sub, payload);
    res.status(201).json({ workspace });
  } catch (error) {
    next(error);
  }
}

async function getCurrentWorkspace(req, res, next) {
  try {
    const workspace = await workspaceService.getCurrentWorkspace(req.user.sub);
    res.json({ workspace });
  } catch (error) {
    next(error);
  }
}

async function listClients(req, res, next) {
  try {
    const clients = await clientService.listClients(req.user.sub, req.params.workspaceId);
    res.json({ clients });
  } catch (error) {
    next(error);
  }
}

async function createClient(req, res, next) {
  try {
    const payload = createClientSchema.parse(req.body);
    const client = await clientService.createClient(req.user.sub, req.params.workspaceId, payload);
    res.status(201).json({ client });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createClient,
  createWorkspace,
  getCurrentWorkspace,
  listClients,
  listWorkspaces
};


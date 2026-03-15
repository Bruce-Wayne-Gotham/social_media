const { updateClientSchema } = require("../validators/clientValidators");
const clientService = require("../services/clientService");

async function getClient(req, res, next) {
  try {
    const client = await clientService.getClient(req.user.sub, req.params.clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    return res.json({ client });
  } catch (error) {
    return next(error);
  }
}

async function updateClient(req, res, next) {
  try {
    const patch = updateClientSchema.parse(req.body);
    const client = await clientService.updateClient(req.user.sub, req.params.clientId, patch);
    res.json({ client });
  } catch (error) {
    next(error);
  }
}

async function deleteClient(req, res, next) {
  try {
    const result = await clientService.deleteClient(req.user.sub, req.params.clientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  deleteClient,
  getClient,
  updateClient
};


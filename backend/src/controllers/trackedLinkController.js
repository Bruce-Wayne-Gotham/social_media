const { createTrackedLinkSchema } = require("../validators/trackedLinkValidators");
const trackedLinkService = require("../services/trackedLinkService");

async function list(req, res, next) {
  try {
    const links = await trackedLinkService.listTrackedLinks(req.user.sub, req.params.clientId);
    res.json({ links });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const payload = createTrackedLinkSchema.parse(req.body || {});
    const trackedLink = await trackedLinkService.createTrackedLink(req.user.sub, req.params.clientId, payload);
    res.status(201).json({ trackedLink });
  } catch (error) {
    next(error);
  }
}

async function report(req, res, next) {
  try {
    const reportPayload = await trackedLinkService.getTrackingReport(req.user.sub, req.params.clientId);
    res.json(reportPayload);
  } catch (error) {
    next(error);
  }
}

async function resolve(req, res, next) {
  try {
    const url = await trackedLinkService.resolveTrackedLink(req.params.code, {
      referrer: req.get("referer"),
      userAgent: req.get("user-agent")
    });
    res.json({ url });
  } catch (error) {
    next(error);
  }
}

async function redirect(req, res, next) {
  try {
    const url = await trackedLinkService.resolveTrackedLink(req.params.code, {
      referrer: req.get("referer"),
      userAgent: req.get("user-agent")
    });
    res.redirect(url);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  list,
  redirect,
  report,
  resolve
};

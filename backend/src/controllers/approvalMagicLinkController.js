const {
  approvePostSchema,
  commentOnPostSchema,
  createApprovalMagicLinkSchema,
  rejectPostSchema
} = require("../validators/approvalValidators");
const approvalMagicLinkService = require("../services/approvalMagicLinkService");

async function create(req, res, next) {
  try {
    const payload = createApprovalMagicLinkSchema.parse(req.body || {});
    const approvalLink = await approvalMagicLinkService.createApprovalMagicLink(req.user.sub, req.params.clientId, payload);
    res.status(201).json({ approvalLink });
  } catch (error) {
    next(error);
  }
}

async function getOverview(req, res, next) {
  try {
    const overview = await approvalMagicLinkService.getApprovalMagicLinkOverview(req.params.token);
    res.json(overview);
  } catch (error) {
    next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const result = await approvalMagicLinkService.getApprovalMagicLinkPost(req.params.token, req.params.postId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function comment(req, res, next) {
  try {
    const payload = commentOnPostSchema.parse(req.body || {});
    const result = await approvalMagicLinkService.commentWithApprovalMagicLink(req.params.token, req.params.postId, payload.note);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const payload = approvePostSchema.parse(req.body || {});
    const result = await approvalMagicLinkService.approveWithApprovalMagicLink(req.params.token, req.params.postId, payload.note);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function reject(req, res, next) {
  try {
    const payload = rejectPostSchema.parse(req.body || {});
    const result = await approvalMagicLinkService.rejectWithApprovalMagicLink(req.params.token, req.params.postId, payload.note);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  approve,
  comment,
  create,
  getOverview,
  getPost,
  reject
};

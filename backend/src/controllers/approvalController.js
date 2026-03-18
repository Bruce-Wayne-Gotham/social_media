const {
  approvePostSchema,
  commentOnPostSchema,
  rejectPostSchema,
  requestApprovalSchema
} = require("../validators/approvalValidators");
const postService = require("../services/postService");

async function requestApproval(req, res, next) {
  try {
    const payload = requestApprovalSchema.parse(req.body || {});
    const post = await postService.requestApproval(req.user.sub, req.params.id, payload.note);
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

async function approve(req, res, next) {
  try {
    const payload = approvePostSchema.parse(req.body || {});
    const post = await postService.approvePost(req.user.sub, req.params.id, payload.note);
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

async function reject(req, res, next) {
  try {
    const payload = rejectPostSchema.parse(req.body || {});
    const post = await postService.rejectPost(req.user.sub, req.params.id, payload.note);
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

async function comment(req, res, next) {
  try {
    const payload = commentOnPostSchema.parse(req.body || {});
    const post = await postService.addApprovalComment(req.user.sub, req.params.id, payload.note);
    res.json({ post });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  approve,
  comment,
  reject,
  requestApproval
};

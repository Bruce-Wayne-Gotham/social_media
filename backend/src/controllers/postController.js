const { createPostSchema, updatePostSchema } = require("../validators/postValidators");
const postService = require("../services/postService");

async function listPosts(req, res, next) {
  try {
    const posts = await postService.getPostsByUser(req.user.sub);
    res.json({ posts });
  } catch (error) {
    next(error);
  }
}

async function createPost(req, res, next) {
  try {
    const payload = createPostSchema.parse(req.body);
    const post = await postService.createPost(req.user.sub, payload);
    res.status(201).json({ post });
  } catch (error) {
    next(error);
  }
}

async function getPost(req, res, next) {
  try {
    const post = await postService.getPostById(req.user.sub, req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.json({ post });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listPosts,
  createPost,
  getPost,
  async updatePost(req, res, next) {
    try {
      const patch = updatePostSchema.parse(req.body);
      const post = await postService.updatePost(req.user.sub, req.params.id, patch);
      res.json({ post });
    } catch (error) {
      next(error);
    }
  }
};


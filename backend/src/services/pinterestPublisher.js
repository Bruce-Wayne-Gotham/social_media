// TODO: Implement Pinterest publishing via Pinterest API v5
// POST https://api.pinterest.com/v5/pins
// Fields: board_id, title, description, media_source (image_url / video_id)
async function publishPinterestPost({ accessToken, payload }) {
  return {
    externalPostId: `stub_pinterest_${Date.now()}`
  };
}

module.exports = {
  publishPinterestPost
};

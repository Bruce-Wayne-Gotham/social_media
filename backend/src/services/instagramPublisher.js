async function publishInstagramPost({ accessToken, payload }) {
  return {
    platform: "instagram",
    success: true,
    externalPostId: `ig_${Date.now()}`,
    requestPreview: {
      bearerTokenPresent: Boolean(accessToken),
      payload
    }
  };
}

module.exports = {
  publishInstagramPost
};

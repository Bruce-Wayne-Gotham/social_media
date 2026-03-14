async function publishTwitterPost({ accessToken, payload }) {
  return {
    platform: "twitter",
    success: true,
    externalPostId: `tw_${Date.now()}`,
    requestPreview: {
      bearerTokenPresent: Boolean(accessToken),
      payload
    }
  };
}

module.exports = {
  publishTwitterPost
};


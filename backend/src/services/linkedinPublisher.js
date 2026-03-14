async function publishLinkedInPost({ accessToken, payload }) {
  return {
    platform: "linkedin",
    success: true,
    externalPostId: `li_${Date.now()}`,
    requestPreview: {
      bearerTokenPresent: Boolean(accessToken),
      payload
    }
  };
}

module.exports = {
  publishLinkedInPost
};


async function publishYoutubeMetadata({ accessToken, payload }) {
  return {
    platform: "youtube",
    success: true,
    externalPostId: `yt_${Date.now()}`,
    requestPreview: {
      bearerTokenPresent: Boolean(accessToken),
      payload
    }
  };
}

module.exports = {
  publishYoutubeMetadata
};


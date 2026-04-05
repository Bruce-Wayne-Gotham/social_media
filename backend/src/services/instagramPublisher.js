// TODO: Implement Reddit publishing via Reddit OAuth REST API
// POST https://oauth.reddit.com/api/submit
// Fields: sr (subreddit), kind ('self' or 'link'), title, text/url
async function publishRedditPost({ accessToken, payload }) {
  return {
    externalPostId: `stub_reddit_${Date.now()}`
  };
}

module.exports = {
  publishRedditPost
};

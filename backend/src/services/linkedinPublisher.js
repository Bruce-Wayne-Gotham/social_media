// TODO: Implement Telegram publishing via Telegram Bot API
// POST https://api.telegram.org/bot<token>/sendMessage (text)
// POST https://api.telegram.org/bot<token>/sendPhoto  (image)
// POST https://api.telegram.org/bot<token>/sendVideo  (video)
async function publishTelegramPost({ accessToken, payload }) {
  return {
    externalPostId: `stub_telegram_${Date.now()}`
  };
}

module.exports = {
  publishTelegramPost
};

const PLATFORM_ALIASES = {
  telegram: "telegram",
  reddit: "reddit",
  youtube: "youtube",
  pinterest: "pinterest"
};

const SUPPORTED_PLATFORMS = ["telegram", "reddit", "youtube", "pinterest"];

function normalizePlatform(platform) {
  if (typeof platform !== "string") {
    return platform;
  }

  const normalized = PLATFORM_ALIASES[platform.trim().toLowerCase()];
  return normalized || platform;
}

module.exports = {
  SUPPORTED_PLATFORMS,
  normalizePlatform
};

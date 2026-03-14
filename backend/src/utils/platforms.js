const PLATFORM_ALIASES = {
  twitter: "twitter",
  x: "twitter",
  "x/twitter": "twitter",
  "twitter/x": "twitter",
  linkedin: "linkedin",
  instagram: "instagram",
  youtube: "youtube"
};

const SUPPORTED_PLATFORMS = ["twitter", "linkedin", "instagram", "youtube"];

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

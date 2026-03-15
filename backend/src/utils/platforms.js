const PLATFORM_ALIASES = {
  linkedin: "linkedin",
  instagram: "instagram",
  youtube: "youtube"
};

const SUPPORTED_PLATFORMS = ["linkedin", "instagram", "youtube"];

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

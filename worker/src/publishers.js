const { fetchJson, readResponseBody } = require("./http");

const META_API_VERSION = process.env.META_API_VERSION || "v23.0";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202502";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVideoUrl(url) {
  return /\.(mp4|mov|avi|webm|m4v)(\?.*)?$/i.test(url);
}

function guessContentType(url) {
  if (/\.(mp4|m4v)(\?.*)?$/i.test(url)) {
    return "video/mp4";
  }
  if (/\.mov(\?.*)?$/i.test(url)) {
    return "video/quicktime";
  }
  if (/\.webm(\?.*)?$/i.test(url)) {
    return "video/webm";
  }
  return "application/octet-stream";
}

async function publishLinkedInPost({ accessToken, payload }) {
  const profile = await fetchJson("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!profile.sub) {
    throw new Error("LinkedIn profile did not return a member identifier");
  }

  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify({
      author: `urn:li:person:${profile.sub}`,
      commentary: payload.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    })
  });

  const body = await readResponseBody(response);
  if (!response.ok) {
    const message = typeof body === "string"
      ? body
      : body.message || body.error_description || "LinkedIn publish failed";
    throw new Error(message);
  }

  return {
    externalPostId: response.headers.get("x-restli-id") || body.id || `linkedin_${Date.now()}`
  };
}

async function resolveInstagramBusinessAccount(accessToken) {
  const result = await fetchJson(
    `https://graph.facebook.com/${META_API_VERSION}/me/accounts?fields=instagram_business_account{id,username},name&access_token=${encodeURIComponent(accessToken)}`
  );

  const page = (result.data || []).find((item) => item.instagram_business_account?.id);
  if (!page) {
    throw new Error("No Instagram business account is linked to this Facebook account");
  }

  return page.instagram_business_account;
}

async function waitForInstagramContainer(creationId, accessToken) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await fetchJson(
      `https://graph.facebook.com/${META_API_VERSION}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
    );

    const status = result.status_code || result.status;
    if (status === "FINISHED" || status === "PUBLISHED") {
      return;
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram media processing failed with status ${status}`);
    }

    await sleep(3000);
  }

  throw new Error("Instagram media processing timed out");
}

async function publishInstagramPost({ accessToken, payload }) {
  if (!payload.mediaUrl) {
    throw new Error("Instagram publishing requires a public media URL");
  }

  const account = await resolveInstagramBusinessAccount(accessToken);
  const mediaParams = new URLSearchParams({
    access_token: accessToken,
    caption: payload.caption || ""
  });

  if (isVideoUrl(payload.mediaUrl)) {
    mediaParams.set("media_type", "REELS");
    mediaParams.set("video_url", payload.mediaUrl);
  } else {
    mediaParams.set("image_url", payload.mediaUrl);
  }

  const container = await fetchJson(`https://graph.facebook.com/${META_API_VERSION}/${account.id}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: mediaParams.toString()
  });

  if (isVideoUrl(payload.mediaUrl)) {
    await waitForInstagramContainer(container.id, accessToken);
  }

  const publishResult = await fetchJson(
    `https://graph.facebook.com/${META_API_VERSION}/${account.id}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        access_token: accessToken,
        creation_id: container.id
      }).toString()
    }
  );

  return {
    externalPostId: publishResult.id || container.id
  };
}

async function publishYoutubeMetadata({ accessToken, payload }) {
  if (!payload.mediaUrl) {
    throw new Error("YouTube publishing requires a public video URL");
  }

  const mediaResponse = await fetch(payload.mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error("Unable to download media for YouTube upload");
  }

  const contentType = mediaResponse.headers.get("content-type") || guessContentType(payload.mediaUrl);
  if (!contentType.startsWith("video/")) {
    throw new Error("YouTube uploads require video media");
  }

  const mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
  const metadata = {
    snippet: {
      title: payload.title,
      description: payload.description,
      tags: payload.tags || []
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || "unlisted"
    }
  };
  const boundary = `socialhub-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    mediaBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const result = await fetchJson("https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  return {
    externalPostId: result.id || `youtube_${Date.now()}`
  };
}

module.exports = {
  publishLinkedInPost,
  publishInstagramPost,
  publishYoutubeMetadata
};

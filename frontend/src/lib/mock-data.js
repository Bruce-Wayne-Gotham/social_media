export const WORKSPACE = {
  id: "ws_001", name: "Acme Agency", slug: "acme-agency",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
}

export const CLIENTS = [
  { id: "client_001", workspaceId: "ws_001", name: "Nike India", slug: "nike-india", logoUrl: null, brandNotes: "Inspirational tone.", createdAt: "2026-01-15T00:00:00.000Z", updatedAt: "2026-01-15T00:00:00.000Z" },
  { id: "client_002", workspaceId: "ws_001", name: "Zomato", slug: "zomato", logoUrl: null, brandNotes: "Fun and casual.", createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" },
  { id: "client_003", workspaceId: "ws_001", name: "HDFC Bank", slug: "hdfc-bank", logoUrl: null, brandNotes: "Formal and trustworthy.", createdAt: "2026-02-15T00:00:00.000Z", updatedAt: "2026-02-15T00:00:00.000Z" }
]

export const SOCIAL_PROFILES = [
  { id: "sp_001", clientId: "client_001", platform: "youtube", displayName: "Nike India Official", profileImageUrl: null, providerId: "UCxxx123", providerType: "channel", providerMeta: {}, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_002", clientId: "client_001", platform: "telegram", displayName: "@nikeindia", profileImageUrl: null, providerId: "-1001234567890", providerType: "channel", providerMeta: { channelUsername: "@nikeindia" }, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_003", clientId: "client_001", platform: "reddit", displayName: "r/running", profileImageUrl: null, providerId: "t5_running", providerType: "subreddit_mod", providerMeta: { subreddit: "r/running", username: "nikeindia_official" }, isConnected: true, connectedAt: "2026-01-20T00:00:00.000Z", lastSyncedAt: "2026-04-01T00:00:00.000Z", createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "sp_004", clientId: "client_001", platform: "pinterest", displayName: "Nike India Pins", profileImageUrl: null, providerId: "nikeindia_pins", providerType: "account", providerMeta: { boardId: "123456", boardName: "Running Inspiration" }, isConnected: false, connectedAt: null, lastSyncedAt: null, createdAt: "2026-01-20T00:00:00.000Z" }
]

export const POSTS = [
  {
    id: "post_001", clientId: "client_001", workspaceId: "ws_001",
    status: "needs_approval",
    originalContent: "We just launched our new running shoe. Built for speed, designed for comfort.",
    scheduledAt: "2026-04-06T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_001", postId: "post_001", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "Our new running shoe is here.", adaptedTitle: "Nike Launches New Running Shoe", status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } },
      { id: "tgt_002", postId: "post_001", socialProfileId: "sp_002", platform: "telegram", adaptedContent: "Just launched: our new running shoe. Check it out!", adaptedTitle: null, status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_002", displayName: "@nikeindia", profileImageUrl: null, platform: "telegram", providerMeta: { channelUsername: "@nikeindia" } } }
    ],
    approvalLog: [
      { id: "log_001", postId: "post_001", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: "Ready for review.", createdAt: "2026-04-04T11:00:00.000Z" }
    ],
    createdAt: "2026-04-04T10:30:00.000Z", updatedAt: "2026-04-04T11:00:00.000Z"
  },
  {
    id: "post_002", clientId: "client_001", workspaceId: "ws_001",
    status: "scheduled",
    originalContent: "Training season is here. Join the movement.",
    scheduledAt: "2026-04-07T10:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_003", postId: "post_002", socialProfileId: "sp_003", platform: "reddit", adaptedContent: "Training season is here. We put together some tips for the community.", adaptedTitle: "Training Season is Here — Tips from Nike India", status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_003", displayName: "r/running", profileImageUrl: null, platform: "reddit", providerMeta: { subreddit: "r/running" } } }
    ],
    approvalLog: [
      { id: "log_002", postId: "post_002", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-04-03T09:00:00.000Z" },
      { id: "log_003", postId: "post_002", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: "Approved.", createdAt: "2026-04-03T11:00:00.000Z" }
    ],
    createdAt: "2026-04-03T08:00:00.000Z", updatedAt: "2026-04-03T11:00:00.000Z"
  },
  {
    id: "post_003", clientId: "client_001", workspaceId: "ws_001",
    status: "draft",
    originalContent: "New collection dropping this weekend.",
    scheduledAt: null, publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [],
    approvalLog: [],
    createdAt: "2026-04-04T08:00:00.000Z", updatedAt: "2026-04-04T08:00:00.000Z"
  },
  {
    id: "post_004", clientId: "client_001", workspaceId: "ws_001",
    status: "published",
    originalContent: "Celebrating 10 years of Nike India.",
    scheduledAt: "2026-04-01T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_004", postId: "post_004", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "10 years of inspiring India.", adaptedTitle: "10 Years of Nike India", status: "published", externalPostId: "yt_abc123", failureReason: null, approvedAt: "2026-03-30T10:00:00.000Z", publishedAt: "2026-04-01T09:01:00.000Z", socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } }
    ],
    approvalLog: [
      { id: "log_004", postId: "post_004", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-03-29T10:00:00.000Z" },
      { id: "log_005", postId: "post_004", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: "Great post!", createdAt: "2026-03-30T10:00:00.000Z" }
    ],
    createdAt: "2026-03-29T09:00:00.000Z", updatedAt: "2026-04-01T09:01:00.000Z"
  },
  {
    id: "post_005", clientId: "client_001", workspaceId: "ws_001",
    status: "failed",
    originalContent: "Flash sale — 20% off all running gear.",
    scheduledAt: "2026-04-02T09:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_005", postId: "post_005", socialProfileId: "sp_004", platform: "pinterest", adaptedContent: "Flash sale! 20% off all running gear this weekend.", adaptedTitle: "Flash Sale — 20% Off Running Gear", status: "failed", externalPostId: null, failureReason: "Pinterest account not connected.", approvedAt: "2026-04-01T10:00:00.000Z", publishedAt: null, socialProfile: { id: "sp_004", displayName: "Nike India Pins", profileImageUrl: null, platform: "pinterest", providerMeta: {} } }
    ],
    approvalLog: [
      { id: "log_006", postId: "post_005", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-04-01T08:00:00.000Z" },
      { id: "log_007", postId: "post_005", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: null, createdAt: "2026-04-01T10:00:00.000Z" }
    ],
    createdAt: "2026-04-01T07:00:00.000Z", updatedAt: "2026-04-02T09:02:00.000Z"
  },
  // Extra calendar post — needs_approval, 3 days from today (2026-04-08)
  {
    id: "post_006", clientId: "client_001", workspaceId: "ws_001",
    status: "needs_approval",
    originalContent: "Spring collection teaser — something fresh is coming your way.",
    scheduledAt: "2026-04-08T10:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_006", postId: "post_006", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "Spring collection teaser — stay tuned for what's next from Nike India. #Nike #SpringCollection #NewDrop", adaptedTitle: "Spring 2026 Collection Teaser | Nike India", status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } },
      { id: "tgt_007", postId: "post_006", socialProfileId: "sp_002", platform: "telegram", adaptedContent: "Something fresh is coming. Spring collection drops soon — watch this space!", adaptedTitle: null, status: "pending", externalPostId: null, failureReason: null, approvedAt: null, publishedAt: null, socialProfile: { id: "sp_002", displayName: "@nikeindia", profileImageUrl: null, platform: "telegram", providerMeta: { channelUsername: "@nikeindia" } } }
    ],
    approvalLog: [
      { id: "log_008", postId: "post_006", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: "Calendar teaser post.", createdAt: "2026-04-05T09:00:00.000Z" }
    ],
    createdAt: "2026-04-05T08:30:00.000Z", updatedAt: "2026-04-05T09:00:00.000Z"
  },
  // Extra calendar post — scheduled, 5 days from today (2026-04-10)
  {
    id: "post_007", clientId: "client_001", workspaceId: "ws_001",
    status: "scheduled",
    originalContent: "Run for a cause. Join Nike India's charity marathon this month.",
    scheduledAt: "2026-04-10T08:00:00.000Z", publishImmediately: false,
    createdBy: { id: "user_001", name: "Vishal Sharma", avatarUrl: null },
    targets: [
      { id: "tgt_008", postId: "post_007", socialProfileId: "sp_001", platform: "youtube", adaptedContent: "Join Nike India's charity marathon this month. Every step counts. #Nike #CharityRun #Marathon", adaptedTitle: "Nike India Charity Marathon — Run for a Cause", status: "pending", externalPostId: null, failureReason: null, approvedAt: "2026-04-05T10:00:00.000Z", publishedAt: null, socialProfile: { id: "sp_001", displayName: "Nike India Official", profileImageUrl: null, platform: "youtube", providerMeta: {} } },
      { id: "tgt_009", postId: "post_007", socialProfileId: "sp_002", platform: "telegram", adaptedContent: "Run for a cause! Nike India charity marathon — sign up now.", adaptedTitle: null, status: "pending", externalPostId: null, failureReason: null, approvedAt: "2026-04-05T10:00:00.000Z", publishedAt: null, socialProfile: { id: "sp_002", displayName: "@nikeindia", profileImageUrl: null, platform: "telegram", providerMeta: { channelUsername: "@nikeindia" } } }
    ],
    approvalLog: [
      { id: "log_009", postId: "post_007", action: "submitted", actorId: "user_001", actorName: "Vishal Sharma", comment: null, createdAt: "2026-04-05T08:00:00.000Z" },
      { id: "log_010", postId: "post_007", action: "approved", actorId: "user_002", actorName: "Viresh Kumar", comment: "Approved for calendar.", createdAt: "2026-04-05T10:00:00.000Z" }
    ],
    createdAt: "2026-04-05T07:30:00.000Z", updatedAt: "2026-04-05T10:00:00.000Z"
  }
]

export const STATS = {
  clientId: "client_001",
  period: "current_week",
  postsThisWeek: 4,
  pendingApprovals: 1,
  scheduledUpcoming: 2,
  publishedThisMonth: 6,
  failedTotal: 1,
  approvalRate: 0.89,
  avgHoursToApproval: 2.8
}

export const MOCK_ADAPTATIONS = {
  postId: "post_003",
  adaptations: [
    { targetId: "tgt_new_1", socialProfileId: "sp_001", platform: "youtube", content: "New collection dropping this weekend. Be the first to get yours. #Nike #NewCollection #Weekend", title: "New Nike Collection Drops This Weekend", charCount: 96, hashtagCount: 3, notes: "Added searchable title. Hashtags optimised for YouTube discovery." },
    { targetId: "tgt_new_2", socialProfileId: "sp_002", platform: "telegram", content: "New collection dropping this weekend. Stay tuned!", title: null, charCount: 51, hashtagCount: 0, notes: "Kept short and direct for Telegram. No hashtags." },
    { targetId: "tgt_new_3", socialProfileId: "sp_003", platform: "reddit", content: "Dropping a new collection this weekend. Would love to hear what you all think of the direction we are taking with the new designs.", title: "New Nike India collection this weekend — thoughts?", charCount: 133, hashtagCount: 0, notes: "Conversational tone for Reddit. No hashtags. Title phrased as discussion starter." },
    { targetId: "tgt_new_4", socialProfileId: "sp_004", platform: "pinterest", content: "New collection this weekend. Discover the latest styles. #Nike #Fashion #NewArrival", title: "New Nike Collection — Weekend Drop", charCount: 83, hashtagCount: 3, notes: "Visual-first tone for Pinterest. Action-oriented." }
  ]
}

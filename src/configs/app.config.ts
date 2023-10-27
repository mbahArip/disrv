const CONF_APP = {
  app_name: "discord-fs",
  app_cache_duration: 60 * 60 * 24 * 7, // 1 week
  isPublic: true,
  downloadStrategy: "redirect", // redirect | proxy

  discord_api_version: "v10",
  discord_channel_id: "1167222461331419156",
  discord_webhook_name: "ds-fs:id@helper",

  // CORS settings
  app_allowed_origins: ["*"],

  // Pagination
  items_per_page: 50,
};

export default CONF_APP;

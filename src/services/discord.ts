import CONF_APP from "../configs/app.config";

export function createRESTUrl(
  endpoint: string,
  version: string = CONF_APP.discord_api_version
): string {
  const url = new URL(`https://discord.com/api/${version}${endpoint}`);
  return url.toString();
}

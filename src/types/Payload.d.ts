export interface CreatePayload {
  name: string;
  path?: string;
  pathParent?: string;
  folderId?: string;
  description?: string;
  size?: number;
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
  duration?: number;
}

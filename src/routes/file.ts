import axios from "axios";
import { Hono } from "hono";
import { authMiddleware } from "..";
import prisma from "../client/prisma";
import CONF_APP from "../configs/app.config";
import { createRESTUrl } from "../services/discord";

const app = new Hono();
const path = "/file";

app.post("/", authMiddleware, async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File;

  if (!file) {
    throw new Error("File is required");
  }
  if (file.size > 1024 * 1024 * 25) {
    throw new Error(
      "File size is too large, Discord only allows 25MB per file"
    );
  }

  const endpoint = createRESTUrl(
    `/channels/${CONF_APP.discord_channel_id}/webhooks`
  );
  const data = await axios
    .get(endpoint, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })
    .then((res) => res.data);

  const randomWebhook = data[Math.floor(Math.random() * data.length)];
  const webhook = `${randomWebhook.id}/${randomWebhook.token}`;

  const fileExtension = file.name.split(".").pop();
  const overrideName = body["name"]
    ? body["name"] + `.${fileExtension}`
    : file.name;

  const uploadEndpoint = createRESTUrl(`/webhooks/${webhook}`);
  const formData = new FormData();
  formData.append("file", file, overrideName.toLowerCase());
  formData.append("wait", "true");
  const upload = await axios
    .post(uploadEndpoint, formData, {
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
    })
    .then((res) => res.data);

  let discordId = upload.attachments[0].url.split("attachments/")[1].split("/");
  discordId = `${discordId[0]}/${discordId[1]}`;

  const newFile = await prisma.file.create({
    data: {
      name: upload.attachments[0].filename,
      discordId,
      folderId: (body["folderId"] as string) || undefined,
      description: upload.attachments[0].description || undefined,
      content_type: upload.attachments[0].content_type || file.type,
      size: Number(upload.attachments[0].size || file.size || 0),
      height: Number(upload.attachments[0].height) || undefined,
      width: Number(upload.attachments[0].width) || undefined,
      duration: undefined,
    },
  });

  return c.json({
    code: 201,
    message: "Success",
    data: newFile,
  });
});

app.delete("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await prisma.file.delete({
    where: {
      id,
    },
  });

  return c.json({
    code: 200,
    message: `File with id ${id} has been deleted`,
  });
});
app.get("/:id", async (c) => {
  const download = c.req.query("download");
  const thumbnail = c.req.query("thumbnail");
  const preview = c.req.query("preview");

  const thumbWidth = c.req.query("width");
  const thumbHeight = c.req.query("height");

  const isDownload =
    download === "true" ||
    download === "1" ||
    download === "yes" ||
    download === "y";
  const isThumbnail =
    thumbnail === "true" ||
    thumbnail === "1" ||
    thumbnail === "yes" ||
    thumbnail === "y";
  const isThumbnailResize = isThumbnail && thumbWidth && thumbHeight;
  const isPreview =
    preview === "true" ||
    preview === "1" ||
    preview === "yes" ||
    preview === "y";

  const id = c.req.param("id");
  const file = await prisma.file.findUnique({
    where: {
      id,
    },
  });
  if (!file) {
    return c.notFound();
  }
  if (!isDownload && !isThumbnail && !isPreview) {
    return c.json({
      code: 200,
      message: "Success",
      data: {
        ...file,
        download_url: `${c.req.url}?download=1`,
      },
    });
  }

  const fileURL = new URL(
    `/attachments/${file.discordId}/${file.name}`,
    "https://cdn.discordapp.com"
  );
  if (isThumbnail) {
    fileURL.hostname = "media.discordapp.net";
    fileURL.searchParams.set("format", "webp");
    if (isThumbnailResize) {
      fileURL.searchParams.set("width", thumbWidth);
      fileURL.searchParams.set("height", thumbHeight);
    }
  }

  if (CONF_APP.downloadStrategy === "proxy") {
    return c.redirect(fileURL.toString(), 302);
  }

  const fileBuffer = await axios.get(fileURL.toString(), {
    responseType: "arraybuffer",
  });
  c.res.headers.set(
    "Cache-Control",
    `public, max-age=${CONF_APP.app_cache_duration}`
  );
  if (isDownload) {
    c.res.headers.set(
      "Content-Type",
      file.content_type ?? fileBuffer.headers["content-type"]
    );
    c.res.headers.set(
      "Content-Length",
      file.size ? file.size.toString() : fileBuffer.headers["content-length"]
    );
    c.res.headers.set(
      "Content-Disposition",
      `attachment; filename="${file.name}"`
    );

    return new Response(fileBuffer.data, {
      status: 200,
      headers: c.res.headers,
    });
  }
  c.res.headers.set(
    "Content-Type",
    file.content_type ?? fileBuffer.headers["content-type"]
  );
  c.res.headers.set(
    "Content-Length",
    file.size ? file.size.toString() : fileBuffer.headers["content-length"]
  );
  c.res.headers.set("Content-Disposition", `inline; filename="${file.name}"`);

  return new Response(fileBuffer.data, {
    status: 200,
    headers: c.res.headers,
  });
});

export default {
  path,
  handler: app,
};

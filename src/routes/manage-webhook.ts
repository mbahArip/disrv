import axios from "axios";
import { Hono } from "hono";
import { authMiddleware } from "..";
import CONF_APP from "../configs/app.config";
import { createRESTUrl } from "../services/discord";

const app = new Hono();
const path = "/manage/webhook";

app.get("/", authMiddleware, async (c) => {
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

  return c.json({
    code: 200,
    message: "Success",
    total: data.length,
    data: data,
  });
});
app.get("/random", authMiddleware, async (c) => {
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

  const random = data[Math.floor(Math.random() * data.length)];

  return c.json({
    code: 200,
    message: "Success",
    total: data.length,
    data: random,
  });
});
app.post("/", authMiddleware, async (c) => {
  const endpoint = createRESTUrl(
    `/channels/${CONF_APP.discord_channel_id}/webhooks`
  );

  const name = CONF_APP.discord_webhook_name.replace(
    ":id",
    Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0")
  );
  const data = await axios
    .post(
      endpoint,
      {
        name,
      },
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    )
    .then((res) => res.data);

  return c.json({
    code: 201,
    message: "Success",
    data,
  });
});

app.post("/bulk", authMiddleware, async (c) => {
  const count = c.req.query("count") ?? 1;
  const numCount = Number(count);
  if (numCount <= 1) {
    throw new Error(
      "Don't use this endpoint for create single webhook. Use /manage/webhook instead"
    );
  }
  let created = 0;
  const data: any[] = [];
  const endpoint = createRESTUrl(
    `/channels/${CONF_APP.discord_channel_id}/webhooks`
  );

  while (created < numCount) {
    const name = CONF_APP.discord_webhook_name.replace(
      ":id",
      Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0")
    );
    const res = await axios
      .post(
        endpoint,
        {
          name,
        },
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      )
      .then((res) => res.data);

    data.push(res);
    created++;
  }

  return c.json({
    code: 201,
    message: "Success",
    data,
  });
});

export default {
  path,
  handler: app,
};

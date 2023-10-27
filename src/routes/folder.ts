import { File } from "@prisma/client";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import prisma from "../client/prisma";
import CONF_APP from "../configs/app.config";

const app = new Hono();
const path = "/folder";

app.get("/", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const itemsPerPage = Number(
    c.req.query("perPage") ?? CONF_APP.items_per_page
  );
  const orderBy = c.req.query("orderBy")
    ? (c.req.query("orderBy") as keyof File)
    : "createdAt";
  const order = c.req.query("order")
    ? (c.req.query("order") as "asc" | "desc")
    : "desc";

  const _folders = prisma.folder.findMany({
    where: {
      pathParent: "/",
    },
    include: {
      _count: {
        select: {
          files: true,
        },
      },
    },
  });
  const _files = prisma.file.findMany({
    where: {
      folderId: null,
    },
    take: itemsPerPage,
    skip: (page - 1) * itemsPerPage,
    orderBy: {
      [orderBy]: order,
    },
    select: {
      id: true,
      name: true,
      folderId: true,
      content_type: true,
      size: true,
      createdAt: true,
      updatedAt: true,
      width: true,
      height: true,
      duration: true,
    },
  });
  const _filesCount = prisma.file.count({
    where: {
      folderId: null,
    },
  });
  const [folders, files, filesCount] = await prisma.$transaction([
    _folders,
    _files,
    _filesCount,
  ]);

  const totalItems = filesCount;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (page > totalPages) {
    throw new Error("Requested page is out of range");
  }

  const mapFiles = files.map((file) => ({
    ...file,
    raw_url: `/file/${file.id}`,
    detail_url: `/file/${file.id}/detail`,
    thumbnail_url:
      file.width || file.duration ? `/file/${file.id}/thumbnail` : undefined,
    download_url: `/file/${file.id}/download`,
  }));

  return c.json({
    code: 200,
    message: "Success",
    path: "/",
    data: {
      folders: folders || [],
      files: mapFiles || [],
    },
    pagination: {
      page,
      totalItems,
      totalPages,
      isPrevPage: page > 1,
      isNextPage: page < totalPages,
    },
  });
});
app.post(
  "/",
  bearerAuth({
    token: process.env.BEARER_AUTH as string,
  }),
  async (c) => {
    const body = await c.req.parseBody({
      all: true,
    });
    console.log(body);
    if (!body["name"]) {
      throw new Error("Name is required");
    }
    const pathParent = (body["pathParent"] as string) || undefined;
    const path = [
      pathParent,
      (body["name"] as string)
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, ""),
    ].join("/");
    const newFolder = await prisma.folder.create({
      data: {
        name: body["name"] as string,
        path: path,
        pathParent: pathParent,
      },
    });

    return c.json({
      code: 200,
      message: "Success",
      path: "/",
      data: newFolder,
    });
  }
);

app.get("/:folder{((?:[^/]*/)*)(.*)}", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const itemsPerPage = Number(
    c.req.query("perPage") ?? CONF_APP.items_per_page
  );
  const orderBy = c.req.query("orderBy")
    ? (c.req.query("orderBy") as keyof File)
    : "createdAt";
  const order = c.req.query("order")
    ? (c.req.query("order") as "asc" | "desc")
    : "desc";

  const path = `/${c.req.param("folder")}`;
  const _currentFolder = prisma.folder.findUniqueOrThrow({
    where: {
      path,
    },
    include: {
      _count: {
        select: {
          files: true,
        },
      },
    },
  });
  const _folders = prisma.folder.findMany({
    where: {
      pathParent: path,
    },
    include: {
      _count: {
        select: {
          files: true,
        },
      },
    },
  });
  const [currentFolder, folders] = await prisma.$transaction([
    _currentFolder,
    _folders,
  ]);

  const totalItems = currentFolder._count.files;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (page > totalPages) {
    throw new Error("Requested page is out of range");
  }

  const files = await prisma.file.findMany({
    where: {
      folderId: currentFolder.id,
    },
    take: itemsPerPage,
    skip: (page - 1) * itemsPerPage,
    orderBy: {
      [orderBy]: order,
    },
    select: {
      id: true,
      name: true,
      folderId: true,
      content_type: true,
      size: true,
      createdAt: true,
      updatedAt: true,
      width: true,
      height: true,
      duration: true,
    },
  });
  const currentFolderData = {
    ...currentFolder,
    files: undefined,
  };

  const mapFiles = files.map((file) => ({
    ...file,
    raw_url: `/file/${file.id}`,
    detail_url: `/file/${file.id}/detail`,
    thumbnail_url:
      file.width || file.duration ? `/file/${file.id}/thumbnail` : undefined,
    download_url: `/file/${file.id}/download`,
  }));

  return c.json({
    code: 200,
    message: "Success",
    path,
    itemsPerPage,
    data: {
      currentFolder: currentFolderData,
      folders: folders || [],
      files: mapFiles || [],
    },
    pagination: {
      page,
      totalItems,
      totalPages,
      isPrevPage: page > 1,
      isNextPage: page < totalPages,
    },
  });
});

export default {
  path,
  handler: app,
};

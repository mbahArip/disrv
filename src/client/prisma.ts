import { PrismaClient } from "@prisma/client";

const prismaGlobal = global as unknown as { prisma?: PrismaClient };

const prisma =
  prismaGlobal.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") prismaGlobal.prisma = prisma;

export default prisma;

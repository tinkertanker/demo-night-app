import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const adminRouter = createTRPCRouter({
  all: protectedProcedure.query(async () => {
    return db.admin.findMany({ orderBy: { createdAt: "asc" } });
  }),
  add: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase();
      return db.admin.upsert({
        where: { email },
        update: {},
        create: { email },
      });
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.$transaction(async (prisma) => {
        const count = await prisma.admin.count();
        if (count <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last admin",
          });
        }
        return prisma.admin.delete({ where: { id: input.id } });
      });
    }),
});

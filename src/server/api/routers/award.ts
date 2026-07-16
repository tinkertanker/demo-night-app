import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const awardRouter = createTRPCRouter({
  getVotes: protectedProcedure
    .input(z.string().nullable())
    .query(async ({ input }) => {
      if (!input) {
        return [];
      }
      return db.vote.findMany({
        where: { awardId: input },
        include: {
          attendee: { select: { name: true, type: true } },
        },
      });
    }),
  upsert: protectedProcedure
    .input(
      z.object({
        originalId: z.string().optional(),
        id: z.string().optional(),
        eventId: z.string(),
        name: z.string(),
        description: z.string().optional().default(""),
        votable: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.originalId) {
        return db.award.update({
          where: { id: input.originalId },
          data: {
            name: input.name,
            description: input.description,
            votable: input.votable,
          },
        });
      } else {
        const index = await db.award.count({
          where: { eventId: input.eventId },
        });
        return db.award.create({
          data: {
            eventId: input.eventId,
            index: index,
            name: input.name,
            description: input.description,
            votable: input.votable,
          },
        });
      }
    }),
  updateWinner: protectedProcedure
    .input(z.object({ id: z.string(), winnerId: z.string().nullable() }))
    .mutation(async ({ input }) => {
      return db.award.update({
        where: { id: input.id },
        data: { winnerId: input.winnerId },
      });
    }),
  updateIndex: protectedProcedure
    .input(z.object({ id: z.string(), index: z.number() }))
    .mutation(async ({ input }) => {
      return db.$transaction(async (prisma) => {
        const awardToUpdate = await prisma.award.findUnique({
          where: { id: input.id },
          select: { index: true, eventId: true },
        });

        if (!awardToUpdate) {
          throw new Error("Award not found");
        }

        if (awardToUpdate.index === input.index || input.index < 0) {
          return;
        }

        const maxIndex =
          (await prisma.award.count({
            where: { eventId: awardToUpdate.eventId },
          })) - 1;

        if (input.index > maxIndex) {
          return;
        }

        if (awardToUpdate.index < input.index) {
          await prisma.award.updateMany({
            where: {
              eventId: awardToUpdate.eventId,
              index: { gte: awardToUpdate.index, lte: input.index },
              NOT: { id: input.id },
            },
            data: {
              index: { decrement: 1 },
            },
          });
        } else {
          await prisma.award.updateMany({
            where: {
              eventId: awardToUpdate.eventId,
              index: { gte: input.index, lte: awardToUpdate.index },
              NOT: { id: input.id },
            },
            data: {
              index: { increment: 1 },
            },
          });
        }

        return prisma.award.update({
          where: { id: input.id },
          data: { index: input.index },
        });
      });
    }),
  setAwards: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        awards: z.array(
          z.object({
            id: z
              .string()
              .optional()
              .transform((id) => {
                const trimmedId = id?.trim();
                return trimmedId === "" ? undefined : trimmedId;
              }),
            name: z.string(),
            description: z.string().optional().default(""),
            votable: z.boolean().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await db.$transaction(
            async (prisma) => {
              const existingAwards = await prisma.award.findMany({
                where: { eventId: input.eventId },
                select: { id: true },
              });

              const existingIds = new Set(existingAwards.map(({ id }) => id));
              const suppliedIds = input.awards.flatMap(({ id }) =>
                id ? [id] : [],
              );

              if (new Set(suppliedIds).size !== suppliedIds.length) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Each award ID can only appear once",
                });
              }

              const unknownId = suppliedIds.find((id) => !existingIds.has(id));
              if (unknownId) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Award ${unknownId} does not belong to this event`,
                });
              }

              const suppliedIdSet = new Set(suppliedIds);
              const idsToDelete = existingAwards
                .map(({ id }) => id)
                .filter((id) => !suppliedIdSet.has(id));

              // Keep retained awards in place so their IDs, winners, and votes survive
              // CSV updates. Only awards actually removed from the list are deleted.
              if (idsToDelete.length > 0) {
                const { count: deletedAwardCount } =
                  await prisma.award.deleteMany({
                    where: {
                      eventId: input.eventId,
                      id: { in: idsToDelete },
                      votes: { none: {} },
                    },
                  });

                if (deletedAwardCount !== idsToDelete.length) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message:
                      "Awards with existing votes cannot be removed by CSV upload. Keep their IDs in the CSV or delete them explicitly.",
                  });
                }
              }

              const savedAwards = [];
              for (const [index, { id, ...award }] of input.awards.entries()) {
                savedAwards.push(
                  id
                    ? await prisma.award.update({
                        where: { id },
                        data: { ...award, index },
                      })
                    : await prisma.award.create({
                        data: { ...award, eventId: input.eventId, index },
                      }),
                );
              }

              return savedAwards;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (error) {
          const isSerializationConflict =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2034";

          if (!isSerializationConflict || attempt === 2) {
            throw error;
          }
        }
      }

      throw new Error("Award update transaction retry limit exceeded");
    }),
  delete: protectedProcedure.input(z.string()).mutation(async ({ input }) => {
    return db.$transaction(async (prisma) => {
      const awardToDelete = await prisma.award.findUnique({
        where: { id: input },
        select: { eventId: true, index: true },
      });

      if (!awardToDelete) {
        throw new Error("Award not found");
      }

      await prisma.award.delete({
        where: { id: input },
      });

      await prisma.award.updateMany({
        where: {
          eventId: awardToDelete.eventId,
          index: { gt: awardToDelete.index },
        },
        data: {
          index: { decrement: 1 },
        },
      });
    });
  }),
});

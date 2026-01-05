/**
 * API: Admin Routes
 * @swagger
 * /api/v1/admin/timestamps/update:
 *   post:
 *     summary: Update telemetry timestamps to be recent
 *     description: |
 *       Updates all telemetry record timestamps to be within the last 60 minutes.
 *       This ensures time-window queries (e.g., "past hour") return results.
 *       
 *       **Note**: This endpoint modifies database records. Use with caution.
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Timestamps updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 recordsUpdated:
 *                   type: number
 *                 newTimeRange:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *             example:
 *               success: true
 *               message: "Updated 7200 records"
 *               recordsUpdated: 7200
 *               newTimeRange:
 *                 start: "2026-01-05T07:21:17.411Z"
 *                 end: "2026-01-05T08:21:17.411Z"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */

import { Router, Request, Response } from "express";
import { prisma } from "../../infrastructure/database/prisma.js";

const router = Router();

router.post("/timestamps/update", async (_req: Request, res: Response) => {
  try {
    // Get all records ordered by current timestamp
    const allRecords = await prisma.telemetryRecord.findMany({
      orderBy: { timestamp: "asc" },
    });

    if (allRecords.length === 0) {
      return res.json({
        success: true,
        message: "No records to update",
        recordsUpdated: 0,
        newTimeRange: null,
      });
    }

    // Calculate time span of original data
    const firstTimestamp = allRecords[0].timestamp;
    const lastTimestamp = allRecords[allRecords.length - 1].timestamp;
    const originalSpan = lastTimestamp.getTime() - firstTimestamp.getTime();

    // Set new time range: from 60 minutes ago to now
    const now = new Date();
    const newEndTime = now;
    const newStartTime = new Date(now.getTime() - 60 * 60 * 1000); // 60 minutes ago

    // Update timestamps proportionally
    let updated = 0;
    const batchSize = 1000;

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);

      await prisma.$transaction(
        batch.map((record, idx) => {
          const globalIdx = i + idx;
          const ratio = globalIdx / (allRecords.length - 1);
          const newTimestamp = new Date(
            newStartTime.getTime() + ratio * originalSpan
          );

          return prisma.telemetryRecord.update({
            where: { id: record.id },
            data: { timestamp: newTimestamp },
          });
        })
      );

      updated += batch.length;
    }

    return res.json({
      success: true,
      message: `Updated ${updated} records`,
      recordsUpdated: updated,
      newTimeRange: {
        start: newStartTime.toISOString(),
        end: newEndTime.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error updating timestamps:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/v1/admin/timestamps/check:
 *   get:
 *     summary: Check current telemetry timestamp status
 *     description: Returns information about the oldest and newest telemetry records
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Timestamp status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 oldestRecord:
 *                   type: string
 *                   format: date-time
 *                 newestRecord:
 *                   type: string
 *                   format: date-time
 *                 currentTime:
 *                   type: string
 *                   format: date-time
 *                 timeDifferenceMinutes:
 *                   type: number
 *                 warning:
 *                   type: string
 *             example:
 *               success: true
 *               oldestRecord: "2026-01-05T07:21:17.411Z"
 *               newestRecord: "2026-01-05T08:21:15.911Z"
 *               currentTime: "2026-01-05T08:21:39.688Z"
 *               timeDifferenceMinutes: 0
 *               warning: null
 */
router.get("/timestamps/check", async (_req: Request, res: Response) => {
  try {
    const oldest = await prisma.telemetryRecord.findFirst({
      orderBy: { timestamp: "asc" },
    });

    const newest = await prisma.telemetryRecord.findFirst({
      orderBy: { timestamp: "desc" },
    });

    if (!oldest || !newest) {
      return res.json({
        success: true,
        message: "No records found",
        oldestRecord: null,
        newestRecord: null,
        currentTime: new Date().toISOString(),
        timeDifferenceMinutes: null,
        warning: null,
      });
    }

    const now = new Date();
    const timeDiff = Math.round(
      (now.getTime() - newest.timestamp.getTime()) / (1000 * 60)
    );

    const warning =
      timeDiff > 60
        ? `Data is ${timeDiff} minutes old. Queries for "past hour" will return 0 records. Consider updating timestamps.`
        : null;

    return res.json({
      success: true,
      oldestRecord: oldest.timestamp.toISOString(),
      newestRecord: newest.timestamp.toISOString(),
      currentTime: now.toISOString(),
      timeDifferenceMinutes: timeDiff,
      warning,
    });
  } catch (error) {
    console.error("Error checking timestamps:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;


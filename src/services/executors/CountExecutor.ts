/**
 * Executor: Count Executor
 * Handles count queries (trip count, event count, etc.)
 * 
 * Examples:
 * - "How many trips did truck X make?"
 * - "How many times did truck X enter path_1?"
 */

import type { IQueryExecutor, QueryResult } from "./IQueryExecutor.js";
import type { ResolvedQuery } from "../../domain/ResolvedQuery.js";
import type { TelemetryRecord } from "../../domain/TelemetryRecord.js";

export class CountExecutor implements IQueryExecutor {
  canHandle(intent: ResolvedQuery["intent"]): boolean {
    return intent === "count";
  }

  execute(resolvedQuery: ResolvedQuery, telemetry: TelemetryRecord[]): QueryResult {
    if (telemetry.length === 0) {
      return {
        value: 0,
        units: "trips",
        metadata: {
          recordCount: 0,
        },
      };
    }

    // Get filters
    const sourcePath = resolvedQuery.filters?.sourcePath;
    const destinationPath = resolvedQuery.filters?.destinationPath;

    // Count trips
    let count: number;
    
    if (sourcePath && destinationPath && sourcePath !== destinationPath) {
      // Count trips from source to destination
      count = this.countTripsBetweenPaths(telemetry, sourcePath, destinationPath);
    } else if (sourcePath) {
      // Count trips on a specific path (entries into path)
      count = this.countTripsOnPath(telemetry, sourcePath);
    } else {
      // Default: count all path entries
      count = this.countAllPathEntries(telemetry);
    }

    return {
      value: count,
      units: "trips",
      metadata: {
        recordCount: telemetry.length,
        timeWindow: resolvedQuery.timeWindow,
      },
    };
  }

  getName(): string {
    return "CountExecutor";
  }

  /**
   * Count trips from one path to another
   */
  private countTripsBetweenPaths(
    telemetry: TelemetryRecord[],
    sourcePath: string,
    destinationPath: string
  ): number {
    let tripCount = 0;
    let wasOnSource = false;

    for (const record of telemetry) {
      const isOnSource = record.haulPathId === sourcePath;
      const isOnDestination = record.haulPathId === destinationPath;

      if (isOnSource) {
        wasOnSource = true;
      } else if (isOnDestination && wasOnSource) {
        tripCount++;
        wasOnSource = false;
      }
    }

    return tripCount;
  }

  /**
   * Count trips on a specific path (entries into path)
   */
  private countTripsOnPath(
    telemetry: TelemetryRecord[],
    pathId: string
  ): number {
    let tripCount = 0;
    let wasOnPath = false;

    for (const record of telemetry) {
      const isOnPath = record.haulPathId === pathId;

      // Count when truck enters the path
      if (isOnPath && !wasOnPath) {
        tripCount++;
      }

      wasOnPath = isOnPath;
    }

    return tripCount;
  }

  /**
   * Count all path entries (any path)
   */
  private countAllPathEntries(telemetry: TelemetryRecord[]): number {
    let tripCount = 0;
    let lastPathId: string | undefined;

    for (const record of telemetry) {
      const currentPathId = record.haulPathId;
      
      // Count when path changes
      if (currentPathId && currentPathId !== lastPathId) {
        tripCount++;
      }
      
      lastPathId = currentPathId;
    }

    return tripCount;
  }
}


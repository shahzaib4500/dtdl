/**
 * Service: Telemetry Service
 * Business logic for telemetry queries and calculations
 */

import type { ITelemetryRepository } from "../infrastructure/repositories/TelemetryRepository.js";
import type {
  TelemetryRecord,
  TelemetryMetrics,
} from "../domain/TelemetryRecord.js";
import { subMinutes } from "date-fns";

export class TelemetryService {
  constructor(private repository: ITelemetryRepository) {}

  /**
   * Get telemetry records for a truck within a time window
   */
  async getTelemetry(
    truckId: string,
    windowMinutes: number
  ): Promise<TelemetryRecord[]> {
    const endTime = new Date();
    const startTime = subMinutes(endTime, windowMinutes);

    return this.repository.findByTruckAndTimeWindow(
      truckId,
      startTime,
      endTime
    );
  }

  /**
   * Get telemetry records for a route/path within a time window
   * Used for route utilization queries
   */
  async getTelemetryByRoute(
    routeId: string,
    windowMinutes: number
  ): Promise<TelemetryRecord[]> {
    const endTime = new Date();
    const startTime = subMinutes(endTime, windowMinutes);

    return this.repository.findByRouteAndTimeWindow(routeId, startTime, endTime);
  }

  /**
   * Alias for getTelemetryByRoute (for route utilization queries)
   */
  async getTelemetryByPath(
    pathId: string,
    windowMinutes: number
  ): Promise<TelemetryRecord[]> {
    return this.getTelemetryByRoute(pathId, windowMinutes);
  }

  /**
   * Calculate average speed from telemetry records
   * Computes speed from speedMph on-the-fly
   */
  calculateAverageSpeed(records: TelemetryRecord[]): number {
    if (records.length === 0) {
      return 0;
    }

    // Convert speedMph to km/h on-the-fly
    const speeds = records
      .map((r) => r.speedMph ? r.speedMph * 1.60934 : 0)
      .filter((s) => s > 0);
    
    if (speeds.length === 0) {
      return 0;
    }

    const sum = speeds.reduce((acc, speed) => acc + speed, 0);
    return sum / speeds.length;
  }

  /**
   * Calculate maximum speed from telemetry records
   * Computes speed from speedMph on-the-fly
   */
  calculateMaxSpeed(records: TelemetryRecord[]): number {
    if (records.length === 0) {
      return 0;
    }

    // Convert speedMph to km/h on-the-fly
    const speeds = records
      .map((r) => r.speedMph ? r.speedMph * 1.60934 : 0)
      .filter((s) => s > 0);
    
    if (speeds.length === 0) {
      return 0;
    }

    return Math.max(...speeds);
  }

  /**
   * Calculate minimum speed from telemetry records
   * Computes speed from speedMph on-the-fly
   */
  calculateMinSpeed(records: TelemetryRecord[]): number {
    if (records.length === 0) {
      return 0;
    }

    // Convert speedMph to km/h on-the-fly
    const speeds = records
      .map((r) => r.speedMph ? r.speedMph * 1.60934 : 0)
      .filter((s) => s > 0);
    
    if (speeds.length === 0) {
      return 0;
    }

    return Math.min(...speeds);
  }

  /**
   * Count trips from one location to another
   * A trip is counted when a truck moves from source route to destination route
   */
  countTrips(
    records: TelemetryRecord[],
    sourceRouteId: string,
    destinationRouteId: string
  ): number {
    if (records.length === 0) {
      return 0;
    }

    let tripCount = 0;
    let wasOnSource = false;

    for (const record of records) {
      // Use haulPathId (original field) instead of routeId (computed field)
      const isOnSource = record.haulPathId === sourceRouteId;
      const isOnDestination = record.haulPathId === destinationRouteId;

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
   * Count trips on a specific path (cycles or entries)
   * A trip is counted when a truck enters the path (transitions from not-on-path to on-path)
   */
  countTripsOnPath(
    records: TelemetryRecord[],
    pathId: string
  ): number {
    if (records.length === 0) {
      return 0;
    }

    let tripCount = 0;
    let wasOnPath = false;

    for (const record of records) {
      const isOnPath = record.haulPathId === pathId;

      // Count when truck enters the path (transitions from not-on-path to on-path)
      if (isOnPath && !wasOnPath) {
        tripCount++;
      }

      wasOnPath = isOnPath;
    }

    return tripCount;
  }

  /**
   * Calculate comprehensive metrics from telemetry records
   */
  calculateMetrics(records: TelemetryRecord[]): TelemetryMetrics {
    return {
      averageSpeed: this.calculateAverageSpeed(records),
      maxSpeed: this.calculateMaxSpeed(records),
      minSpeed: this.calculateMinSpeed(records),
      recordCount: records.length,
    };
  }

  /**
   * Calculate route utilization (percentage of time route is in use)
   */
  calculateRouteUtilization(
    records: TelemetryRecord[],
    timeWindowMinutes: number
  ): number {
    if (records.length === 0) {
      return 0;
    }

    const totalMinutes = timeWindowMinutes;
    const utilizationMinutes = records.length; // Simplified: assume each record = 1 minute

    return (utilizationMinutes / totalMinutes) * 100;
  }
}


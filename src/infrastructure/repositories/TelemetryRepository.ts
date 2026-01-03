/**
 * Infrastructure: Telemetry Repository
 * Data access layer for telemetry records
 */

import { prisma } from "../database/prisma.js";
import type {
  TelemetryRecord,
  TelemetryQuery,
} from "../../domain/TelemetryRecord.js";

export interface ITelemetryRepository {
  findByTruckAndTimeWindow(
    truckId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryRecord[]>;
  findByRouteAndTimeWindow(
    routeId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryRecord[]>;
  findByQuery(query: TelemetryQuery): Promise<TelemetryRecord[]>;
  create(record: Omit<TelemetryRecord, "id">): Promise<TelemetryRecord>;
  createMany(records: Omit<TelemetryRecord, "id">[]): Promise<void>;
}

export class PrismaTelemetryRepository implements ITelemetryRepository {
  async findByTruckAndTimeWindow(
    truckId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryRecord[]> {
    const records = await prisma.telemetryRecord.findMany({
      where: {
        truckId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    return records.map((record: any) => this.mapToDomain(record));
  }

  async findByRouteAndTimeWindow(
    routeId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryRecord[]> {
    // Use haulPathId (original field) instead of routeId (computed field)
    const records = await prisma.telemetryRecord.findMany({
      where: {
        haulPathId: routeId, // Map routeId parameter to haulPathId field
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        timestamp: "asc",
      },
    });

    return records.map((record: any) => this.mapToDomain(record));
  }

  async findByQuery(query: TelemetryQuery): Promise<TelemetryRecord[]> {
    const where: any = {
      timestamp: {
        gte: query.startTime,
        lte: query.endTime,
      },
    };

    if (query.truckId) {
      where.truckId = query.truckId;
    }

    if (query.routeId) {
      // Use haulPathId (original field) instead of routeId (computed field)
      where.haulPathId = query.routeId;
    }

    const records = await prisma.telemetryRecord.findMany({
      where,
      orderBy: {
        timestamp: "asc",
      },
    });

    return records.map((record: any) => this.mapToDomain(record));
  }

  async create(record: Omit<TelemetryRecord, "id">): Promise<TelemetryRecord> {
    const created = await prisma.telemetryRecord.create({
      data: {
        timestamp: record.timestamp,
        truckId: record.truckId,
        // EXACT fields from JSON - no computed fields
        status: record.status,
        payload: record.payload,
        speedMph: record.speedMph,
        posX: record.posX,
        posY: record.posY,
        posZ: record.posZ,
        headingDeg: record.headingDeg,
        haulPhase: record.haulPhase,
        haulPathId: record.haulPathId,
        engineTemp: record.engineTemp,
        fuelLevel: record.fuelLevel,
        fuelConsumptionRate: record.fuelConsumptionRate,
        brakePedalPos: record.brakePedalPos,
        throttlePos: record.throttlePos,
        vibrationLevel: record.vibrationLevel,
        tirePressureFL: record.tirePressureFL,
        tirePressureFR: record.tirePressureFR,
        tirePressureRLO: record.tirePressureRLO,
        tirePressureRLI: record.tirePressureRLI,
        tirePressureRRO: record.tirePressureRRO,
        tirePressureRRI: record.tirePressureRRI,
        rawData: record.rawData as any,
      },
    });

    return this.mapToDomain(created);
  }

  async createMany(records: Omit<TelemetryRecord, "id">[]): Promise<void> {
    await prisma.telemetryRecord.createMany({
      data: records.map((record) => ({
        timestamp: record.timestamp,
        truckId: record.truckId,
        // EXACT fields from JSON - no computed fields
        status: record.status,
        payload: record.payload,
        speedMph: record.speedMph,
        posX: record.posX,
        posY: record.posY,
        posZ: record.posZ,
        headingDeg: record.headingDeg,
        haulPhase: record.haulPhase,
        haulPathId: record.haulPathId,
        engineTemp: record.engineTemp,
        fuelLevel: record.fuelLevel,
        fuelConsumptionRate: record.fuelConsumptionRate,
        brakePedalPos: record.brakePedalPos,
        throttlePos: record.throttlePos,
        vibrationLevel: record.vibrationLevel,
        tirePressureFL: record.tirePressureFL,
        tirePressureFR: record.tirePressureFR,
        tirePressureRLO: record.tirePressureRLO,
        tirePressureRLI: record.tirePressureRLI,
        tirePressureRRO: record.tirePressureRRO,
        tirePressureRRI: record.tirePressureRRI,
        rawData: record.rawData as any,
      })),
    });
  }

  private mapToDomain(record: any): TelemetryRecord {
    return {
      id: record.id,
      timestamp: record.timestamp,
      truckId: record.truckId,
      // EXACT fields from JSON
      status: record.status,
      payload: record.payload,
      speedMph: record.speedMph,
      posX: record.posX,
      posY: record.posY,
      posZ: record.posZ,
      headingDeg: record.headingDeg,
      haulPhase: record.haulPhase,
      haulPathId: record.haulPathId,
      engineTemp: record.engineTemp,
      fuelLevel: record.fuelLevel,
      fuelConsumptionRate: record.fuelConsumptionRate,
      brakePedalPos: record.brakePedalPos,
      throttlePos: record.throttlePos,
      vibrationLevel: record.vibrationLevel,
      tirePressureFL: record.tirePressureFL,
      tirePressureFR: record.tirePressureFR,
      tirePressureRLO: record.tirePressureRLO,
      tirePressureRLI: record.tirePressureRLI,
      tirePressureRRO: record.tirePressureRRO,
      tirePressureRRI: record.tirePressureRRI,
      rawData: record.rawData,
    };
  }
}


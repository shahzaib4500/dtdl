/**
 * Domain: Telemetry Record
 * Represents a single telemetry data point from mine equipment
 * EXACTLY matches the schema from telemetry.json (time -> timestamp conversion only)
 */

export interface TelemetryRecord {
  id: string;
  timestamp: Date; // Converted from "time" field
  truckId: string;
  
  // EXACT fields from telemetry.json - no computed/derived fields
  status?: string;
  payload?: number;
  speedMph?: number;
  posX?: number;
  posY?: number;
  posZ?: number;
  headingDeg?: number;
  haulPhase?: string;
  haulPathId?: string;
  engineTemp?: number;
  fuelLevel?: number;
  fuelConsumptionRate?: number;
  brakePedalPos?: number;
  throttlePos?: number;
  vibrationLevel?: number;
  tirePressureFL?: number;
  tirePressureFR?: number;
  tirePressureRLO?: number;
  tirePressureRLI?: number;
  tirePressureRRO?: number;
  tirePressureRRI?: number;
  
  // Complete original JSON
  rawData?: Record<string, any>;
}

export interface TelemetryQuery {
  truckId?: string;
  routeId?: string;
  startTime: Date;
  endTime: Date;
}

export interface TelemetryMetrics {
  averageSpeed: number;
  maxSpeed: number;
  minSpeed: number;
  recordCount: number;
  tripCount?: number; // If route information available
}


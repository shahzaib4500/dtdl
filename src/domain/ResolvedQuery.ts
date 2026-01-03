/**
 * Domain: Resolved Query
 * Query intent resolved against DTDL/telemetry schema
 */

import type { PropertyInfo } from "./PropertyInfo.js";
import type { Entity } from "./Entity.js";
import type { TimeWindow } from "./QueryIntent.js";

/**
 * Resolved query with schema information
 */
export interface ResolvedQuery {
  intent: "get_property" | "aggregate" | "count" | "current" | "relationship";
  targetEntity: Entity; // Resolved DTDL entity
  property?: PropertyInfo; // Resolved property (if applicable)
  operation?: "average" | "max" | "min" | "sum"; // For aggregate queries
  timeWindow: TimeWindow;
  filters?: {
    sourcePath?: string;
    destinationPath?: string;
    relationshipName?: string;
    relationshipTarget?: string;
  };
  metadata?: {
    recordCount?: number;
    dataSource: "dtdl" | "telemetry" | "both";
  };
}

/**
 * Resolved command with schema information
 */
export interface ResolvedCommand {
  action: "set" | "update" | "change";
  targetEntities: Entity[]; // Resolved DTDL entities
  property: PropertyInfo; // Resolved property from DTDL
  value: any; // New value
  scope: "single" | "bulk";
  filters?: {
    type?: string;
    relationship?: {
      name: string;
      targetId: string;
    };
  };
}


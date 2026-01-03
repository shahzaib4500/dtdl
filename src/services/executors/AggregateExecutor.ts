/**
 * Executor: Aggregate Executor
 * Handles aggregate queries (average, max, min, sum)
 * 
 * Examples:
 * - "What was the average speed?"
 * - "What was the maximum speed?"
 * - "What was the minimum speed?"
 */

import type { IQueryExecutor, QueryResult } from "./IQueryExecutor.js";
import type { ResolvedQuery } from "../../domain/ResolvedQuery.js";
import type { TelemetryRecord } from "../../domain/TelemetryRecord.js";
import { TelemetryService } from "../TelemetryService.js";

export class AggregateExecutor implements IQueryExecutor {
  constructor(private telemetryService?: TelemetryService) {}
  canHandle(intent: ResolvedQuery["intent"]): boolean {
    return intent === "aggregate";
  }

  execute(resolvedQuery: ResolvedQuery, telemetry: TelemetryRecord[]): QueryResult {
    if (!resolvedQuery.operation) {
      throw new Error("Aggregate executor requires an operation (average, max, min, sum)");
    }

    if (telemetry.length === 0) {
      return {
        value: 0,
        units: this.getUnitsForProperty(resolvedQuery.property),
        metadata: {
          recordCount: 0,
        },
      };
    }

    // Special handling for route utilization
    // Route utilization is identified by: operation="average", no property, and has filters.sourcePath
    if (
      resolvedQuery.operation === "average" && 
      !resolvedQuery.property &&
      resolvedQuery.filters?.sourcePath &&
      this.telemetryService &&
      resolvedQuery.timeWindow
    ) {
      // This is a route utilization query
      const utilization = this.telemetryService.calculateRouteUtilization(
        telemetry,
        resolvedQuery.timeWindow.minutes
      );
      return {
        value: utilization,
        units: "%",
        metadata: {
          recordCount: telemetry.length,
          timeWindow: resolvedQuery.timeWindow,
        },
      };
    }

    // Determine which field to aggregate
    const fieldName = this.getAggregateField(resolvedQuery);
    
    // Extract values from telemetry
    const values = this.extractValues(telemetry, fieldName);
    
    if (values.length === 0) {
      return {
        value: 0,
        units: this.getUnitsForProperty(resolvedQuery.property),
        metadata: {
          recordCount: telemetry.length,
        },
      };
    }

    // Perform aggregation
    let result: number;
    switch (resolvedQuery.operation) {
      case "average":
        result = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case "max":
        result = Math.max(...values);
        break;
      case "min":
        result = Math.min(...values);
        break;
      case "sum":
        result = values.reduce((sum, val) => sum + val, 0);
        break;
      default:
        throw new Error(`Unknown aggregate operation: ${resolvedQuery.operation}`);
    }

    return {
      value: result,
      units: this.getUnitsForProperty(resolvedQuery.property),
      metadata: {
        recordCount: telemetry.length,
        timeWindow: resolvedQuery.timeWindow,
      },
    };
  }

  getName(): string {
    return "AggregateExecutor";
  }

  /**
   * Determine which field to aggregate based on query
   */
  private getAggregateField(resolvedQuery: ResolvedQuery): string {
    // If property is specified, use it
    if (resolvedQuery.property && resolvedQuery.property.source === "telemetry") {
      const telemetryProperty = resolvedQuery.property as any;
      return telemetryProperty.telemetryField || telemetryProperty.name;
    }

    // Default to speed for speed-related queries
    // This handles legacy question types like "average_speed"
    return "speedMph";
  }

  /**
   * Extract numeric values from telemetry records
   */
  private extractValues(telemetry: TelemetryRecord[], fieldName: string): number[] {
    const values: number[] = [];

    for (const record of telemetry) {
      const value = (record as any)[fieldName];
      
      if (typeof value === "number" && !isNaN(value)) {
        // Convert speedMph to km/h
        if (fieldName === "speedMph") {
          values.push(value * 1.60934);
        } else {
          values.push(value);
        }
      }
    }

    return values;
  }

  private getUnitsForProperty(property: any): string {
    if (property?.units) {
      return property.units;
    }

    // Default units for common aggregates
    const propertyName = property?.name?.toLowerCase() || "";
    
    if (propertyName.includes("speed")) {
      return "km/h";
    }
    
    if (propertyName.includes("temp") || propertyName.includes("temperature")) {
      return "°F";
    }
    
    if (propertyName.includes("level") || propertyName.includes("fuel")) {
      return "%";
    }

    return "";
  }
}


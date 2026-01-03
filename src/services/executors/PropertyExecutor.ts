/**
 * Executor: Property Executor
 * Handles queries for getting property values (current/latest)
 * 
 * Examples:
 * - "What is the haul path ID?"
 * - "What is the current status?"
 * - "What is the engine temperature?"
 */

import type { IQueryExecutor, QueryResult } from "./IQueryExecutor.js";
import type { ResolvedQuery } from "../../domain/ResolvedQuery.js";
import type { TelemetryRecord } from "../../domain/TelemetryRecord.js";
import type { DTDLPropertyInfo, TelemetryPropertyInfo } from "../../domain/PropertyInfo.js";

export class PropertyExecutor implements IQueryExecutor {
  canHandle(intent: ResolvedQuery["intent"]): boolean {
    return intent === "get_property" || intent === "current";
  }

  execute(resolvedQuery: ResolvedQuery, telemetry: TelemetryRecord[]): QueryResult {
    if (!resolvedQuery.property) {
      throw new Error("Property executor requires a property to be resolved");
    }

    const property = resolvedQuery.property;

    // Check property source and handle accordingly
    // Use type assertion after checking source to help TypeScript
    if (property && "source" in property) {
      if (property.source === "dtdl") {
        // For DTDL properties, get from entity
        const dtdlProperty = property as DTDLPropertyInfo;
        return {
          value: dtdlProperty.value ?? dtdlProperty.initialValue ?? "N/A",
          units: this.getUnitsForProperty(dtdlProperty),
        };
      }

      if (property.source === "telemetry") {
        // For telemetry properties, get from most recent record
        const telemetryProperty = property as TelemetryPropertyInfo;
        
        if (telemetry.length === 0) {
          return {
            value: "N/A",
            units: this.getUnitsForProperty(telemetryProperty),
            metadata: {
              recordCount: 0,
            },
          };
        }

        // Get most recent record
        const sortedTelemetry = [...telemetry].sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        const mostRecent = sortedTelemetry[0];
        const fieldName = telemetryProperty.telemetryField || telemetryProperty.name;

        // Get value from telemetry record
        const value = (mostRecent as any)[fieldName];
        
        // Convert speedMph to km/h if needed
        let finalValue: number | string = value ?? "N/A";
        let units = this.getUnitsForProperty(telemetryProperty);
        if (fieldName === "speedMph" && typeof value === "number") {
          finalValue = value * 1.60934; // Convert to km/h
          units = "km/h"; // Always use km/h for converted speed
        }

        return {
          value: finalValue,
          units,
          metadata: {
            recordCount: telemetry.length,
          },
        };
      }
    }

    throw new Error(`Unknown property source: ${property ? (property as any).source : "undefined"}`);
  }

  getName(): string {
    return "PropertyExecutor";
  }

  private getUnitsForProperty(property: any): string {
    if (property.units) {
      return property.units;
    }

    // Default units based on property type
    const propertyName = property.name?.toLowerCase() || "";
    
    if (propertyName.includes("temp") || propertyName.includes("temperature")) {
      return "°F";
    }
    
    if (propertyName.includes("level") || propertyName.includes("fuel")) {
      return "%";
    }
    
    if (propertyName.includes("heading")) {
      return "degrees";
    }
    
    if (propertyName.includes("payload")) {
      return "tonnes";
    }
    
    if (propertyName.includes("speed") && property.source === "telemetry") {
      return "km/h"; // Converted from mph
    }

    return "";
  }
}


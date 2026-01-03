/**
 * Service: Property Resolver
 * Resolves property names from natural language to DTDL/telemetry schema
 * 
 * This service implements Requirement B: "using only the DTDL model" for property identification
 * 
 * Architecture:
 * - Uses DTDL contents array as source of truth
 * - Supports fuzzy matching for natural language variations
 * - Returns property metadata for validation and formatting
 */

import type { Entity } from "../domain/Entity.js";
import type { PropertyInfo, DTDLPropertyInfo, TelemetryPropertyInfo, PropertyResolutionResult } from "../domain/PropertyInfo.js";

/**
 * Known telemetry fields and their metadata
 * This could be extended to read from a telemetry schema definition
 */
const TELEMETRY_FIELDS: Record<string, { type: "number" | "string" | "boolean"; units?: string }> = {
  // Status and identification
  status: { type: "string" },
  truckId: { type: "string" },
  haulPathId: { type: "string" },
  haulPhase: { type: "string" },
  
  // Position and movement
  speedMph: { type: "number", units: "mph" },
  posX: { type: "number" },
  posY: { type: "number" },
  posZ: { type: "number" },
  headingDeg: { type: "number", units: "degrees" },
  
  // Equipment state
  payload: { type: "number", units: "tonnes" },
  engineTemp: { type: "number", units: "°F" },
  fuelLevel: { type: "number", units: "%" },
  fuelConsumptionRate: { type: "number" },
  brakePedalPos: { type: "number", units: "%" },
  throttlePos: { type: "number", units: "%" },
  vibrationLevel: { type: "number" },
  
  // Tire pressures
  tirePressureFL: { type: "number", units: "psi" },
  tirePressureFR: { type: "number", units: "psi" },
  tirePressureRLO: { type: "number", units: "psi" },
  tirePressureRLI: { type: "number", units: "psi" },
  tirePressureRRO: { type: "number", units: "psi" },
  tirePressureRRI: { type: "number", units: "psi" },
};

/**
 * Common property name variations for fuzzy matching
 */
const PROPERTY_NAME_VARIATIONS: Record<string, string[]> = {
  // Path/Route variations
  haulPathId: ["haul path id", "haul path", "path id", "pathid", "route id", "routeid", "current path"],
  haulPhase: ["haul phase", "phase", "current phase"],
  
  // Speed variations
  speedMph: ["speed", "current speed", "speed mph", "velocity"],
  maxSpeedKph: ["speed limit", "max speed", "maximum speed", "maxspeed"],
  
  // Status variations
  status: ["status", "current status", "state", "equipment status"],
  
  // Temperature variations
  engineTemp: ["engine temperature", "engine temp", "temperature", "enginetemp"],
  
  // Fuel variations
  fuelLevel: ["fuel level", "fuel", "fuellevel", "fuel percentage"],
  fuelConsumptionRate: ["fuel consumption", "fuel consumption rate", "fuel rate"],
  
  // Position variations
  posX: ["position x", "x position", "x coordinate", "pos x"],
  posY: ["position y", "y position", "y coordinate", "pos y"],
  posZ: ["position z", "z position", "z coordinate", "pos z", "altitude"],
  headingDeg: ["heading", "direction", "heading degrees", "headingdeg"],
  
  // Payload variations
  payload: ["payload", "load", "weight", "tonnage"],
  
  // DTDL property variations
  focusSnapDistanceMeters: ["focus snap distance", "snap distance", "focus distance", "focussnapdistancemeters"],
  builderCategory: ["builder category", "category", "buildercategory"],
  builderIsPhysical: ["builder is physical", "is physical", "physical", "builderisphysical"],
};

export class PropertyResolver {
  /**
   * Resolve a property name from natural language to DTDL or telemetry property
   * 
   * @param entity - The DTDL entity to search in
   * @param naturalLanguageName - Natural language property name (e.g., "haul path ID")
   * @returns Property resolution result with property info or error
   */
  resolveProperty(
    entity: Entity,
    naturalLanguageName: string
  ): PropertyResolutionResult {
    const normalized = this.normalizePropertyName(naturalLanguageName);
    
    // First, try to find in DTDL properties
    const dtdlResult = this.findPropertyInDTDL(entity, normalized);
    if (dtdlResult.success && dtdlResult.property) {
      return dtdlResult;
    }
    
    // If not found in DTDL, try telemetry fields
    const telemetryResult = this.findPropertyInTelemetry(normalized);
    if (telemetryResult.success && telemetryResult.property) {
      return telemetryResult;
    }
    
    // If still not found, provide suggestions
    const suggestions = this.getSuggestions(entity, normalized);
    
    return {
      success: false,
      error: `Property '${naturalLanguageName}' not found in DTDL model or telemetry schema`,
      suggestions,
    };
  }

  /**
   * Find property in DTDL contents array
   * Uses the actual DTDL schema as source of truth (Requirement B)
   */
  private findPropertyInDTDL(
    entity: Entity,
    normalizedName: string
  ): PropertyResolutionResult {
    if (!entity.contents || !Array.isArray(entity.contents)) {
      return {
        success: false,
        error: "Entity has no contents array",
      };
    }

    // Search through DTDL contents for Property objects
    for (const content of entity.contents) {
      if (content["@type"] === "Property") {
        const propName = content.name;
        
        // Exact match
        if (this.normalizePropertyName(propName) === normalizedName) {
          return {
            success: true,
            property: this.createDTDLPropertyInfo(content),
          };
        }
        
        // Fuzzy match using variations
        const variations = PROPERTY_NAME_VARIATIONS[propName] || [];
        if (variations.some(v => this.normalizePropertyName(v) === normalizedName)) {
          return {
            success: true,
            property: this.createDTDLPropertyInfo(content),
          };
        }
        
        // Partial match
        if (
          propName.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(propName.toLowerCase())
        ) {
          return {
            success: true,
            property: this.createDTDLPropertyInfo(content),
          };
        }
      }
    }

    return {
      success: false,
      error: "Property not found in DTDL contents",
    };
  }

  /**
   * Find property in telemetry schema
   */
  private findPropertyInTelemetry(
    normalizedName: string
  ): PropertyResolutionResult {
    // Check exact match
    if (TELEMETRY_FIELDS[normalizedName]) {
      const field = TELEMETRY_FIELDS[normalizedName];
      return {
        success: true,
        property: {
          name: normalizedName,
          type: field.type,
          units: field.units,
          source: "telemetry",
          telemetryField: normalizedName,
        } as TelemetryPropertyInfo,
      };
    }

    // Check variations
    for (const [fieldName, variations] of Object.entries(PROPERTY_NAME_VARIATIONS)) {
      if (variations.some(v => this.normalizePropertyName(v) === normalizedName)) {
        const field = TELEMETRY_FIELDS[fieldName];
        if (field) {
          return {
            success: true,
            property: {
              name: fieldName,
              type: field.type,
              units: field.units,
              source: "telemetry",
              telemetryField: fieldName,
            } as TelemetryPropertyInfo,
          };
        }
      }
    }

    // Check partial match
    for (const [fieldName, field] of Object.entries(TELEMETRY_FIELDS)) {
      if (
        fieldName.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(fieldName.toLowerCase())
      ) {
        return {
          success: true,
          property: {
            name: fieldName,
            type: field.type,
            units: field.units,
            source: "telemetry",
            telemetryField: fieldName,
          } as TelemetryPropertyInfo,
        };
      }
    }

    return {
      success: false,
      error: "Property not found in telemetry schema",
    };
  }

  /**
   * Create DTDL property info from DTDL Property object
   */
  private createDTDLPropertyInfo(dtdlProperty: any): DTDLPropertyInfo {
    const schema = dtdlProperty.schema;
    let propType: "number" | "string" | "boolean" | "object" | "array" = "string";
    
    if (typeof schema === "string") {
      if (schema === "double" || schema === "float" || schema === "int") {
        propType = "number";
      } else if (schema === "boolean") {
        propType = "boolean";
      } else if (schema === "Array") {
        propType = "array";
      } else if (schema === "Object") {
        propType = "object";
      }
    } else if (schema && typeof schema === "object") {
      if (schema["@type"] === "Object") {
        propType = "object";
      } else if (schema["@type"] === "Array") {
        propType = "array";
      }
    }

    return {
      name: dtdlProperty.name,
      displayName: dtdlProperty.displayName,
      type: propType,
      schema: schema,
      value: dtdlProperty.value !== undefined ? dtdlProperty.value : dtdlProperty.initialValue,
      initialValue: dtdlProperty.initialValue,
      writable: dtdlProperty.writable !== false,
      source: "dtdl",
      dtdlProperty: dtdlProperty,
    };
  }

  /**
   * Normalize property name for matching
   */
  private normalizePropertyName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[_\s-]+/g, "") // Remove underscores, spaces, hyphens
      .replace(/\s+/g, ""); // Remove all spaces
  }

  /**
   * Get suggestions for similar property names
   */
  private getSuggestions(entity: Entity, normalizedName: string): string[] {
    const suggestions: string[] = [];

    // Get all DTDL property names
    if (entity.contents && Array.isArray(entity.contents)) {
      for (const content of entity.contents) {
        if (content["@type"] === "Property") {
          suggestions.push(content.name);
        }
      }
    }

    // Get all telemetry field names
    suggestions.push(...Object.keys(TELEMETRY_FIELDS));

    // Filter by similarity
    return suggestions.filter(suggestion => {
      const normalized = this.normalizePropertyName(suggestion);
      return (
        normalized.includes(normalizedName) ||
        normalizedName.includes(normalized) ||
        this.levenshteinDistance(normalized, normalizedName) <= 3
      );
    }).slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Get all available properties for an entity
   * Useful for validation and suggestions
   */
  getAllProperties(entity: Entity): PropertyInfo[] {
    const properties: PropertyInfo[] = [];

    // Get DTDL properties
    if (entity.contents && Array.isArray(entity.contents)) {
      for (const content of entity.contents) {
        if (content["@type"] === "Property") {
          properties.push(this.createDTDLPropertyInfo(content));
        }
      }
    }

    // Add telemetry properties (they're available for all entities)
    for (const [fieldName, field] of Object.entries(TELEMETRY_FIELDS)) {
      properties.push({
        name: fieldName,
        type: field.type,
        units: field.units,
        source: "telemetry",
        telemetryField: fieldName,
      } as TelemetryPropertyInfo);
    }

    return properties;
  }
}


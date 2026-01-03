/**
 * Service: Schema Resolver
 * Orchestrates resolution of query/command intents against DTDL and telemetry schemas
 * 
 * This service implements Requirement D: Clear separation of concerns
 * - Separates intent extraction (LLM) from schema resolution
 * - Uses DTDL model as source of truth (Requirement B)
 * 
 * Architecture:
 * - Takes raw intent from LLM
 * - Resolves entities against DTDL model
 * - Resolves properties against DTDL/telemetry schemas
 * - Returns resolved query with schema metadata
 */

import type { DTDLModel } from "../domain/DTDLModel.js";
import type { EntityResolver } from "../infrastructure/resolvers/EntityResolver.js";
import type { PropertyResolver } from "./PropertyResolver.js";
import type { QueryIntent } from "../domain/QueryIntent.js";
import type { CommandIntent } from "../domain/CommandIntent.js";
import type { TelemetryPropertyInfo } from "../domain/PropertyInfo.js";
import type { ResolvedQuery, ResolvedCommand } from "../domain/ResolvedQuery.js";
import { DomainError } from "../domain/errors.js";
import { PropertyInfo } from "@/domain/PropertyInfo.js";

export class SchemaResolver {
  constructor(
    private entityResolver: EntityResolver,
    private propertyResolver: PropertyResolver,
    private dtdlModel: DTDLModel
  ) {}

  /**
   * Resolve a query intent against the schema
   * 
   * @param intent - Raw query intent from LLM
   * @returns Resolved query with schema information
   * @throws DomainError if entity or property cannot be resolved
   */
  resolveQuery(intent: QueryIntent): ResolvedQuery {
    // 1. Resolve entity (optional for route_utilization queries)
    let entity: any = null;
    
    // For route_utilization, entity is optional if sourcePath is provided
    if (intent.questionType === "route_utilization" && intent.targetEntity === "ALL") {
      // Route utilization can work without a specific entity
      // We'll query by path ID instead
      entity = {
        id: "ALL",
        displayName: "All entities",
      };
    } else {
      entity = this.entityResolver.resolve(intent.targetEntity, this.dtdlModel);
      if (!entity) {
        throw new DomainError(
          `Entity '${intent.targetEntity}' not found in DTDL model`,
          "ENTITY_NOT_FOUND"
        );
      }
    }

    // 2. Map question type to generic intent
    const genericIntent = this.mapQuestionTypeToIntent(intent.questionType);

    // 3. Resolve property if needed
    let property: PropertyInfo | undefined;
    let dataSource: "dtdl" | "telemetry" | "both" = "telemetry";

    // For current_speed queries, automatically resolve "speed" property from telemetry
    if (intent.questionType === "current_speed" && !intent.propertyName) {
      // Automatically resolve speed property for current_speed queries
      // PropertyResolver maps "speed" to "speedMph" via variations
      const propertyResult = this.propertyResolver.resolveProperty(
        entity,
        "speed"
      );

      if (propertyResult.success && propertyResult.property) {
        property = propertyResult.property;
        dataSource = "telemetry";
      } else {
        // Fallback: create a default telemetry property for speed
        property = {
          name: "speedMph",
          displayName: "Speed",
          type: "number",
          source: "telemetry",
          telemetryField: "speedMph",
          units: "km/h",
        } as TelemetryPropertyInfo;
        dataSource = "telemetry";
      }
    } else if (intent.propertyName) {
      const propertyResult = this.propertyResolver.resolveProperty(
        entity,
        intent.propertyName
      );

      if (!propertyResult.success || !propertyResult.property) {
        const errorMsg = propertyResult.error || "Property not found";
        const suggestions = propertyResult.suggestions
          ? ` Available properties: ${propertyResult.suggestions.join(", ")}`
          : "";
        throw new DomainError(
          `${errorMsg}.${suggestions}`,
          "PROPERTY_NOT_FOUND"
        );
      }

      property = propertyResult.property;
      // Type guard for property source
      if (property && "source" in property) {
        dataSource = property.source === "dtdl" ? "dtdl" : "telemetry";
      } else {
        dataSource = "telemetry"; // Default
      }
    }

    // 4. Extract operation for aggregate queries
    let operation: "average" | "max" | "min" | "sum" | undefined;
    if (intent.questionType === "average_speed") {
      operation = "average";
    } else if (intent.questionType === "max_speed") {
      operation = "max";
    } else if (intent.questionType === "min_speed") {
      operation = "min";
    } else if (intent.questionType === "route_utilization") {
      operation = "average"; // Route utilization is an average calculation
    }

    // 5. Build resolved query
    // For route_utilization, extract path from sourcePath or targetEntity
    let sourcePath = intent.sourcePath;
    if (intent.questionType === "route_utilization" && !sourcePath) {
      // If path is mentioned in targetEntity (e.g., "path_1"), extract it
      if (intent.targetEntity.toLowerCase().includes("path_") || 
          intent.targetEntity.toLowerCase().includes("route_")) {
        sourcePath = intent.targetEntity;
      }
    }

    const resolvedQuery: ResolvedQuery = {
      intent: genericIntent,
      targetEntity: entity,
      property,
      operation,
      timeWindow: intent.timeWindow,
      filters: {
        sourcePath: sourcePath,
        destinationPath: intent.destinationPath,
      },
      metadata: {
        dataSource,
      },
    };

    return resolvedQuery;
  }

  /**
   * Resolve a command intent against the schema
   * 
   * @param intent - Raw command intent from LLM
   * @returns Resolved command with schema information
   * @throws DomainError if entity or property cannot be resolved
   */
  resolveCommand(intent: CommandIntent): ResolvedCommand {
    // 1. Resolve entities (single or bulk)
    const entities = this.entityResolver.resolveBulk(
      intent.targetEntity,
      this.dtdlModel,
      intent.filter
    );

    if (entities.length === 0) {
      throw new DomainError(
        `No entities found matching '${intent.targetEntity}'`,
        "ENTITY_NOT_FOUND"
      );
    }

    // 2. Resolve property from DTDL (commands only work on DTDL properties)
    // Use first entity to resolve property
    const propertyResult = this.propertyResolver.resolveProperty(
      entities[0],
      intent.property
    );

    if (!propertyResult.success || !propertyResult.property) {
      const errorMsg = propertyResult.error || "Property not found";
      const suggestions = propertyResult.suggestions
        ? ` Available properties: ${propertyResult.suggestions.join(", ")}`
        : "";
      throw new DomainError(
        `${errorMsg}.${suggestions}`,
        "PROPERTY_NOT_FOUND"
      );
    }

    // 3. Validate property is from DTDL (not telemetry)
    if (propertyResult.property.source !== "dtdl") {
      throw new DomainError(
        `Property '${intent.property}' is a telemetry field and cannot be modified. Only DTDL properties can be updated.`,
        "PROPERTY_NOT_EDITABLE"
      );
    }

    // 4. Build resolved command
    const resolvedCommand: ResolvedCommand = {
      action: intent.action,
      targetEntities: entities,
      property: propertyResult.property,
      value: intent.value,
      scope: intent.scope || (entities.length > 1 ? "bulk" : "single"),
      filters: intent.filter,
    };

    return resolvedCommand;
  }

  /**
   * Map specific question types to generic intent types
   * This allows the system to be extensible without hardcoding
   */
  private mapQuestionTypeToIntent(
    questionType: QueryIntent["questionType"]
  ): ResolvedQuery["intent"] {
    switch (questionType) {
      case "average_speed":
      case "max_speed":
      case "min_speed":
        return "aggregate";
      
      case "current_speed":
      case "property":
        return "get_property";
      
      case "trip_count":
        return "count";
      
      case "route_utilization":
        return "aggregate";
      
      default:
        // Default to get_property for unknown types
        return "get_property";
    }
  }

  /**
   * Get all available properties for an entity
   * Useful for validation, suggestions, and documentation
   */
  getAvailableProperties(entityId: string): PropertyInfo[] {
    const entity = this.dtdlModel.getEntity(entityId);
    if (!entity) {
      return [];
    }

    return this.propertyResolver.getAllProperties(entity);
  }
}


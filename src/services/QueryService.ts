/**
 * Service: Query Service
 * Orchestrates query execution flow using schema-driven, tool-based architecture
 * 
 * Architecture:
 * 1. Intent Extraction (LLM) - Extract user intent
 * 2. Schema Resolution - Resolve against DTDL/telemetry schema
 * 3. Query Execution - Use pluggable executors (tool-based)
 * 4. Response Formatting - Format using schema metadata
 * 
 * This implements:
 * - Requirement B: Uses DTDL model for property resolution
 * - Requirement D: Clear separation of concerns
 * - Stretch #2: Tool-based architecture
 */

import type { LangChainService } from "../infrastructure/langchain/LangChainService.js";
import type { TelemetryService } from "./TelemetryService.js";
import type { QueryIntent, QueryResponse } from "../domain/QueryIntent.js";
import type { SchemaResolver } from "./SchemaResolver.js";
import type { QueryExecutorRegistry } from "./executors/QueryExecutorRegistry.js";
import type { TelemetryRecord } from "../domain/TelemetryRecord.js";
import { subMinutes } from "date-fns";

export class QueryService {
  constructor(
    private langChainService: LangChainService,
    private schemaResolver: SchemaResolver,
    private telemetryService: TelemetryService,
    private executorRegistry: QueryExecutorRegistry
  ) {}

  /**
   * Execute a natural language query
   * 
   * Flow:
   * 1. Extract intent from natural language (LLM)
   * 2. Resolve intent against schema (SchemaResolver)
   * 3. Get telemetry data
   * 4. Execute query using appropriate executor (tool-based)
   * 5. Format response using schema metadata
   */
  async executeQuery(userInput: string): Promise<QueryResponse> {
    try {
      // 1. Parse natural language to QueryIntent (LLM)
      const intent = await this.langChainService.parseQuery(userInput);

      // 2. Resolve intent against schema (SchemaResolver)
      // This uses DTDL model to resolve entities and properties (Requirement B)
      const resolvedQuery = this.schemaResolver.resolveQuery(intent);

      // 3. Calculate time window
      // For "current" queries, use a minimum of 30 minutes to ensure we capture recent data
      // (even if LLM suggests 1 minute, the data might be slightly older)
      let effectiveTimeWindow = intent.timeWindow;
      if (intent.questionType === "current_speed" || intent.questionType === "property") {
        effectiveTimeWindow = {
          ...intent.timeWindow,
          minutes: Math.max(intent.timeWindow.minutes, 30), // Minimum 30 minutes for current queries
        };
      }
      const timeWindow = this.calculateTimeWindow(effectiveTimeWindow);
      
      // Update resolvedQuery with the effective time window for response
      resolvedQuery.timeWindow = effectiveTimeWindow;

      // 4. Query telemetry data
      // For route_utilization, query by path ID instead of entity ID
      let telemetry: TelemetryRecord[];
      if (intent.questionType === "route_utilization" && resolvedQuery.filters?.sourcePath) {
        telemetry = await this.telemetryService.getTelemetryByPath(
          resolvedQuery.filters.sourcePath,
          timeWindow.minutes
        );
      } else {
        telemetry = await this.telemetryService.getTelemetry(
          resolvedQuery.targetEntity.id,
          timeWindow.minutes
        );
      }

      // 5. Get executor for this query type (tool-based architecture)
      const executor = this.executorRegistry.getExecutor(resolvedQuery);

      // 6. Execute query using executor
      const result = executor.execute(resolvedQuery, telemetry);

      // 7. Format response using schema metadata
      return this.formatResponse(result, resolvedQuery, telemetry.length);
    } catch (error) {
      // Handle domain errors gracefully
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Query execution failed: ${String(error)}`);
    }
  }

  /**
   * Calculate time window dates
   */
  private calculateTimeWindow(
    timeWindow: QueryIntent["timeWindow"]
  ): { startTime: Date; endTime: Date; minutes: number } {
    const endTime = timeWindow.endTime || new Date();
    const startTime =
      timeWindow.startTime || subMinutes(endTime, timeWindow.minutes);

    return {
      startTime,
      endTime,
      minutes: timeWindow.minutes,
    };
  }


  /**
   * Format response using resolved query and executor result
   */
  private formatResponse(
    result: { value: number | string; units: string; metadata?: any },
    resolvedQuery: any,
    recordCount: number
  ): QueryResponse {
    // Generate natural language answer
    const answer = this.generateAnswer(result, resolvedQuery, recordCount);

    return {
      answer,
      value: result.value,
      units: result.units,
      entityId: resolvedQuery.targetEntity.id,
      entityName: resolvedQuery.targetEntity.id,
      dataUsed: {
        recordCount: result.metadata?.recordCount ?? recordCount,
        timeWindow: resolvedQuery.timeWindow,
      },
    };
  }

  /**
   * Generate natural language answer using resolved query
   */
  private generateAnswer(
    result: { value: number | string; units: string; metadata?: any },
    resolvedQuery: any,
    recordCount: number
  ): string {
    const entityName = resolvedQuery.targetEntity.id.replace(/_/g, " ");
    const timeWindow = `${resolvedQuery.timeWindow.minutes} minute${resolvedQuery.timeWindow.minutes !== 1 ? "s" : ""}`;
    const valueStr = typeof result.value === "number" 
      ? result.value.toFixed(1) 
      : String(result.value);

    // Generate answer based on intent type
    switch (resolvedQuery.intent) {
      case "aggregate":
        const operation = resolvedQuery.operation || "average";
        const operationText = operation === "average" ? "average" 
          : operation === "max" ? "maximum" 
          : operation === "min" ? "minimum" 
          : operation;
        
        if (resolvedQuery.property) {
          const propertyName = resolvedQuery.property.displayName || resolvedQuery.property.name;
          return `${entityName} had a ${operationText} ${propertyName} of ${valueStr} ${result.units} over the past ${timeWindow} (based on ${recordCount} records).`;
        }
        // Fallback for speed queries
        return `${entityName} had a ${operationText} speed of ${valueStr} ${result.units} over the past ${timeWindow} (based on ${recordCount} records).`;

      case "get_property":
      case "current":
        if (recordCount === 0) {
          const propertyName = resolvedQuery.property?.displayName || resolvedQuery.property?.name || "property";
          return `${entityName} has no recent data available for ${propertyName}.`;
        }
        
        const propertyName = resolvedQuery.property?.displayName || resolvedQuery.property?.name || "property";
        // Clean up property name for display (remove "Mph", "Deg", etc. suffixes for better readability)
        let displayPropertyName = propertyName
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str: string) => str.toUpperCase())
          .replace(/\s*Mph\s*/gi, "") // Remove "Mph" suffix
          .replace(/\s*Deg\s*/gi, "") // Remove "Deg" suffix
          .trim();
        
        // For speed queries, use "Speed" or "Current Speed"
        if (propertyName.toLowerCase().includes("speed")) {
          displayPropertyName = "Current Speed";
        }
        
        const unitsStr = result.units ? ` ${result.units}` : "";
        
        return `The ${displayPropertyName} of ${entityName} is ${valueStr}${unitsStr}.`;

      case "count":
        const sourcePath = resolvedQuery.filters?.sourcePath || "path";
        const destinationPath = resolvedQuery.filters?.destinationPath;
        
        if (destinationPath && sourcePath !== destinationPath) {
          return `${entityName} made ${result.value} trip${typeof result.value === "number" && result.value !== 1 ? "s" : ""} from ${sourcePath} to ${destinationPath} over the past ${timeWindow}.`;
        } else {
          return `${entityName} made ${result.value} trip${typeof result.value === "number" && result.value !== 1 ? "s" : ""} on ${sourcePath} over the past ${timeWindow}.`;
        }

      case "relationship":
        // Future: Handle relationship queries
        return `${entityName}: ${valueStr} ${result.units}`;

      default:
        return `${entityName}: ${valueStr} ${result.units}`;
    }
  }
}


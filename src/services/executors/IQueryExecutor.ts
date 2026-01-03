/**
 * Service: Query Executor Interface
 * Defines the contract for query executors (tool-based architecture)
 * 
 * This implements Stretch Requirement #2: Minimal Internal Tool Schema
 * Each executor is a "tool" that can handle specific query types
 */

import type { ResolvedQuery } from "../../domain/ResolvedQuery.js";
import type { TelemetryRecord } from "../../domain/TelemetryRecord.js";

/**
 * Result of query execution
 */
export interface QueryResult {
  value: number | string;
  units: string;
  metadata?: {
    recordCount?: number;
    timeWindow?: {
      minutes: number;
    };
    [key: string]: any;
  };
}

/**
 * Interface for query executors
 * Each executor handles a specific type of query intent
 */
export interface IQueryExecutor {
  /**
   * Check if this executor can handle the given intent
   * 
   * @param intent - The resolved query intent
   * @returns true if this executor can handle the intent
   */
  canHandle(intent: ResolvedQuery["intent"]): boolean;

  /**
   * Execute the query
   * 
   * @param resolvedQuery - The resolved query with schema information
   * @param telemetry - Telemetry records for the query
   * @returns Query result with value, units, and metadata
   * @throws Error if execution fails
   */
  execute(
    resolvedQuery: ResolvedQuery,
    telemetry: TelemetryRecord[]
  ): QueryResult;

  /**
   * Get the name of this executor (for logging/debugging)
   */
  getName(): string;
}


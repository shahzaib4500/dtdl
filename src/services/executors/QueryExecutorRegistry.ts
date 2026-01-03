/**
 * Service: Query Executor Registry
 * Manages and selects query executors (tool-based architecture)
 * 
 * This implements Stretch Requirement #2: Minimal Internal Tool Schema
 * Executors are registered as "tools" that can be dynamically selected
 */

import type { IQueryExecutor } from "./IQueryExecutor.js";
import type { ResolvedQuery } from "../../domain/ResolvedQuery.js";
import { PropertyExecutor } from "./PropertyExecutor.js";
import { AggregateExecutor } from "./AggregateExecutor.js";
import { CountExecutor } from "./CountExecutor.js";
import type { TelemetryService } from "../TelemetryService.js";

export class QueryExecutorRegistry {
  private executors: IQueryExecutor[] = [];

  constructor(telemetryService?: TelemetryService) {
    // Register default executors
    this.register(new PropertyExecutor());
    this.register(new AggregateExecutor(telemetryService));
    this.register(new CountExecutor());
  }

  /**
   * Register a new executor
   * Allows dynamic extension without code changes
   */
  register(executor: IQueryExecutor): void {
    // Check if executor with same name already exists
    const existing = this.executors.find(e => e.getName() === executor.getName());
    if (existing) {
      console.warn(`Executor ${executor.getName()} already registered. Replacing...`);
      this.executors = this.executors.filter(e => e.getName() !== executor.getName());
    }
    
    this.executors.push(executor);
  }

  /**
   * Get executor for a resolved query
   * 
   * @param resolvedQuery - The resolved query
   * @returns The executor that can handle the query
   * @throws Error if no executor can handle the query
   */
  getExecutor(resolvedQuery: ResolvedQuery): IQueryExecutor {
    // Find executor that can handle the intent
    const executor = this.executors.find(e => e.canHandle(resolvedQuery.intent));

    if (!executor) {
      throw new Error(
        `No executor found for intent type: ${resolvedQuery.intent}. ` +
        `Available executors: ${this.executors.map(e => e.getName()).join(", ")}`
      );
    }

    return executor;
  }

  /**
   * Get all registered executors
   */
  getAllExecutors(): IQueryExecutor[] {
    return [...this.executors];
  }

  /**
   * Get executor by name
   */
  getExecutorByName(name: string): IQueryExecutor | undefined {
    return this.executors.find(e => e.getName() === name);
  }
}


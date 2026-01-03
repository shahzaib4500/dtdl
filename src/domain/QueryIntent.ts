/**
 * Domain: Query Intent
 * Structured representation of a user's query intent
 */

export type QuestionType =
  | "average_speed"
  | "current_speed"
  | "trip_count"
  | "route_utilization"
  | "max_speed"
  | "min_speed"
  | "property";

export interface TimeWindow {
  minutes: number;
  startTime?: Date;
  endTime?: Date;
}

export interface QueryIntent {
  type: "query";
  questionType: QuestionType;
  targetEntity: string; // Natural language reference (e.g., "truck 56")
  timeWindow: TimeWindow;
  sourcePath?: string; // Source path/route for trip_count queries (e.g., "path_1", "Route_1")
  destinationPath?: string; // Destination path/route for trip_count queries
  propertyName?: string; // Property name for property queries (e.g., "haulPathId", "status", "engineTemp")
}

export interface QueryResponse {
  answer: string;
  value: number | string; // Can be number or string for property queries
  units: string;
  entityId: string;
  entityName: string;
  dataUsed?: {
    recordCount: number;
    timeWindow: TimeWindow;
  };
}


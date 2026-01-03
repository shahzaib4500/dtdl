/**
 * Domain: Property Information
 * Metadata about properties from DTDL and telemetry schemas
 */

/**
 * Property metadata from DTDL schema
 */
export interface DTDLPropertyInfo {
  name: string; // Canonical property name (e.g., "focusSnapDistanceMeters")
  displayName?: string; // Human-readable name
  type: "number" | "string" | "boolean" | "object" | "array";
  schema: any; // DTDL schema definition
  value?: any; // Current value
  initialValue?: any; // Default value
  writable?: boolean; // Whether property can be written
  source: "dtdl"; // Source of property
  dtdlProperty: any; // Original DTDL Property object
}

/**
 * Property metadata from telemetry schema
 */
export interface TelemetryPropertyInfo {
  name: string; // Canonical field name (e.g., "haulPathId")
  type: "number" | "string" | "boolean" | "object";
  units?: string; // Units if applicable (e.g., "km/h", "°F", "%")
  source: "telemetry"; // Source of property
  telemetryField: string; // Original telemetry field name
}

/**
 * Union type for property information
 */
export type PropertyInfo = DTDLPropertyInfo | TelemetryPropertyInfo;

/**
 * Result of property resolution
 */
export interface PropertyResolutionResult {
  success: boolean;
  property?: PropertyInfo;
  error?: string;
  suggestions?: string[]; // Suggested property names if exact match not found
}


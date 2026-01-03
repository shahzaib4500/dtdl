/**
 * Domain: Entity
 * Core domain model for DTDL entities
 */

export interface PropertyValue {
  value: any;
  type: "number" | "string" | "boolean" | "object";
  editable?: boolean;
  constraints?: PropertyConstraints;
}

export interface PropertyConstraints {
  min?: number;
  max?: number;
  allowedValues?: any[];
  readOnly?: boolean;
}

export interface Entity {
  id: string; // Extracted from @id (entity name after __twin_)
  dtdlId: string; // Full DTMI ID (@id from JSON)
  dtdlContext: string; // @context from JSON
  dtdlType: string; // @type from JSON
  displayName?: string; // displayName from JSON
  extends?: string; // extends from JSON
  contents: any[]; // Complete contents array (Properties, Telemetry, Relationships)
  components?: any[]; // Components array (if present)
  
  // Complete original DTDL interface
  rawDTDL?: any; // Complete original DTDL interface JSON
  
  // Computed/derived fields (not stored in DB, computed on-the-fly)
  type?: string; // Derived from displayName
  properties?: Record<string, PropertyValue>; // Extracted from contents
  relationships?: Record<string, string>; // Extracted from contents
  telemetry?: any[]; // Extracted from contents
}

export interface UpdateResult {
  success: boolean;
  entityId: string;
  property: string;
  oldValue: any;
  newValue: any;
  error?: string;
}


/**
 * Domain: Command Intent
 * Structured representation of a user's command intent
 */

export type Action = "set" | "update" | "change";

export type Scope = "single" | "bulk";

export interface BulkUpdateFilter {
  type?: string;
  relationship?: {
    name: string;
    targetId: string;
  };
}

export interface CommandIntent {
  type: "command";
  action: Action;
  targetEntity: string; // Natural language reference
  property: string; // Natural language property name
  value: any;
  scope?: Scope;
  filter?: BulkUpdateFilter;
}

export interface CommandResponse {
  success: boolean;
  updates: UpdateResult[];
  message: string;
  errors?: string[];
}

export interface UpdateResult {
  success: boolean;
  entityId: string;
  property: string;
  oldValue: any;
  newValue: any;
  error?: string;
}


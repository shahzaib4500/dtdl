/**
 * Service: Update Validator
 * Validates property updates against constraints
 */

import type { Entity } from "../domain/Entity.js";
import type { IConstraintRepository } from "../infrastructure/repositories/ConstraintRepository.js";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class UpdateValidator {
  constructor(private constraintRepository: IConstraintRepository) {}

  /**
   * Validate a property update
   */
  async validate(
    entity: Entity,
    property: string,
    newValue: any
  ): Promise<ValidationResult> {
    // 1. Check property exists
    if (!entity.properties || !entity.properties[property]) {
      return {
        valid: false,
        error: `Property '${property}' does not exist on entity '${entity.id}'`,
      };
    }

    // 2. Get constraint for this property
    const entityType = entity.type || "Unknown";
    const constraint = await this.constraintRepository.getConstraint(
      entityType,
      property
    );

    // 3. Check if editable
    const propertyDef = entity.properties[property];
    if (propertyDef.constraints?.readOnly) {
      return {
        valid: false,
        error: `Property '${property}' is read-only`,
      };
    }

    // If constraint exists, check it; otherwise default to editable (unless propertyDef says readOnly)
    if (constraint) {
      // Constraint exists - use its settings
      if (constraint.readOnly || !constraint.editable) {
        return {
          valid: false,
          error: `Property '${property}' is not editable`,
        };
      }
    } else {
      // No constraint exists - default to editable unless propertyDef says otherwise
      if (propertyDef.editable === false) {
        return {
          valid: false,
          error: `Property '${property}' is not editable`,
        };
      }
      // Default to editable if no constraint and propertyDef doesn't explicitly say no
    }

    // 4. Type validation
    const expectedType = propertyDef.type;
    if (expectedType === "number" && typeof newValue !== "number") {
      return {
        valid: false,
        error: `Property '${property}' must be a number, got ${typeof newValue}`,
      };
    }

    if (expectedType === "string" && typeof newValue !== "string") {
      return {
        valid: false,
        error: `Property '${property}' must be a string, got ${typeof newValue}`,
      };
    }

    if (expectedType === "boolean" && typeof newValue !== "boolean") {
      return {
        valid: false,
        error: `Property '${property}' must be a boolean, got ${typeof newValue}`,
      };
    }

    // 5. Value constraints
    if (expectedType === "number") {
      const numValue = newValue as number;

      // Check min value
      const minValue =
        constraint?.minValue ?? propertyDef.constraints?.min;
      if (minValue !== undefined && numValue < minValue) {
        return {
          valid: false,
          error: `Value ${numValue} is below minimum ${minValue}`,
        };
      }

      // Check max value
      const maxValue =
        constraint?.maxValue ?? propertyDef.constraints?.max;
      if (maxValue !== undefined && numValue > maxValue) {
        return {
          valid: false,
          error: `Value ${numValue} is above maximum ${maxValue}`,
        };
      }
    }

    // 6. Allowed values check
    const allowedValues =
      constraint?.allowedValues ?? propertyDef.constraints?.allowedValues;
    if (allowedValues && !allowedValues.includes(newValue)) {
      return {
        valid: false,
        error: `Value '${newValue}' is not in allowed values: ${allowedValues.join(", ")}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate multiple updates (for bulk operations)
   */
  async validateBulk(
    entities: Entity[],
    property: string,
    newValue: any
  ): Promise<ValidationResult[]> {
    return Promise.all(
      entities.map((entity) => this.validate(entity, property, newValue))
    );
  }
}


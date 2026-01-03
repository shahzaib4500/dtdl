/**
 * Domain: Custom Error Classes
 * Domain-specific error types
 */

export class DomainError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(entityId: string) {
    super(`Entity '${entityId}' not found`, "ENTITY_NOT_FOUND");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class PropertyNotEditableError extends DomainError {
  constructor(property: string) {
    super(
      `Property '${property}' is not editable`,
      "PROPERTY_NOT_EDITABLE"
    );
  }
}

export class PropertyNotFoundError extends DomainError {
  constructor(property: string, entityId: string) {
    super(
      `Property '${property}' not found on entity '${entityId}'`,
      "PROPERTY_NOT_FOUND"
    );
  }
}

export class InvalidValueError extends DomainError {
  constructor(property: string, value: any, reason: string) {
    super(
      `Invalid value '${value}' for property '${property}': ${reason}`,
      "INVALID_VALUE"
    );
  }
}


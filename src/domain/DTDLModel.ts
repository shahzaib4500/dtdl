/**
 * Domain: DTDL Model
 * Manages the digital twin model structure
 */

import type { Entity, UpdateResult } from "./Entity.js";

export class DTDLModel {
  private entities: Map<string, Entity>;

  constructor(entities: Entity[] = []) {
    this.entities = new Map(entities.map((e) => [e.id, e]));
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  /**
   * Get all entities of a specific type
   */
  getEntitiesByType(type: string): Entity[] {
    return Array.from(this.entities.values()).filter((e) => e.type === type);
  }

  /**
   * Get entities related to a given entity
   */
  getRelatedEntities(
    entityId: string,
    relationshipName?: string
  ): Entity[] {
    const entity = this.getEntity(entityId);
    if (!entity || !entity.relationships) {
      return [];
    }

    const relatedIds = relationshipName
      ? [entity.relationships[relationshipName]].filter(Boolean)
      : Object.values(entity.relationships);

    return relatedIds
      .map((id) => this.getEntity(id))
      .filter((e): e is Entity => e !== null);
  }

  /**
   * Update a property on an entity
   * 
   * Updates both:
   * 1. The computed 'properties' object (for in-memory access)
   * 2. The actual DTDL 'contents' array (source of truth, stored in database)
   * 
   * This ensures that:
   * - In-memory access is immediate
   * - Database persistence has the correct data
   * - On server restart, properties are correctly recomputed from contents
   */
  updateEntityProperty(
    entityId: string,
    property: string,
    value: any
  ): UpdateResult {
    const entity = this.getEntity(entityId);
    if (!entity) {
      return {
        success: false,
        entityId,
        property,
        oldValue: undefined,
        newValue: value,
        error: `Entity '${entityId}' not found`,
      };
    }

    if (!entity.properties || !entity.properties[property]) {
      return {
        success: false,
        entityId,
        property,
        oldValue: undefined,
        newValue: value,
        error: `Property '${property}' does not exist on entity '${entityId}'`,
      };
    }

    const oldValue = entity.properties[property].value;
    
    // 1. Update the computed properties object (for in-memory access)
    entity.properties[property].value = value;
    
    // 2. Update the actual DTDL contents array (source of truth, stored in database)
    // This is critical: the database stores 'contents', not 'properties'
    if (entity.contents && Array.isArray(entity.contents)) {
      const propertyContent = entity.contents.find(
        (c: any) => c["@type"] === "Property" && c.name === property
      );
      
      if (propertyContent) {
        // Update the value in the DTDL Property object
        propertyContent.value = value;
        // Note: We do NOT update 'initialValue' - that's the default value
        // and should remain unchanged
      } else {
        // This shouldn't happen if properties are correctly extracted from contents
        // But log a warning for debugging
        console.warn(
          `Property '${property}' found in computed properties but not in contents array for entity '${entityId}'`
        );
      }
    }

    return {
      success: true,
      entityId,
      property,
      oldValue,
      newValue: value,
    };
  }

  /**
   * Add or update an entity
   */
  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  /**
   * Get all entities
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Convert to JSON (for persistence or API responses)
   */
  toJSON(): Entity[] {
    return this.getAllEntities();
  }

  /**
   * Load from JSON
   */
  static fromJSON(entities: Entity[]): DTDLModel {
    return new DTDLModel(entities);
  }
}


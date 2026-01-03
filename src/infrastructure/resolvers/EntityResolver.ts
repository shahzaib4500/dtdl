/**
 * Infrastructure: Entity Resolver
 * Resolves natural language entity references to DTDL entity IDs
 */

import type { Entity } from "../../domain/Entity.js";
import type { DTDLModel } from "../../domain/DTDLModel.js";
import { EntityNotFoundError } from "../../domain/errors.js";

export class EntityResolver {
  /**
   * Resolve natural language entity reference to Entity
   * Handles variations like "truck 56", "Truck 56", "truck_56", "Truck_56"
   */
  resolve(reference: string, model: DTDLModel): Entity {
    // Normalize reference: lowercase, remove spaces, handle underscores
    const normalized = reference
      .toLowerCase()
      .replace(/\s+/g, "_")
      .trim();

    const allEntities = model.getAllEntities();

    // Try exact match first (case-sensitive)
    let entity = model.getEntity(reference);
    if (entity) {
      return entity;
    }

    // Try exact match with normalized (lowercase)
    entity = model.getEntity(normalized);
    if (entity) {
      return entity;
    }

    // Try case-insensitive match
    entity = allEntities.find(
      (e) => e.id.toLowerCase() === normalized
    ) || null;

    if (entity) {
      return entity;
    }

    // Try partial match (e.g., "truck 56" matches "Truck_56", "haul truck cat 777 2" matches "Haul_Truck_CAT_777_2")
    const parts = normalized.split(/[_\s]+/).filter(p => p.length > 0);
    if (parts.length > 0) {
      entity =
        allEntities.find((e) => {
          const entityIdLower = e.id.toLowerCase();
          // All parts must be present in entity ID
          return parts.every((part) => entityIdLower.includes(part));
        }) || null;

      if (entity) {
        return entity;
      }
    }

    // Try matching by type and identifier (e.g., "truck 777 2" -> find truck with "777" and "2" in ID)
    // Handles patterns like "truck 777 2", "haul truck 777", "loader cat 994"
    const typeMatch = normalized.match(/^(haul\s*)?(truck|loader|route|stockpile|mill|layout)\s*(cat\s*)?(\d+|[a-z]+)(\s*(\d+))?$/i);
    if (typeMatch) {
      const [, , type, , identifier, , subIdentifier] = typeMatch;
      const typeName = type === "truck" ? "HaulTruck" 
                     : type === "loader" ? "Loader"
                     : type === "route" ? "HaulRoute"
                     : type === "stockpile" ? "Stockpile"
                     : type === "mill" ? "Mill"
                     : type === "layout" ? "MineLayout"
                     : type.charAt(0).toUpperCase() + type.slice(1);
      
      const typeEntities = model.getEntitiesByType(typeName);
      
      // Try to find entity with identifier and optionally subIdentifier
      if (subIdentifier) {
        entity = typeEntities.find((e) => {
          const idLower = e.id.toLowerCase();
          return idLower.includes(identifier.toLowerCase()) && 
                 idLower.includes(subIdentifier.toLowerCase());
        }) || null;
      } else {
        entity = typeEntities.find((e) =>
          e.id.toLowerCase().includes(identifier.toLowerCase())
        ) || null;
      }

      if (entity) {
        return entity;
      }
    }

    // Try fuzzy match: find entity where reference contains key parts of entity ID
    // e.g., "777 2" should match "Haul_Truck_CAT_777_2"
    const keyParts = normalized.split(/[_\s]+/).filter(p => p.length > 1 && !isNaN(Number(p)) || p.match(/[a-z]{2,}/i));
    if (keyParts.length > 0) {
      entity = allEntities.find((e) => {
        const entityIdLower = e.id.toLowerCase();
        // At least 2 key parts should match
        const matches = keyParts.filter(part => entityIdLower.includes(part)).length;
        return matches >= Math.min(2, keyParts.length);
      }) || null;

      if (entity) {
        return entity;
      }
    }

    throw new EntityNotFoundError(reference);
  }

  /**
   * Resolve multiple entities (for bulk operations)
   */
  resolveBulk(
    reference: string,
    model: DTDLModel,
    filter?: {
      type?: string;
      relationship?: {
        name: string;
        targetId: string;
      };
    }
  ): Entity[] {
    // Handle "all" or bulk references
    if (reference.toLowerCase().includes("all")) {
      let entities = model.getAllEntities();

      // Apply type filter
      if (filter?.type) {
        entities = entities.filter((e) => e.type === filter.type);
      }

      // Apply relationship filter
      if (filter?.relationship) {
        entities = entities.filter((e) => {
          if (!e.relationships) return false;
          const relatedId = e.relationships[filter.relationship!.name];
          return relatedId === filter.relationship!.targetId;
        });
      }

      return entities;
    }

    // Single entity resolution
    return [this.resolve(reference, model)];
  }
}


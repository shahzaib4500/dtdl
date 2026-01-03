/**
 * Infrastructure: DTDL Repository
 * Data access layer for DTDL entities
 */

import { prisma } from "../database/prisma.js";
import type { Entity } from "../../domain/Entity.js";

export interface IDTDLRepository {
  findAll(): Promise<Entity[]>;
  findById(id: string): Promise<Entity | null>;
  findByType(type: string): Promise<Entity[]>;
  save(entity: Entity): Promise<void>;
  saveMany(entities: Entity[]): Promise<void>;
}

export class PrismaDTDLRepository implements IDTDLRepository {
  async findAll(): Promise<Entity[]> {
    const entities = await prisma.dTDLEntity.findMany();
    return entities.map((entity: any) => this.mapToDomain(entity));
  }

  async findById(id: string): Promise<Entity | null> {
    const entity = await prisma.dTDLEntity.findUnique({
      where: { id },
    });

    return entity ? this.mapToDomain(entity) : null;
  }

  async findByType(type: string): Promise<Entity[]> {
    // Compute type from displayName on-the-fly
    const allEntities = await this.findAll();
    return allEntities.filter((e) => this.computeType(e) === type);
  }

  async save(entity: Entity): Promise<void> {
    await prisma.dTDLEntity.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        // EXACT fields from JSON - no computed fields
        dtdlId: entity.dtdlId,
        dtdlContext: entity.dtdlContext,
        dtdlType: entity.dtdlType,
        displayName: entity.displayName,
        extends: entity.extends,
        contents: entity.contents as any,
        components: entity.components as any,
        rawDTDL: entity.rawDTDL as any,
      },
      update: {
        // EXACT fields from JSON - no computed fields
        dtdlId: entity.dtdlId,
        dtdlContext: entity.dtdlContext,
        dtdlType: entity.dtdlType,
        displayName: entity.displayName,
        extends: entity.extends,
        contents: entity.contents as any,
        components: entity.components as any,
        rawDTDL: entity.rawDTDL as any,
      },
    });
  }

  async saveMany(entities: Entity[]): Promise<void> {
    await prisma.$transaction(
      entities.map((entity) =>
        prisma.dTDLEntity.upsert({
          where: { id: entity.id },
          create: {
            id: entity.id,
            // EXACT fields from JSON - no computed fields
            dtdlId: entity.dtdlId,
            dtdlContext: entity.dtdlContext,
            dtdlType: entity.dtdlType,
            displayName: entity.displayName,
            extends: entity.extends,
            contents: entity.contents as any,
            components: entity.components as any,
            rawDTDL: entity.rawDTDL as any,
          },
          update: {
            // EXACT fields from JSON - no computed fields
            dtdlId: entity.dtdlId,
            dtdlContext: entity.dtdlContext,
            dtdlType: entity.dtdlType,
            displayName: entity.displayName,
            extends: entity.extends,
            contents: entity.contents as any,
            components: entity.components as any,
            rawDTDL: entity.rawDTDL as any,
          },
        })
      )
    );
  }

  /**
   * Compute type from displayName (for backward compatibility)
   */
  private computeType(entity: Entity): string {
    if (entity.type) return entity.type;
    
    const displayName = entity.displayName || "";
    if (displayName.includes("Haul Truck")) return "HaulTruck";
    if (displayName.includes("Loader")) return "Loader";
    if (displayName.includes("HaulPath") || displayName.includes("Path")) return "HaulRoute";
    if (displayName.includes("Stockpile")) return "Stockpile";
    if (displayName.includes("Mine Layout")) return "MineLayout";
    return displayName.replace(/\s+/g, "") || "Unknown";
  }

  /**
   * Extract properties from contents on-the-fly
   */
  private extractProperties(contents: any[]): Record<string, any> {
    const properties: Record<string, any> = {};
    for (const content of contents || []) {
      if (content["@type"] === "Property") {
        const propName = content.name;
        const propValue = content.value !== undefined ? content.value : content.initialValue;
        const propSchema = content.schema;
        
        let propType = "string";
        if (typeof propSchema === "string") {
          if (propSchema === "double" || propSchema === "float" || propSchema === "int") {
            propType = "number";
          } else if (propSchema === "boolean") {
            propType = "boolean";
          }
        }
        
        properties[propName] = {
          value: propValue !== undefined ? propValue : null,
          type: propType,
          editable: content.writable !== false,
        };
      }
    }
    return properties;
  }

  /**
   * Extract relationships from contents on-the-fly
   */
  private extractRelationships(contents: any[]): Record<string, string> {
    const relationships: Record<string, string> = {};
    for (const content of contents || []) {
      if (content["@type"] === "Relationship") {
        const relName = content.name;
        const relTarget = content.target;
        if (relName && relTarget) {
          relationships[relName] = relTarget;
        }
      }
    }
    return relationships;
  }

  /**
   * Extract telemetry from contents on-the-fly
   */
  private extractTelemetry(contents: any[]): any[] {
    return (contents || []).filter((c: any) => c["@type"] === "Telemetry");
  }

  private mapToDomain(entity: any): Entity {
    // Compute derived fields on-the-fly
    const contents = (entity.contents as any[]) || [];
    const displayName = entity.displayName || "";
    
    let entityType = "";
    if (displayName.includes("Haul Truck")) entityType = "HaulTruck";
    else if (displayName.includes("Loader")) entityType = "Loader";
    else if (displayName.includes("HaulPath") || displayName.includes("Path")) entityType = "HaulRoute";
    else if (displayName.includes("Stockpile")) entityType = "Stockpile";
    else if (displayName.includes("Mine Layout")) entityType = "MineLayout";
    else entityType = displayName.replace(/\s+/g, "") || "Unknown";
    
    return {
      id: entity.id,
      // EXACT fields from JSON
      dtdlId: entity.dtdlId,
      dtdlContext: entity.dtdlContext,
      dtdlType: entity.dtdlType,
      displayName: entity.displayName,
      extends: entity.extends,
      contents: contents,
      components: entity.components,
      rawDTDL: entity.rawDTDL,
      // Computed fields (not stored in DB)
      type: entityType,
      properties: this.extractProperties(contents),
      relationships: this.extractRelationships(contents),
      telemetry: this.extractTelemetry(contents),
    };
  }
}


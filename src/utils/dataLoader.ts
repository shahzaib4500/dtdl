/**
 * Utilities: Data Loader
 * Loads DTDL and telemetry data from files
 */

import { readFileSync } from "fs";
import Papa from "papaparse";
import type { Entity } from "../domain/Entity.js";
import type { TelemetryRecord } from "../domain/TelemetryRecord.js";

/**
 * Load DTDL model from JSON file
 * Supports both simple format and DTDL v2 format (@id, @type, @context)
 */
export function loadDTDLFromFile(filePath: string): Entity[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    // Handle array of entities (simple format)
    if (Array.isArray(data)) {
      // Check if it's DTDL v2 format (has @id, @type, @context)
      if (data.length > 0 && data[0]["@id"] && data[0]["@type"]) {
        return convertDTDLv2ToEntities(data);
      }
      // Otherwise, assume simple format
      return data;
    }

    // Handle object with entities property
    if (data.entities && Array.isArray(data.entities)) {
      if (data.entities.length > 0 && data.entities[0]["@id"] && data.entities[0]["@type"]) {
        return convertDTDLv2ToEntities(data.entities);
      }
      return data.entities;
    }

    throw new Error("Invalid DTDL JSON structure");
  } catch (error) {
    throw new Error(`Failed to load DTDL file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Convert DTDL v2 format to our Entity format
 */
function convertDTDLv2ToEntities(dtdlInterfaces: any[]): Entity[] {
  const entities: Entity[] = [];
  const entityMap = new Map<string, Entity>();

  // First pass: create entities from DTDL interfaces
  for (const dtdlInterface of dtdlInterfaces) {
    // Skip non-Interface types (like Groups, BaseEquipment, etc.)
    if (dtdlInterface["@type"] !== "Interface") {
      continue;
    }

    // Extract entity ID from @id (format: "dtmi:...;1__twin_EntityName" or just "dtmi:...")
    const dtdlId = dtdlInterface["@id"] || "";
    let entityId = dtdlId;
    
    // Extract twin name if present (format: "...__twin_EntityName")
    if (dtdlId.includes("__twin_")) {
      entityId = dtdlId.split("__twin_")[1];
    } else {
      // Use displayName or last part of @id
      entityId = dtdlInterface.displayName || dtdlId.split(":").pop() || dtdlId;
    }

    // Extract type from displayName or @id
    let entityType = dtdlInterface.displayName || "";
    if (entityType.includes("Haul Truck")) entityType = "HaulTruck";
    else if (entityType.includes("Loader")) entityType = "Loader";
    else if (entityType.includes("HaulPath") || entityType.includes("Path")) entityType = "HaulRoute";
    else if (entityType.includes("Stockpile")) entityType = "Stockpile";
    else if (entityType.includes("Mine Layout")) entityType = "MineLayout";
    else if (entityType) {
      // Use displayName as type
      entityType = entityType.replace(/\s+/g, "");
    } else {
      entityType = "Unknown";
    }

    // Extract properties from contents
    const properties: Record<string, any> = {};
    const relationships: Record<string, string> = {};

    if (dtdlInterface.contents && Array.isArray(dtdlInterface.contents)) {
      for (const content of dtdlInterface.contents) {
        if (content["@type"] === "Property") {
          const propName = content.name;
          const propValue = content.value !== undefined ? content.value : content.initialValue;
          const propSchema = content.schema;

          // Determine property type
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
            editable: content.writable !== false, // Default to editable unless explicitly writable: false
          };
        } else if (content["@type"] === "Relationship") {
          // Extract relationship target
          const relName = content.name;
          const relTarget = content.target;
          if (relName && relTarget) {
            relationships[relName] = relTarget;
          }
        }
      }
    }

    // Handle assignedEquipmentIds (for HaulPath)
    if (dtdlInterface.contents) {
      const assignedEquipmentProp = dtdlInterface.contents.find(
        (c: any) => c["@type"] === "Property" && c.name === "assignedEquipmentIds"
      );
      if (assignedEquipmentProp && Array.isArray(assignedEquipmentProp.value)) {
        // Store as a relationship array (we'll handle this separately if needed)
        // For now, just note the first one
        if (assignedEquipmentProp.value.length > 0) {
          relationships["assignedEquipment"] = assignedEquipmentProp.value[0];
        }
      }
    }

    // Only create entity if it has an ID and is a twin (not just an interface definition)
    if (entityId && dtdlId.includes("__twin_")) {
      // Store EXACT structure from JSON - no computed/derived fields
      const entity: Entity = {
        id: entityId,
        // EXACT fields from dtdl.json
        dtdlId: dtdlId,
        dtdlContext: dtdlInterface["@context"] || "",
        dtdlType: dtdlInterface["@type"] || "",
        displayName: dtdlInterface.displayName,
        extends: dtdlInterface.extends,
        contents: dtdlInterface.contents || [],
        components: dtdlInterface.components,
        // Complete original DTDL interface
        rawDTDL: dtdlInterface,
        // Computed fields (not stored in DB, computed on-the-fly when needed)
        type: entityType,
        properties,
        relationships,
        telemetry: dtdlInterface.contents?.filter((c: any) => c["@type"] === "Telemetry") || [],
      };

      entityMap.set(entityId, entity);
      entities.push(entity);
    }
  }

  // Second pass: resolve relationship targets to entity IDs
  for (const entity of entities) {
    const relationships = entity.relationships || {};
    for (const [relName, relTarget] of Object.entries(relationships)) {
      // If target is a DTMI ID, try to find the corresponding entity
      if (relTarget && typeof relTarget === 'string' && relTarget.startsWith("dtmi:")) {
        // Find entity with matching @id
        const targetInterface = dtdlInterfaces.find((iface: any) => iface["@id"] === relTarget);
        if (targetInterface && targetInterface["@id"]?.includes("__twin_")) {
          const targetEntityId = targetInterface["@id"].split("__twin_")[1];
          const targetEntity = entityMap.get(targetEntityId);
          if (targetEntity && entity.relationships) {
            entity.relationships[relName] = targetEntityId;
          }
        }
      }
    }
  }

  return entities;
}

/**
 * Load telemetry data from CSV file
 */
export function loadTelemetryFromCSV(filePath: string): Omit<TelemetryRecord, "id">[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const result = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase(),
    });

    return result.data.map((row: any) => ({
      timestamp: new Date(row.timestamp || row.time || row.date),
      truckId: row.truckid || row.truck_id || row.truck,
      speed: parseFloat(row.speed || row.speedkph || row.speed_kmh || "0"),
      position: {
        lat: parseFloat(row.lat || row.latitude || "0"),
        lon: parseFloat(row.lon || row.longitude || row.lng || "0"),
      },
      direction: row.direction || row.heading || "N",
      routeId: row.routeid || row.route_id || row.route || "",
    }));
  } catch (error) {
    throw new Error(`Failed to load telemetry CSV: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Load telemetry data from JSON file
 * Preserves ALL fields from the original JSON schema
 */
export function loadTelemetryFromJSON(filePath: string): Omit<TelemetryRecord, "id">[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);

    const records = Array.isArray(data) ? data : data.records || data.telemetry || [];

    return records.map((row: any) => {
      // Handle timestamp - support both full timestamps and time-only strings
      let timestamp: Date;
      if (row.timestamp) {
        timestamp = new Date(row.timestamp);
      } else if (row.time) {
        // If time is just "HH:MM:SS", assume today's date
        const timeStr = row.time;
        if (timeStr.includes("T") || timeStr.includes(" ")) {
          timestamp = new Date(timeStr);
        } else {
          // Time-only format like "00:00:00" - use today's date
          const today = new Date();
          const [hours, minutes, seconds] = timeStr.split(":").map(Number);
          timestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes, seconds || 0);
        }
      } else if (row.date) {
        timestamp = new Date(row.date);
      } else {
        timestamp = new Date(); // Fallback to now
      }

      // Handle truck ID
      const truckId = row.truckId || row.truck_id || row.truck || "";

      // Store EXACT fields from JSON - no computed/derived fields
      const record: Omit<TelemetryRecord, "id"> = {
        timestamp, // Converted from "time"
        truckId,
        // EXACT fields from telemetry.json
        status: row.status || undefined,
        payload: row.payload !== undefined ? parseFloat(row.payload) : undefined,
        speedMph: row.speedMph !== undefined ? parseFloat(row.speedMph) : undefined,
        posX: row.posX !== undefined ? parseFloat(row.posX) : undefined,
        posY: row.posY !== undefined ? parseFloat(row.posY) : undefined,
        posZ: row.posZ !== undefined ? parseFloat(row.posZ) : undefined,
        headingDeg: row.headingDeg !== undefined ? parseFloat(row.headingDeg) : undefined,
        haulPhase: row.haulPhase || undefined,
        haulPathId: row.haulPathId || undefined,
        engineTemp: row.engineTemp !== undefined ? parseFloat(row.engineTemp) : undefined,
        fuelLevel: row.fuelLevel !== undefined ? parseFloat(row.fuelLevel) : undefined,
        fuelConsumptionRate: row.fuelConsumptionRate !== undefined ? parseFloat(row.fuelConsumptionRate) : undefined,
        brakePedalPos: row.brakePedalPos !== undefined ? parseFloat(row.brakePedalPos) : undefined,
        throttlePos: row.throttlePos !== undefined ? parseFloat(row.throttlePos) : undefined,
        vibrationLevel: row.vibrationLevel !== undefined ? parseFloat(row.vibrationLevel) : undefined,
        tirePressureFL: row.tirePressureFL !== undefined ? parseFloat(row.tirePressureFL) : undefined,
        tirePressureFR: row.tirePressureFR !== undefined ? parseFloat(row.tirePressureFR) : undefined,
        tirePressureRLO: row.tirePressureRLO !== undefined ? parseFloat(row.tirePressureRLO) : undefined,
        tirePressureRLI: row.tirePressureRLI !== undefined ? parseFloat(row.tirePressureRLI) : undefined,
        tirePressureRRO: row.tirePressureRRO !== undefined ? parseFloat(row.tirePressureRRO) : undefined,
        tirePressureRRI: row.tirePressureRRI !== undefined ? parseFloat(row.tirePressureRRI) : undefined,
        // Store complete original record
        rawData: row,
      };

      return record;
    });
  } catch (error) {
    throw new Error(`Failed to load telemetry JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}


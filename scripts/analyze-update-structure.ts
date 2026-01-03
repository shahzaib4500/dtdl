/**
 * Analyze DTDL and Telemetry structure to understand what needs to be updated
 */

import { prisma } from "../src/infrastructure/database/prisma.js";
import { readFileSync } from "fs";
import { join } from "path";

async function analyzeStructure() {
  console.log("=".repeat(80));
  console.log("ANALYZING DTDL AND TELEMETRY STRUCTURE FOR UPDATES");
  console.log("=".repeat(80));
  console.log();

  // 1. Check DTDL structure in database
  console.log("1. DTDL ENTITY STRUCTURE IN DATABASE");
  console.log("-".repeat(80));
  const entity = await prisma.dTDLEntity.findFirst({
    where: { id: "Haul_Truck_CAT_777_3" },
  });

  if (entity) {
    console.log(`Entity ID: ${entity.id}`);
    console.log(`Display Name: ${entity.displayName}`);
    console.log(`DTDL ID: ${entity.dtdlId}`);
    console.log();

    const contents = entity.contents as any[];
    console.log(`Contents array has ${contents.length} items`);

    // Find focusSnapDistanceMeters property
    const focusProp = contents.find(
      (c) => c["@type"] === "Property" && c.name === "focusSnapDistanceMeters"
    );

    if (focusProp) {
      console.log("\n=== focusSnapDistanceMeters Property Structure ===");
      console.log(JSON.stringify(focusProp, null, 2));
      console.log();
      console.log("Key fields:");
      console.log(`  - @type: ${focusProp["@type"]}`);
      console.log(`  - name: ${focusProp.name}`);
      console.log(`  - schema: ${JSON.stringify(focusProp.schema)}`);
      console.log(`  - value: ${focusProp.value} (current value)`);
      console.log(`  - initialValue: ${focusProp.initialValue} (default value)`);
      console.log();
    }

    // Show all Property types
    const properties = contents.filter((c) => c["@type"] === "Property");
    console.log(`\nTotal Properties: ${properties.length}`);
    console.log("Property names:", properties.map((p) => p.name).join(", "));
  }

  console.log("\n");

  // 2. Check original DTDL JSON structure
  console.log("2. ORIGINAL DTDL JSON STRUCTURE");
  console.log("-".repeat(80));
  const dtdlPath = join(process.cwd(), "data", "dtdl.json");
  const dtdlData = JSON.parse(readFileSync(dtdlPath, "utf-8"));

  const twinEntity = dtdlData.find((item: any) =>
    item["@id"]?.includes("__twin_Haul_Truck_CAT_777_3")
  );

  if (twinEntity) {
    console.log(`Found twin entity: ${twinEntity["@id"]}`);
    const focusPropOriginal = (twinEntity.contents || []).find(
      (c: any) => c["@type"] === "Property" && c.name === "focusSnapDistanceMeters"
    );

    if (focusPropOriginal) {
      console.log("\n=== Original focusSnapDistanceMeters in JSON ===");
      console.log(JSON.stringify(focusPropOriginal, null, 2));
    }
  }

  console.log("\n");

  // 3. Check Telemetry structure
  console.log("3. TELEMETRY STRUCTURE");
  console.log("-".repeat(80));
  const telemetryPath = join(process.cwd(), "data", "telemetry.json");
  const telemetryData = JSON.parse(readFileSync(telemetryPath, "utf-8"));

  console.log(`Total telemetry records: ${telemetryData.length}`);
  console.log("\nSample telemetry record:");
  console.log(JSON.stringify(telemetryData[0], null, 2));
  console.log("\nKey observation: Telemetry is READ-ONLY sensor data.");
  console.log("  - We don't update telemetry records");
  console.log("  - Telemetry is historical/real-time sensor readings");

  console.log("\n");

  // 4. What needs to be updated?
  console.log("4. WHAT NEEDS TO BE UPDATED WHEN A PROPERTY CHANGES?");
  console.log("-".repeat(80));
  console.log();
  console.log("When updating a DTDL property (e.g., focusSnapDistanceMeters):");
  console.log();
  console.log("✓ MUST UPDATE:");
  console.log("  1. The Property object in the 'contents' array:");
  console.log("     - Update 'value' field in the Property object");
  console.log("     - Keep 'initialValue' unchanged (it's the default)");
  console.log("     - Keep all other Property fields unchanged");
  console.log();
  console.log("  2. The 'contents' JSON field in the database:");
  console.log("     - This is stored in dtdl_entities.contents (JSON column)");
  console.log("     - We need to update the specific Property object within contents");
  console.log();
  console.log("  3. The computed 'properties' object (in-memory):");
  console.log("     - This is derived from 'contents' on-the-fly");
  console.log("     - Will be automatically updated when contents changes");
  console.log();
  console.log("✗ DO NOT UPDATE:");
  console.log("  - Telemetry records (they are read-only sensor data)");
  console.log("  - Other DTDL fields (dtdlId, dtdlContext, displayName, etc.)");
  console.log("  - Property 'initialValue' (it's the default, not current value)");
  console.log("  - Property schema, name, or other metadata");
  console.log();
  console.log("5. DATABASE UPDATE STRATEGY");
  console.log("-".repeat(80));
  console.log();
  console.log("Current database schema:");
  console.log("  dtdl_entities table:");
  console.log("    - id (String, primary key)");
  console.log("    - contents (Json) - stores the complete contents array");
  console.log("    - rawDTDL (Json) - stores complete original DTDL");
  console.log();
  console.log("Update approach:");
  console.log("  1. Load entity from database");
  console.log("  2. Find Property object in contents array by name");
  console.log("  3. Update Property.value field");
  console.log("  4. Save entire entity back to database (upsert)");
  console.log("  5. Update in-memory DTDLModel for immediate access");
  console.log();
  console.log("Why update 'contents' and not just 'properties'?");
  console.log("  - 'contents' is the source of truth (actual DTDL data)");
  console.log("  - 'properties' is computed on-the-fly from 'contents'");
  console.log("  - Database stores 'contents', not 'properties'");
  console.log("  - On server restart, 'properties' is recomputed from 'contents'");

  await prisma.$disconnect();
}

analyzeStructure().catch(console.error);


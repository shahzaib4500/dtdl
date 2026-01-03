/**
 * Main Entry Point
 * Sets up and starts the Express server
 */

import { config } from "./config/env.js";
import { prisma } from "./infrastructure/database/prisma.js";
import { DTDLModel } from "./domain/DTDLModel.js";
import { PrismaTelemetryRepository } from "./infrastructure/repositories/TelemetryRepository.js";
import { PrismaDTDLRepository } from "./infrastructure/repositories/DTDLRepository.js";
import { PrismaConstraintRepository } from "./infrastructure/repositories/ConstraintRepository.js";
import { LangChainService } from "./infrastructure/langchain/LangChainService.js";
import { EntityResolver } from "./infrastructure/resolvers/EntityResolver.js";
import { TelemetryService } from "./services/TelemetryService.js";
import { UpdateValidator } from "./services/UpdateValidator.js";
import { QueryService } from "./services/QueryService.js";
import { CommandService } from "./services/CommandService.js";
import { PropertyResolver } from "./services/PropertyResolver.js";
import { SchemaResolver } from "./services/SchemaResolver.js";
import { QueryExecutorRegistry } from "./services/executors/QueryExecutorRegistry.js";
import { createApp } from "./api/app.js";
import { loadDTDLFromFile, loadTelemetryFromCSV, loadTelemetryFromJSON } from "./utils/dataLoader.js";
import { existsSync } from "fs";
import { join } from "path";

async function initializeDTDLModel(): Promise<DTDLModel> {
  const dtdlRepo = new PrismaDTDLRepository();
  const entities = await dtdlRepo.findAll();

  if (entities.length > 0) {
    console.log(`✓ Loaded ${entities.length} entities from database`);
    return DTDLModel.fromJSON(entities);
  }

  // Try to load from file if database is empty
  // Check for dtdl.json first (client-provided DTDL v2 format), then dtdl-model.json
  const dtdlPath = join(process.cwd(), "data", "dtdl.json");
  const dtdlModelPath = join(process.cwd(), "data", "dtdl-model.json");
  
  let filePath: string | null = null;
  if (existsSync(dtdlPath)) {
    filePath = dtdlPath;
    console.log("Loading DTDL model from dtdl.json (DTDL v2 format)...");
  } else if (existsSync(dtdlModelPath)) {
    filePath = dtdlModelPath;
    console.log("Loading DTDL model from dtdl-model.json...");
  }

  if (filePath) {
    const fileEntities = loadDTDLFromFile(filePath);
    
    // loadDTDLFromFile already returns full Entity objects with all fields
    const model = DTDLModel.fromJSON(fileEntities);
    
    // Save to database
    await dtdlRepo.saveMany(fileEntities);
    console.log(`✓ Loaded ${fileEntities.length} entities from file and saved to database`);
    return model;
  }

  console.log("⚠ No DTDL data found. Using empty model.");
  return new DTDLModel();
}

async function initializeTelemetry(): Promise<void> {
  const telemetryRepo = new PrismaTelemetryRepository();
  
  // Check if telemetry exists
  const count = await prisma.telemetryRecord.count();
  if (count > 0) {
    console.log(`✓ Found ${count} telemetry records in database`);
    return;
  }

  // Try to load from file
  const dataDir = join(process.cwd(), "data");
  const csvPath = join(dataDir, "telemetry.csv");
  const jsonPath = join(dataDir, "telemetry.json");
  const sampleJsonPath = join(dataDir, "telemetry-sample.json");

  if (existsSync(csvPath)) {
    console.log("Loading telemetry from CSV...");
    const records = loadTelemetryFromCSV(csvPath);
    await telemetryRepo.createMany(records);
    console.log(`✓ Loaded ${records.length} telemetry records from CSV`);
  } else if (existsSync(jsonPath)) {
    console.log("Loading telemetry from JSON...");
    const records = loadTelemetryFromJSON(jsonPath);
    await telemetryRepo.createMany(records);
    console.log(`✓ Loaded ${records.length} telemetry records from JSON`);
  } else if (existsSync(sampleJsonPath)) {
    console.log("Loading telemetry from sample JSON...");
    const records = loadTelemetryFromJSON(sampleJsonPath);
    await telemetryRepo.createMany(records);
    console.log(`✓ Loaded ${records.length} telemetry records from sample JSON`);
  } else {
    console.log("⚠ No telemetry data found. Database is empty.");
  }
}

async function initializeConstraints(): Promise<void> {
  const constraintRepo = new PrismaConstraintRepository();
  const constraints = await constraintRepo.getAllConstraints();

  if (constraints.length > 0) {
    console.log(`✓ Loaded ${constraints.length} property constraints`);
    return;
  }

  // Initialize default constraints
  const defaultConstraints = [
    {
      entityType: "HaulTruck",
      property: "maxSpeedKph",
      minValue: 0,
      maxValue: 100,
      readOnly: false,
      editable: true,
    },
    {
      entityType: "HaulTruck",
      property: "payloadTonnes",
      minValue: 0,
      maxValue: 500,
      readOnly: false,
      editable: true,
    },
    {
      entityType: "HaulTruck",
      property: "id",
      readOnly: true,
      editable: false,
    },
    // Add constraints for properties that exist in DTDL
    {
      entityType: "HaulTruck",
      property: "focusSnapDistanceMeters",
      minValue: 0,
      maxValue: 10000,
      readOnly: false,
      editable: true,
    },
    {
      entityType: "HaulTruck",
      property: "builderCategory",
      readOnly: false,
      editable: true,
    },
    {
      entityType: "HaulTruck",
      property: "builderIsPhysical",
      readOnly: false,
      editable: true,
    },
    // Loader constraints
    {
      entityType: "Loader",
      property: "focusSnapDistanceMeters",
      minValue: 0,
      maxValue: 10000,
      readOnly: false,
      editable: true,
    },
    {
      entityType: "Loader",
      property: "builderCategory",
      readOnly: false,
      editable: true,
    },
    {
      entityType: "Loader",
      property: "builderIsPhysical",
      readOnly: false,
      editable: true,
    },
    // MineLayout constraints
    {
      entityType: "MineLayout",
      property: "focusSnapDistanceMeters",
      minValue: 0,
      maxValue: 10000,
      readOnly: false,
      editable: true,
    },
    {
      entityType: "MineLayout",
      property: "builderCategory",
      readOnly: false,
      editable: true,
    },
    {
      entityType: "MineLayout",
      property: "builderIsPhysical",
      readOnly: false,
      editable: true,
    },
  ];

  for (const constraint of defaultConstraints) {
    await constraintRepo.saveConstraint(constraint);
  }

  console.log(`✓ Initialized ${defaultConstraints.length} default constraints`);
}

async function main() {
  console.log("🚀 Starting DTDL AI Challenge Server...\n");

  try {
    // Initialize database connection
    await prisma.$connect();
    console.log("✓ Database connected\n");

    // Initialize data
    const dtdlModel = await initializeDTDLModel();
    await initializeTelemetry();
    await initializeConstraints();

    // Initialize infrastructure
    const langChainService = new LangChainService();
    const entityResolver = new EntityResolver();
    const telemetryRepo = new PrismaTelemetryRepository();
    const dtdlRepo = new PrismaDTDLRepository();
    const constraintRepo = new PrismaConstraintRepository();

    // Initialize domain services
    const telemetryService = new TelemetryService(telemetryRepo);
    const validator = new UpdateValidator(constraintRepo);

    // Initialize schema resolution layer (Requirement B: DTDL-based property resolution)
    const propertyResolver = new PropertyResolver();
    const schemaResolver = new SchemaResolver(
      entityResolver,
      propertyResolver,
      dtdlModel
    );

    // Initialize query execution layer (Stretch #2: Tool-based architecture)
    const executorRegistry = new QueryExecutorRegistry(telemetryService);

    // Initialize application services
    const queryService = new QueryService(
      langChainService,
      schemaResolver,
      telemetryService,
      executorRegistry
    );

    const commandService = new CommandService(
      langChainService,
      schemaResolver,
      dtdlModel,
      validator,
      dtdlRepo
    );

    // Create Express app
    const app = createApp(queryService, commandService);

    // Start server
    const port = config.PORT;
    app.listen(port, () => {
      console.log(`\n✅ Server running on http://localhost:${port}`);
      console.log(`\n📡 API Endpoints:`);
      console.log(`   POST /api/v1/query   - Execute natural language query`);
      console.log(`   POST /api/v1/command - Execute natural language command`);
      console.log(`   GET  /api/v1/health  - Health check`);
      console.log(`\n📚 API Documentation:`);
      console.log(`   GET  /api-docs       - Swagger UI documentation\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

main();


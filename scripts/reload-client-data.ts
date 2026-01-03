/**
 * Script to reload client-provided datasets
 * Clears existing data and loads from dtdl.json and telemetry.json
 */

import { prisma } from '../src/infrastructure/database/prisma.js';
import { loadDTDLFromFile, loadTelemetryFromJSON } from '../src/utils/dataLoader.js';
import { PrismaDTDLRepository } from '../src/infrastructure/repositories/DTDLRepository.js';
import { PrismaTelemetryRepository } from '../src/infrastructure/repositories/TelemetryRepository.js';
import { join } from 'path';
import { existsSync } from 'fs';

async function reloadClientData() {
  console.log('🔄 Reloading client-provided datasets...\n');

  try {
    // Connect to database
    await prisma.$connect();
    console.log('✓ Connected to database\n');

    // 1. Clear existing telemetry data
    console.log('🗑️  Clearing existing telemetry records...');
    const telemetryDeleted = await prisma.telemetryRecord.deleteMany({});
    console.log(`   Deleted ${telemetryDeleted.count} telemetry records\n`);

    // 2. Clear existing DTDL entities
    console.log('🗑️  Clearing existing DTDL entities...');
    const dtdlDeleted = await prisma.dTDLEntity.deleteMany({});
    console.log(`   Deleted ${dtdlDeleted.count} DTDL entities\n`);

    // 3. Load DTDL from client-provided file
    const dtdlPath = join(process.cwd(), 'data', 'dtdl.json');
    if (!existsSync(dtdlPath)) {
      console.error('❌ dtdl.json not found at:', dtdlPath);
      process.exit(1);
    }

    console.log('📦 Loading DTDL from dtdl.json (DTDL v2 format)...');
    const dtdlRepo = new PrismaDTDLRepository();
    const fileEntities = loadDTDLFromFile(dtdlPath);
    
    // Use entities directly - they already have all DTDL fields preserved
    const entities = fileEntities;

    // Save to database
    await dtdlRepo.saveMany(entities);
    console.log(`✓ Loaded ${entities.length} DTDL entities from dtdl.json\n`);

    // 4. Load telemetry from client-provided file
    const telemetryPath = join(process.cwd(), 'data', 'telemetry.json');
    if (!existsSync(telemetryPath)) {
      console.error('❌ telemetry.json not found at:', telemetryPath);
      process.exit(1);
    }

    console.log('📦 Loading telemetry from telemetry.json...');
    console.log('   (This may take a while for large files...)\n');
    
    const telemetryRepo = new PrismaTelemetryRepository();
    const records = loadTelemetryFromJSON(telemetryPath);
    
    console.log(`   Loaded ${records.length} records from JSON`);
    console.log('   Saving to database (this may take a while)...\n');

    // Save in batches to avoid memory issues
    const batchSize = 1000;
    let saved = 0;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await telemetryRepo.createMany(batch);
      saved += batch.length;
      if (saved % 10000 === 0 || saved === records.length) {
        console.log(`   Progress: ${saved}/${records.length} records saved...`);
      }
    }

    console.log(`\n✓ Loaded ${records.length} telemetry records from telemetry.json\n`);

    // 5. Verify
    const finalTelemetryCount = await prisma.telemetryRecord.count();
    const finalDtdlCount = await prisma.dTDLEntity.count();

    console.log('📊 Final Database State:');
    console.log(`   Telemetry Records: ${finalTelemetryCount}`);
    console.log(`   DTDL Entities: ${finalDtdlCount}\n`);

    // Show sample truck IDs
    const sampleTrucks = await prisma.telemetryRecord.findMany({
      select: { truckId: true },
      distinct: ['truckId'],
      take: 5,
    });
    console.log('📋 Sample Truck IDs in telemetry:');
    sampleTrucks.forEach(t => console.log(`   - ${t.truckId}`));

    // Show sample entity IDs
    const sampleEntities = await prisma.dTDLEntity.findMany({
      select: { id: true, displayName: true },
      take: 10,
    });
    console.log('\n📋 Sample DTDL Entities:');
    sampleEntities.forEach(e => console.log(`   - ${e.id} (${e.type})`));

    console.log('\n✅ Client data reloaded successfully!');

  } catch (error) {
    console.error('❌ Error reloading data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

reloadClientData()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });


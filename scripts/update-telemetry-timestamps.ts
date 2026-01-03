/**
 * Update telemetry timestamps to be recent (within last hour)
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function updateTimestamps() {
  try {
    await prisma.$connect();
    console.log('🔄 Updating telemetry timestamps to be recent...\n');
    
    // Get all records ordered by current timestamp
    const allRecords = await prisma.telemetryRecord.findMany({
      orderBy: { timestamp: 'asc' },
    });
    
    if (allRecords.length === 0) {
      console.log('No records to update.');
      return;
    }
    
    console.log(`Found ${allRecords.length} records`);
    
    // Calculate time span of original data
    const firstTimestamp = allRecords[0].timestamp;
    const lastTimestamp = allRecords[allRecords.length - 1].timestamp;
    const originalSpan = lastTimestamp.getTime() - firstTimestamp.getTime();
    
    // Set new time range: from 60 minutes ago to now (ensures "past 30 min" and "past hour" queries work)
    const now = new Date();
    const newEndTime = now; // Current time
    const newStartTime = new Date(now.getTime() - 60 * 60 * 1000); // 60 minutes ago
    
    console.log(`Original time span: ${Math.round(originalSpan / 1000 / 60)} minutes`);
    console.log(`New time range: ${newStartTime.toISOString()} to ${newEndTime.toISOString()}\n`);
    
    // Update timestamps proportionally
    let updated = 0;
    const batchSize = 1000;
    
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      
      await prisma.$transaction(
        batch.map((record, idx) => {
          const globalIdx = i + idx;
          const ratio = globalIdx / (allRecords.length - 1);
          const newTimestamp = new Date(
            newStartTime.getTime() + ratio * originalSpan
          );
          
          return prisma.telemetryRecord.update({
            where: { id: record.id },
            data: { timestamp: newTimestamp },
          });
        })
      );
      
      updated += batch.length;
      if (updated % 5000 === 0 || updated === allRecords.length) {
        console.log(`  Updated ${updated}/${allRecords.length} records...`);
      }
    }
    
    console.log(`\n✅ Updated ${updated} records`);
    console.log(`   New time range: ${newStartTime.toISOString()} to ${newEndTime.toISOString()}`);
    console.log(`   Records are now within the last 1-2 hours\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateTimestamps()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


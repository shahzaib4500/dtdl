/**
 * Check telemetry timestamps
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function checkTimestamps() {
  try {
    await prisma.$connect();
    
    const records = await prisma.telemetryRecord.findMany({
      where: { truckId: 'Haul_Truck_CAT_777_2' },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    
    console.log('Latest 5 records for Haul_Truck_CAT_777_2:');
    records.forEach(r => {
      console.log(`  ${r.timestamp.toISOString()} - speed: ${r.speed} km/h`);
    });
    
    const oldest = await prisma.telemetryRecord.findFirst({
      where: { truckId: 'Haul_Truck_CAT_777_2' },
      orderBy: { timestamp: 'asc' },
    });
    
    const newest = await prisma.telemetryRecord.findFirst({
      where: { truckId: 'Haul_Truck_CAT_777_2' },
      orderBy: { timestamp: 'desc' },
    });
    
    const now = new Date();
    const timeDiff = newest ? Math.round((now.getTime() - newest.timestamp.getTime()) / (1000 * 60)) : 0;
    
    console.log('\n📊 Summary:');
    console.log(`  Oldest record: ${oldest?.timestamp.toISOString()}`);
    console.log(`  Newest record: ${newest?.timestamp.toISOString()}`);
    console.log(`  Current time:  ${now.toISOString()}`);
    console.log(`  Time difference: ${timeDiff} minutes ago`);
    
    if (timeDiff > 60) {
      console.log(`\n⚠️  WARNING: Data is ${timeDiff} minutes old.`);
      console.log('   Queries for "past hour" will return 0 records.');
      console.log('   Consider updating timestamps to be recent.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTimestamps();


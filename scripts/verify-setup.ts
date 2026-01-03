/**
 * Verify system setup - check entities, telemetry, and timestamps
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function verifySetup() {
  try {
    await prisma.$connect();
    
    console.log('🔍 Verifying System Setup...\n');
    
    // 1. Check DTDL Entities
    const entities = await prisma.dTDLEntity.findMany({
      select: { id: true, dtdlType: true }
    });
    console.log(`✅ DTDL Entities: ${entities.length}`);
    entities.forEach(e => console.log(`   - ${e.id} (${e.dtdlType})`));
    
    // 2. Check Telemetry Records
    const totalTelemetry = await prisma.telemetryRecord.count();
    const truck2Records = await prisma.telemetryRecord.count({
      where: { truckId: 'Haul_Truck_CAT_777_2' }
    });
    
    console.log(`\n✅ Telemetry Records:`);
    console.log(`   Total: ${totalTelemetry}`);
    console.log(`   Haul_Truck_CAT_777_2: ${truck2Records}`);
    
    // 3. Check Timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentRecords = await prisma.telemetryRecord.count({
      where: {
        truckId: 'Haul_Truck_CAT_777_2',
        timestamp: {
          gte: oneHourAgo,
          lte: now
        }
      }
    });
    
    const latestRecord = await prisma.telemetryRecord.findFirst({
      where: { truckId: 'Haul_Truck_CAT_777_2' },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true, speedMph: true }
    });
    
    console.log(`\n✅ Timestamp Status:`);
    if (latestRecord) {
      const minutesAgo = Math.round((now.getTime() - latestRecord.timestamp.getTime()) / (1000 * 60));
      console.log(`   Latest record: ${latestRecord.timestamp.toISOString()} (${minutesAgo} minutes ago)`);
      console.log(`   Records in past hour: ${recentRecords}`);
      
      if (recentRecords > 0) {
        console.log(`   ✅ READY: Data is within past hour window`);
      } else {
        console.log(`   ⚠️  WARNING: No records in past hour. Run: npm run db:update-timestamps`);
      }
    }
    
    // 4. Check Property Constraints
    const constraints = await prisma.propertyConstraint.count();
    console.log(`\n✅ Property Constraints: ${constraints}`);
    
    console.log('\n📋 Summary:');
    console.log(`   - DTDL Entities: ${entities.length > 0 ? '✅' : '❌'}`);
    console.log(`   - Telemetry Records: ${totalTelemetry > 0 ? '✅' : '❌'}`);
    console.log(`   - Recent Data (past hour): ${recentRecords > 0 ? '✅' : '❌'}`);
    console.log(`   - Property Constraints: ${constraints > 0 ? '✅' : '❌'}`);
    
    if (entities.length > 0 && totalTelemetry > 0 && recentRecords > 0 && constraints > 0) {
      console.log('\n✨ System is READY for queries!');
    } else {
      console.log('\n⚠️  System needs attention. Check warnings above.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifySetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


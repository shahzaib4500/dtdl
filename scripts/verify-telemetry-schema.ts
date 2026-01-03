/**
 * Verify that telemetry records contain all fields from JSON
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function verifySchema() {
  try {
    await prisma.$connect();
    
    const record = await prisma.telemetryRecord.findFirst({
      where: { truckId: 'Haul_Truck_CAT_777_2' },
      orderBy: { timestamp: 'desc' },
    });
    
    if (!record) {
      console.log('❌ No records found');
      return;
    }
    
    console.log('✅ Sample Telemetry Record (all fields):\n');
    console.log(JSON.stringify(record, null, 2));
    
    console.log('\n📊 Field Coverage:');
    const fields = [
      'status', 'payload', 'speedMph', 'posX', 'posY', 'posZ',
      'headingDeg', 'haulPhase', 'haulPathId', 'engineTemp',
      'fuelLevel', 'fuelConsumptionRate', 'brakePedalPos',
      'throttlePos', 'vibrationLevel', 'tirePressureFL', 'tirePressureFR',
      'tirePressureRLO', 'tirePressureRLI', 'tirePressureRRO', 'tirePressureRRI',
      'rawData'
    ];
    
    fields.forEach(field => {
      const hasField = record[field as keyof typeof record] !== null && record[field as keyof typeof record] !== undefined;
      console.log(`   ${hasField ? '✅' : '❌'} ${field}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


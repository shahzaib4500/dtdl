/**
 * Verify that DTDL entities contain all fields from JSON
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function verifySchema() {
  try {
    await prisma.$connect();
    
    const entity = await prisma.dTDLEntity.findFirst({
      where: { id: 'Haul_Truck_CAT_777_2' },
    });
    
    if (!entity) {
      console.log('❌ No entity found');
      return;
    }
    
    console.log('✅ Sample DTDL Entity (all fields):\n');
    console.log(JSON.stringify(entity, null, 2));
    
    console.log('\n📊 Field Coverage:');
    const fields = [
      'dtdlId', 'dtdlContext', 'dtdlType', 'displayName', 'extends',
      'contents', 'components', 'telemetry', 'rawDTDL'
    ];
    
    fields.forEach(field => {
      const hasField = entity[field as keyof typeof entity] !== null && entity[field as keyof typeof entity] !== undefined;
      console.log(`   ${hasField ? '✅' : '❌'} ${field}`);
    });
    
    if (entity.contents) {
      console.log(`\n📋 Contents: ${Array.isArray(entity.contents) ? entity.contents.length : 'N/A'} items`);
    }
    if (entity.components) {
      console.log(`📋 Components: ${Array.isArray(entity.components) ? entity.components.length : 'N/A'} items`);
    }
    if (entity.telemetry) {
      console.log(`📋 Telemetry: ${Array.isArray(entity.telemetry) ? entity.telemetry.length : 'N/A'} definitions`);
    }
    
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


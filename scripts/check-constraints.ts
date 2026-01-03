/**
 * Check property constraints in database
 */

import { prisma } from '../src/infrastructure/database/prisma.js';

async function checkConstraints() {
  try {
    await prisma.$connect();
    
    const constraints = await prisma.propertyConstraint.findMany();
    
    console.log('📋 Property Constraints in Database:');
    if (constraints.length === 0) {
      console.log('  No constraints found');
    } else {
      constraints.forEach(c => {
        console.log(`  • ${c.entityType}.${c.property}`);
        console.log(`    editable: ${c.editable}, readOnly: ${c.readOnly}`);
        if (c.minValue !== null) console.log(`    minValue: ${c.minValue}`);
        if (c.maxValue !== null) console.log(`    maxValue: ${c.maxValue}`);
      });
    }
    
    // Check for focusSnapDistanceMeters specifically
    const focusSnap = await prisma.propertyConstraint.findUnique({
      where: {
        entityType_property: {
          entityType: 'HaulTruck',
          property: 'focusSnapDistanceMeters'
        }
      }
    });
    
    console.log('\n🔍 Constraint for focusSnapDistanceMeters:');
    if (focusSnap) {
      console.log(JSON.stringify(focusSnap, null, 2));
    } else {
      console.log('  No constraint found (will default to not editable)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkConstraints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


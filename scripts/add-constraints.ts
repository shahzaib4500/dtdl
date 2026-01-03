/**
 * Add missing property constraints
 */

import { PrismaConstraintRepository } from '../src/infrastructure/repositories/ConstraintRepository.js';

async function addConstraints() {
  try {
    const repo = new PrismaConstraintRepository();
    
    console.log('➕ Adding missing property constraints...\n');
    
    const constraints = [
      {
        entityType: 'HaulTruck',
        property: 'focusSnapDistanceMeters',
        minValue: 0,
        maxValue: 10000,
        readOnly: false,
        editable: true
      },
      {
        entityType: 'HaulTruck',
        property: 'builderCategory',
        readOnly: false,
        editable: true
      },
      {
        entityType: 'HaulTruck',
        property: 'builderIsPhysical',
        readOnly: false,
        editable: true
      },
      {
        entityType: 'Loader',
        property: 'focusSnapDistanceMeters',
        minValue: 0,
        maxValue: 10000,
        readOnly: false,
        editable: true
      },
      {
        entityType: 'Loader',
        property: 'builderCategory',
        readOnly: false,
        editable: true
      },
      {
        entityType: 'Loader',
        property: 'builderIsPhysical',
        readOnly: false,
        editable: true
      },
      {
        entityType: 'MineLayout',
        property: 'focusSnapDistanceMeters',
        minValue: 0,
        maxValue: 10000,
        readOnly: false,
        editable: true
      },
      {
        entityType: 'MineLayout',
        property: 'builderCategory',
        readOnly: false,
        editable: true
      },
      {
        entityType: 'MineLayout',
        property: 'builderIsPhysical',
        readOnly: false,
        editable: true
      }
    ];
    
    for (const constraint of constraints) {
      await repo.saveConstraint(constraint);
      console.log(`  ✅ ${constraint.entityType}.${constraint.property}`);
    }
    
    console.log(`\n✅ Added ${constraints.length} constraints`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

addConstraints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


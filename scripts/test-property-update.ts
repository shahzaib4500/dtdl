/**
 * Test script to verify property updates are persisted to database
 */

import { prisma } from "../src/infrastructure/database/prisma.js";

async function testPropertyUpdate() {
  console.log("=".repeat(80));
  console.log("TESTING PROPERTY UPDATE PERSISTENCE");
  console.log("=".repeat(80));
  console.log();

  const entityId = "Haul_Truck_CAT_777_3";
  const propertyName = "focusSnapDistanceMeters";

  // 1. Get current value from database
  console.log("1. Reading current value from database...");
  const entityBefore = await prisma.dTDLEntity.findUnique({
    where: { id: entityId },
  });

  if (!entityBefore) {
    console.error(`Entity '${entityId}' not found in database`);
    await prisma.$disconnect();
    return;
  }

  const contentsBefore = entityBefore.contents as any[];
  const propertyBefore = contentsBefore.find(
    (c: any) => c["@type"] === "Property" && c.name === propertyName
  );

  if (!propertyBefore) {
    console.error(`Property '${propertyName}' not found in entity`);
    await prisma.$disconnect();
    return;
  }

  const currentValue = propertyBefore.value;
  console.log(`   Current value: ${currentValue}`);
  console.log(`   initialValue: ${propertyBefore.initialValue}`);
  console.log();

  // 2. Simulate an update (what the API would do)
  console.log("2. Simulating property update...");
  const newValue = currentValue === 200 ? 300 : 200; // Toggle between 200 and 300
  console.log(`   Updating to: ${newValue}`);

  // Update the Property object in contents array
  propertyBefore.value = newValue;

  // Save the entity back to database
  await prisma.dTDLEntity.update({
    where: { id: entityId },
    data: {
      contents: contentsBefore as any,
    },
  });

  console.log("   ✓ Update persisted to database");
  console.log();

  // 3. Verify the update
  console.log("3. Verifying update in database...");
  const entityAfter = await prisma.dTDLEntity.findUnique({
    where: { id: entityId },
  });

  if (!entityAfter) {
    console.error(`Entity '${entityId}' not found after update`);
    await prisma.$disconnect();
    return;
  }

  const contentsAfter = entityAfter.contents as any[];
  const propertyAfter = contentsAfter.find(
    (c: any) => c["@type"] === "Property" && c.name === propertyName
  );

  if (!propertyAfter) {
    console.error(`Property '${propertyName}' not found after update`);
    await prisma.$disconnect();
    return;
  }

  console.log(`   Value after update: ${propertyAfter.value}`);
  console.log(`   initialValue (should be unchanged): ${propertyAfter.initialValue}`);
  console.log();

  // 4. Verify correctness
  if (propertyAfter.value === newValue && propertyAfter.initialValue === propertyBefore.initialValue) {
    console.log("✅ SUCCESS: Property update persisted correctly!");
    console.log(`   - value updated: ${currentValue} → ${newValue}`);
    console.log(`   - initialValue preserved: ${propertyBefore.initialValue}`);
  } else {
    console.error("❌ FAILURE: Property update not persisted correctly");
    console.error(`   Expected value: ${newValue}, Got: ${propertyAfter.value}`);
    console.error(`   Expected initialValue: ${propertyBefore.initialValue}, Got: ${propertyAfter.initialValue}`);
  }

  // 5. Restore original value (for testing)
  console.log();
  console.log("4. Restoring original value...");
  propertyAfter.value = currentValue;
  await prisma.dTDLEntity.update({
    where: { id: entityId },
    data: {
      contents: contentsAfter as any,
    },
  });
  console.log(`   ✓ Restored to original value: ${currentValue}`);

  await prisma.$disconnect();
}

testPropertyUpdate().catch(console.error);


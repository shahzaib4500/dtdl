/**
 * Check telemetry records for trip count debugging
 */

import { prisma } from "../src/infrastructure/database/prisma.js";

async function checkTelemetry() {
  const truckId = "Haul_Truck_CAT_777_2";
  const pathId = "path_1";
  
  console.log("=".repeat(80));
  console.log("CHECKING TELEMETRY FOR TRIP COUNT");
  console.log("=".repeat(80));
  console.log();

  // 1. Check total records for this truck
  const totalRecords = await prisma.telemetryRecord.count({
    where: { truckId },
  });
  console.log(`Total telemetry records for ${truckId}: ${totalRecords}`);
  console.log();

  // 2. Check records in the past hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const now = new Date();
  
  const recentRecords = await prisma.telemetryRecord.count({
    where: {
      truckId,
      timestamp: {
        gte: oneHourAgo,
        lte: now,
      },
    },
  });
  console.log(`Records in past hour (${oneHourAgo.toISOString()} to ${now.toISOString()}): ${recentRecords}`);
  console.log();

  // 3. Check records with path_1
  const pathRecords = await prisma.telemetryRecord.count({
    where: {
      truckId,
      haulPathId: pathId,
    },
  });
  console.log(`Records with haulPathId = "${pathId}": ${pathRecords}`);
  console.log();

  // 4. Check records with path_1 in past hour
  const pathRecentRecords = await prisma.telemetryRecord.count({
    where: {
      truckId,
      haulPathId: pathId,
      timestamp: {
        gte: oneHourAgo,
        lte: now,
      },
    },
  });
  console.log(`Records with haulPathId = "${pathId}" in past hour: ${pathRecentRecords}`);
  console.log();

  // 5. Get sample records to see timestamps
  const sampleRecords = await prisma.telemetryRecord.findMany({
    where: { truckId },
    orderBy: { timestamp: "desc" },
    take: 5,
    select: {
      timestamp: true,
      haulPathId: true,
      speedMph: true,
    },
  });

  console.log("Most recent 5 records:");
  sampleRecords.forEach((record, i) => {
    const ageMinutes = Math.floor((Date.now() - record.timestamp.getTime()) / (1000 * 60));
    console.log(
      `  [${i + 1}] ${record.timestamp.toISOString()} (${ageMinutes} minutes ago) - path: ${record.haulPathId}, speed: ${record.speedMph} mph`
    );
  });
  console.log();

  // 6. Check oldest and newest timestamps
  const oldest = await prisma.telemetryRecord.findFirst({
    where: { truckId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true },
  });

  const newest = await prisma.telemetryRecord.findFirst({
    where: { truckId },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });

  if (oldest && newest) {
    console.log(`Timestamp range:`);
    console.log(`  Oldest: ${oldest.timestamp.toISOString()}`);
    console.log(`  Newest: ${newest.timestamp.toISOString()}`);
    const rangeMinutes = Math.floor((newest.timestamp.getTime() - oldest.timestamp.getTime()) / (1000 * 60));
    console.log(`  Range: ${rangeMinutes} minutes`);
    console.log();

    const newestAgeMinutes = Math.floor((Date.now() - newest.timestamp.getTime()) / (1000 * 60));
    console.log(`Newest record is ${newestAgeMinutes} minutes old`);
    
    if (newestAgeMinutes > 60) {
      console.log();
      console.log("⚠️  WARNING: Newest record is older than 1 hour!");
      console.log("   Run: npm run db:update-timestamps");
    }
  }

  // 7. Simulate trip counting
  console.log();
  console.log("=".repeat(80));
  console.log("SIMULATING TRIP COUNT LOGIC");
  console.log("=".repeat(80));
  console.log();

  const allRecords = await prisma.telemetryRecord.findMany({
    where: {
      truckId,
      timestamp: {
        gte: oneHourAgo,
        lte: now,
      },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      haulPathId: true,
    },
  });

  console.log(`Total records in past hour: ${allRecords.length}`);
  
  if (allRecords.length > 0) {
    let tripCount = 0;
    let wasOnPath = false;
    
    for (const record of allRecords) {
      const isOnPath = record.haulPathId === pathId;
      
      if (isOnPath && !wasOnPath) {
        tripCount++;
        console.log(`  Trip ${tripCount}: Entered ${pathId} at ${record.timestamp.toISOString()}`);
      }
      
      wasOnPath = isOnPath;
    }
    
    console.log();
    console.log(`Total trips on ${pathId}: ${tripCount}`);
  } else {
    console.log("No records found in past hour to count trips from.");
  }

  await prisma.$disconnect();
}

checkTelemetry().catch(console.error);


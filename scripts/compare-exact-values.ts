/**
 * Compare exact values between JSON and database
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../src/infrastructure/database/prisma.js';

async function compareExactValues() {
  try {
    await prisma.$connect();
    
    // Get first telemetry record from JSON
    const telemetryJson = JSON.parse(readFileSync(join(process.cwd(), 'data', 'telemetry.json'), 'utf-8'));
    const firstJson = telemetryJson[0];
    
    // Get corresponding record from DB
    const dbRecord = await prisma.telemetryRecord.findFirst({
      where: { truckId: firstJson.truckId },
      orderBy: { timestamp: 'asc' }
    });
    
    console.log('=== TELEMETRY VALUE COMPARISON ===\n');
    console.log('JSON truckId:', firstJson.truckId);
    console.log('DB truckId:', dbRecord?.truckId);
    console.log('\nOriginal JSON values:');
    console.log('  time:', firstJson.time);
    console.log('  speedMph:', firstJson.speedMph);
    console.log('  posX:', firstJson.posX);
    console.log('  posY:', firstJson.posY);
    console.log('  posZ:', firstJson.posZ);
    console.log('  headingDeg:', firstJson.headingDeg);
    console.log('  haulPathId:', firstJson.haulPathId);
    
    console.log('\nDB stored values:');
    console.log('  timestamp:', dbRecord?.timestamp);
    console.log('  speedMph:', dbRecord?.speedMph);
    console.log('  posX:', dbRecord?.posX);
    console.log('  posY:', dbRecord?.posY);
    console.log('  posZ:', dbRecord?.posZ);
    console.log('  headingDeg:', dbRecord?.headingDeg);
    console.log('  haulPathId:', dbRecord?.haulPathId);
    console.log('  speed (computed):', dbRecord?.speed);
    console.log('  lat (computed):', dbRecord?.lat);
    console.log('  lon (computed):', dbRecord?.lon);
    console.log('  direction (computed):', dbRecord?.direction);
    console.log('  routeId (computed):', dbRecord?.routeId);
    
    // Check DTDL
    console.log('\n=== DTDL VALUE COMPARISON ===\n');
    const dtdlJson = JSON.parse(readFileSync(join(process.cwd(), 'data', 'dtdl.json'), 'utf-8'));
    const firstTwin = dtdlJson.find((d: any) => d['@id']?.includes('__twin_'));
    
    if (firstTwin) {
      const entityId = firstTwin['@id'].split('__twin_')[1];
      const dbEntity = await prisma.dTDLEntity.findUnique({
        where: { id: entityId }
      });
      
      console.log('JSON @id:', firstTwin['@id']);
      console.log('DB dtdlId:', dbEntity?.dtdlId);
      console.log('\nJSON @context:', firstTwin['@context']);
      console.log('DB dtdlContext:', dbEntity?.dtdlContext);
      console.log('\nJSON displayName:', firstTwin.displayName);
      console.log('DB displayName:', dbEntity?.displayName);
      console.log('\nJSON extends:', firstTwin.extends);
      console.log('DB extends:', dbEntity?.extends);
      console.log('\nJSON contents length:', firstTwin.contents?.length);
      console.log('DB contents length:', (dbEntity?.contents as any[])?.length);
      console.log('\nJSON components length:', firstTwin.components?.length);
      console.log('DB components length:', (dbEntity?.components as any[])?.length);
      
      // Check if contents match exactly
      if (firstTwin.contents && dbEntity?.contents) {
        const jsonContentsStr = JSON.stringify(firstTwin.contents);
        const dbContentsStr = JSON.stringify(dbEntity.contents);
        if (jsonContentsStr === dbContentsStr) {
          console.log('\n✅ Contents match exactly');
        } else {
          console.log('\n⚠️  Contents differ!');
          console.log('JSON first content:', JSON.stringify(firstTwin.contents[0], null, 2));
          console.log('DB first content:', JSON.stringify((dbEntity.contents as any[])[0], null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

compareExactValues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


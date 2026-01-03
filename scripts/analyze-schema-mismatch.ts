/**
 * Analyze schema mismatches between JSON files and database
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../src/infrastructure/database/prisma.js';

async function analyzeMismatches() {
  try {
    await prisma.$connect();
    
    console.log('🔍 Analyzing Schema Mismatches...\n');
    
    // 1. Analyze Telemetry
    console.log('=== TELEMETRY ANALYSIS ===\n');
    const telemetryJson = JSON.parse(readFileSync(join(process.cwd(), 'data', 'telemetry.json'), 'utf-8'));
    const firstTelemetryJson = telemetryJson[0];
    const jsonTelemetryFields = Object.keys(firstTelemetryJson).sort();
    
    const dbTelemetry = await prisma.telemetryRecord.findFirst();
    const dbTelemetryFields = dbTelemetry ? Object.keys(dbTelemetry).filter(k => 
      k !== 'id' && dbTelemetry[k as keyof typeof dbTelemetry] !== null && 
      dbTelemetry[k as keyof typeof dbTelemetry] !== undefined
    ).sort() : [];
    
    console.log('📄 JSON Fields:', jsonTelemetryFields.join(', '));
    console.log('💾 DB Fields:', dbTelemetryFields.join(', '));
    
    const missingInDB = jsonTelemetryFields.filter(f => {
      // Map JSON field to DB field
      const dbField = f === 'time' ? 'timestamp' : f;
      return !dbTelemetryFields.includes(dbField);
    });
    const extraInDB = dbTelemetryFields.filter(f => {
      // Map DB field to JSON field
      const jsonField = f === 'timestamp' ? 'time' : f;
      return !jsonTelemetryFields.includes(jsonField) && f !== 'rawData';
    });
    
    if (missingInDB.length > 0) {
      console.log('❌ Missing in DB:', missingInDB.join(', '));
    }
    if (extraInDB.length > 0) {
      console.log('⚠️  Extra in DB (computed/convenience):', extraInDB.join(', '));
    }
    if (missingInDB.length === 0 && extraInDB.length === 0) {
      console.log('✅ All JSON fields present in DB (plus computed fields)');
    }
    
    // 2. Analyze DTDL
    console.log('\n=== DTDL ANALYSIS ===\n');
    const dtdlJson = JSON.parse(readFileSync(join(process.cwd(), 'data', 'dtdl.json'), 'utf-8'));
    const firstTwin = dtdlJson.find((d: any) => d['@id']?.includes('__twin_'));
    
    if (firstTwin) {
      const jsonDtdlFields = Object.keys(firstTwin).sort();
      console.log('📄 JSON Top-level Fields:', jsonDtdlFields.join(', '));
      
      const dbDtdl = await prisma.dTDLEntity.findFirst();
      const dbDtdlFields = dbDtdl ? Object.keys(dbDtdl).filter(k => 
        k !== 'id' && dbDtdl[k as keyof typeof dbDtdl] !== null && 
        dbDtdl[k as keyof typeof dbDtdl] !== undefined
      ).sort() : [];
      
      console.log('💾 DB Fields:', dbDtdlFields.join(', '));
      
      // Map JSON fields to DB fields
      const fieldMapping: Record<string, string> = {
        '@context': 'dtdlContext',
        '@id': 'dtdlId',
        '@type': 'dtdlType',
        'displayName': 'displayName',
        'extends': 'extends',
        'contents': 'contents',
        'components': 'components',
      };
      
      const missingInDB = jsonDtdlFields.filter(f => {
        const dbField = fieldMapping[f] || f;
        return !dbDtdlFields.includes(dbField);
      });
      const extraInDB = dbDtdlFields.filter(f => {
        const jsonField = Object.entries(fieldMapping).find(([_, v]) => v === f)?.[0] || f;
        return !jsonDtdlFields.includes(jsonField) && 
               !['type', 'properties', 'relationships', 'telemetry', 'rawDTDL'].includes(f);
      });
      
      if (missingInDB.length > 0) {
        console.log('❌ Missing in DB:', missingInDB.join(', '));
      }
      if (extraInDB.length > 0) {
        console.log('⚠️  Extra in DB (computed/extracted):', extraInDB.join(', '));
      }
      if (missingInDB.length === 0 && extraInDB.length === 0) {
        console.log('✅ All JSON fields present in DB (plus computed fields)');
      }
      
      // Check contents structure
      console.log('\n📋 Contents Analysis:');
      if (firstTwin.contents) {
        const contentTypes = [...new Set(firstTwin.contents.map((c: any) => c['@type']))];
        console.log('   JSON Contents types:', contentTypes.join(', '));
        
        if (dbDtdl?.contents) {
          const dbContentTypes = [...new Set((dbDtdl.contents as any[]).map((c: any) => c['@type']))];
          console.log('   DB Contents types:', dbContentTypes.join(', '));
          
          if (JSON.stringify(contentTypes.sort()) !== JSON.stringify(dbContentTypes.sort())) {
            console.log('   ⚠️  Content types mismatch!');
          } else {
            console.log('   ✅ Content types match');
          }
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

analyzeMismatches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });


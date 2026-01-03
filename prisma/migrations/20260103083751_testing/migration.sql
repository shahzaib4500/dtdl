-- CreateTable
CREATE TABLE "telemetry_records" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "truckId" TEXT NOT NULL,
    "status" TEXT,
    "payload" DOUBLE PRECISION,
    "speedMph" DOUBLE PRECISION,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "posZ" DOUBLE PRECISION,
    "headingDeg" DOUBLE PRECISION,
    "haulPhase" TEXT,
    "haulPathId" TEXT,
    "engineTemp" DOUBLE PRECISION,
    "fuelLevel" DOUBLE PRECISION,
    "fuelConsumptionRate" DOUBLE PRECISION,
    "brakePedalPos" DOUBLE PRECISION,
    "throttlePos" DOUBLE PRECISION,
    "vibrationLevel" DOUBLE PRECISION,
    "tirePressureFL" DOUBLE PRECISION,
    "tirePressureFR" DOUBLE PRECISION,
    "tirePressureRLO" DOUBLE PRECISION,
    "tirePressureRLI" DOUBLE PRECISION,
    "tirePressureRRO" DOUBLE PRECISION,
    "tirePressureRRI" DOUBLE PRECISION,
    "rawData" JSONB,

    CONSTRAINT "telemetry_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtdl_entities" (
    "id" TEXT NOT NULL,
    "dtdlId" TEXT NOT NULL,
    "dtdlContext" TEXT NOT NULL,
    "dtdlType" TEXT NOT NULL,
    "displayName" TEXT,
    "extends" TEXT,
    "contents" JSONB NOT NULL,
    "components" JSONB,
    "rawDTDL" JSONB,

    CONSTRAINT "dtdl_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_constraints" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "allowedValues" JSONB,

    CONSTRAINT "property_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telemetry_records_truckId_timestamp_idx" ON "telemetry_records"("truckId", "timestamp");

-- CreateIndex
CREATE INDEX "telemetry_records_haulPathId_timestamp_idx" ON "telemetry_records"("haulPathId", "timestamp");

-- CreateIndex
CREATE INDEX "dtdl_entities_dtdlId_idx" ON "dtdl_entities"("dtdlId");

-- CreateIndex
CREATE INDEX "dtdl_entities_displayName_idx" ON "dtdl_entities"("displayName");

-- CreateIndex
CREATE INDEX "property_constraints_entityType_idx" ON "property_constraints"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "property_constraints_entityType_property_key" ON "property_constraints"("entityType", "property");

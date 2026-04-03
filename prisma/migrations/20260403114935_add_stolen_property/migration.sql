-- CreateTable
CREATE TABLE "property_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "identifierTypes" TEXT[],
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stolen_properties" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "propertyTypeId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "description" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerNIN" TEXT,
    "ownerPhone" TEXT,
    "ownerAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "stolenDate" TIMESTAMP(3),
    "stolenLocation" TEXT,
    "circumstances" TEXT,
    "recoveredDate" TIMESTAMP(3),
    "recoveredLocation" TEXT,
    "recoveryNotes" TEXT,
    "stationId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stolen_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_identifiers" (
    "id" TEXT NOT NULL,
    "stolenPropertyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueLower" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_types_name_key" ON "property_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "property_types_slug_key" ON "property_types"("slug");

-- CreateIndex
CREATE INDEX "property_types_active_idx" ON "property_types"("active");

-- CreateIndex
CREATE INDEX "property_types_slug_idx" ON "property_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stolen_properties_referenceNumber_key" ON "stolen_properties"("referenceNumber");

-- CreateIndex
CREATE INDEX "stolen_properties_referenceNumber_idx" ON "stolen_properties"("referenceNumber");

-- CreateIndex
CREATE INDEX "stolen_properties_status_idx" ON "stolen_properties"("status");

-- CreateIndex
CREATE INDEX "stolen_properties_stationId_idx" ON "stolen_properties"("stationId");

-- CreateIndex
CREATE INDEX "stolen_properties_reportedById_idx" ON "stolen_properties"("reportedById");

-- CreateIndex
CREATE INDEX "stolen_properties_propertyTypeId_idx" ON "stolen_properties"("propertyTypeId");

-- CreateIndex
CREATE INDEX "stolen_properties_ownerNIN_idx" ON "stolen_properties"("ownerNIN");

-- CreateIndex
CREATE INDEX "stolen_properties_stolenDate_idx" ON "stolen_properties"("stolenDate");

-- CreateIndex
CREATE INDEX "stolen_properties_stationId_status_idx" ON "stolen_properties"("stationId", "status");

-- CreateIndex
CREATE INDEX "property_identifiers_valueLower_idx" ON "property_identifiers"("valueLower");

-- CreateIndex
CREATE INDEX "property_identifiers_stolenPropertyId_idx" ON "property_identifiers"("stolenPropertyId");

-- CreateIndex
CREATE INDEX "property_identifiers_type_idx" ON "property_identifiers"("type");

-- CreateIndex
CREATE UNIQUE INDEX "property_identifiers_stolenPropertyId_type_value_key" ON "property_identifiers"("stolenPropertyId", "type", "value");

-- AddForeignKey
ALTER TABLE "stolen_properties" ADD CONSTRAINT "stolen_properties_propertyTypeId_fkey" FOREIGN KEY ("propertyTypeId") REFERENCES "property_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stolen_properties" ADD CONSTRAINT "stolen_properties_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stolen_properties" ADD CONSTRAINT "stolen_properties_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "officers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_identifiers" ADD CONSTRAINT "property_identifiers_stolenPropertyId_fkey" FOREIGN KEY ("stolenPropertyId") REFERENCES "stolen_properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

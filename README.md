# Complete Architecture & Flow Analysis
## File-by-File Deep Dive

---

## 📁 **File Structure Overview**

```
src/
├── main.ts                          # Application entry point
├── config/
│   └── env.ts                       # Environment configuration
├── domain/                          # Domain Layer (Pure Business Logic)
│   ├── Entity.ts                    # Core entity model
│   ├── DTDLModel.ts                 # DTDL model manager
│   ├── TelemetryRecord.ts           # Telemetry data model
│   ├── QueryIntent.ts               # Query intent structure
│   ├── CommandIntent.ts             # Command intent structure
│   ├── PropertyInfo.ts              # Property metadata types
│   ├── ResolvedQuery.ts             # Resolved query structure
│   └── errors.ts                    # Domain error classes
├── services/                        # Application Service Layer
│   ├── QueryService.ts              # Query orchestration
│   ├── CommandService.ts            # Command orchestration
│   ├── SchemaResolver.ts            # Schema resolution
│   ├── PropertyResolver.ts          # Property resolution
│   ├── TelemetryService.ts          # Telemetry business logic
│   ├── UpdateValidator.ts           # Update validation
│   └── executors/                   # Tool-based executors
│       ├── IQueryExecutor.ts        # Executor interface
│       ├── QueryExecutorRegistry.ts # Executor registry
│       ├── PropertyExecutor.ts      # Property query executor
│       ├── AggregateExecutor.ts     # Aggregate query executor
│       └── CountExecutor.ts         # Count query executor
├── infrastructure/                  # Infrastructure Layer
│   ├── database/
│   │   └── prisma.ts                # Prisma client
│   ├── langchain/
│   │   └── LangChainService.ts      # LLM integration
│   ├── repositories/                # Data access
│   │   ├── DTDLRepository.ts        # DTDL entity repository
│   │   ├── TelemetryRepository.ts   # Telemetry repository
│   │   └── ConstraintRepository.ts  # Constraint repository
│   └── resolvers/
│       └── EntityResolver.ts        # Entity resolution
├── api/                             # API Layer
│   ├── app.ts                       # Express app setup
│   ├── routes/
│   │   ├── query.ts                 # Query endpoint
│   │   ├── command.ts               # Command endpoint
│   │   ├── health.ts                # Health check
│   │   └── admin.ts                 # Admin endpoints
│   ├── middleware/
│   │   ├── errorHandler.ts          # Error handling
│   │   └── requestLogger.ts         # Request logging
│   └── swagger/
│       └── swagger.config.ts        # API documentation
└── utils/
    └── dataLoader.ts                # Data loading utilities
```

---

## 🚀 **Application Startup Flow**

### **File: `src/main.ts`**

**Purpose**: Application entry point, initializes all components

**Flow**:

```
1. Load environment configuration (config/env.ts)
   ↓
2. Connect to database (Prisma)
   ↓
3. Initialize DTDL Model
   ├─ Check database for entities
   ├─ If empty, load from data/dtdl.json
   ├─ Parse DTDL v2 format → Entity[]
   └─ Save to database
   ↓
4. Initialize Telemetry
   ├─ Check database for records
   ├─ If empty, load from data/telemetry.json
   ├─ Parse JSON → TelemetryRecord[]
   └─ Save to database
   ↓
5. Initialize Constraints
   ├─ Check database for constraints
   └─ If empty, create default constraints
   ↓
6. Initialize Infrastructure
   ├─ LangChainService (LLM)
   ├─ EntityResolver
   ├─ Repositories (Telemetry, DTDL, Constraint)
   ↓
7. Initialize Domain Services
   ├─ TelemetryService
   └─ UpdateValidator
   ↓
8. Initialize Schema Resolution Layer
   ├─ PropertyResolver
   └─ SchemaResolver
   ↓
9. Initialize Query Execution Layer
   └─ QueryExecutorRegistry (with executors)
   ↓
10. Initialize Application Services
    ├─ QueryService
    └─ CommandService
    ↓
11. Create Express App (api/app.ts)
    ↓
12. Start HTTP Server
```

**Key Dependencies**:
- `config/env.ts` - Environment variables
- `infrastructure/database/prisma.ts` - Database connection
- `utils/dataLoader.ts` - File loading
- `api/app.ts` - Express setup

---

## 🔄 **Query Flow (Complete End-to-End)**

### **Example: "What was the average speed of Haul_Truck_CAT_777_2 over the past hour?"**

#### **Step 1: HTTP Request** (`src/api/routes/query.ts`)

```typescript
POST /api/v1/query
Body: { "query": "What was the average speed of Haul_Truck_CAT_777_2 over the past hour?" }
```

**File**: `src/api/routes/query.ts`
- **Purpose**: HTTP endpoint handler
- **Responsibilities**:
  - Validate request body
  - Call `QueryService.executeQuery()`
  - Handle errors and format responses
- **Error Handling**: Catches `DomainError`, provides helpful error messages

#### **Step 2: Intent Extraction** (`src/infrastructure/langchain/LangChainService.ts`)

**File**: `src/infrastructure/langchain/LangChainService.ts`
- **Method**: `parseQuery(input: string) → QueryIntent`
- **Process**:
  1. Create prompt template with instructions
  2. Call LLM (OpenAI/Anthropic) via LangChain
  3. Parse structured output using Zod schema
  4. Convert time window strings to Date objects
- **Output**: `QueryIntent`
  ```typescript
  {
    type: "query",
    questionType: "average_speed",
    targetEntity: "Haul_Truck_CAT_777_2",
    timeWindow: { minutes: 60 }
  }
  ```

**Key Components**:
- `ChatOpenAI` or `ChatAnthropic` - LLM client
- `StructuredOutputParser` - Parses LLM output to structured format
- `PromptTemplate` - Natural language prompt

#### **Step 3: Schema Resolution** (`src/services/SchemaResolver.ts`)

**File**: `src/services/SchemaResolver.ts`
- **Method**: `resolveQuery(intent: QueryIntent) → ResolvedQuery`
- **Process**:
  1. **Entity Resolution** (via `EntityResolver`)
     - Resolves "Haul_Truck_CAT_777_2" → `Entity { id: "Haul_Truck_CAT_777_2", ... }`
     - Uses fuzzy matching, partial matching, type-based matching
  2. **Intent Mapping**
     - Maps `questionType: "average_speed"` → `intent: "aggregate"`
     - Maps to `operation: "average"`
  3. **Property Resolution** (if needed, via `PropertyResolver`)
     - For speed queries, automatically resolves "speed" → "speedMph"
  4. **Build ResolvedQuery**
     - Combines entity, property, operation, time window, filters

**Output**: `ResolvedQuery`
```typescript
{
  intent: "aggregate",
  targetEntity: Entity { id: "Haul_Truck_CAT_777_2", ... },
  property: TelemetryPropertyInfo { name: "speedMph", ... },
  operation: "average",
  timeWindow: { minutes: 60 },
  metadata: { dataSource: "telemetry" }
}
```

**Dependencies**:
- `EntityResolver` - Entity resolution
- `PropertyResolver` - Property resolution
- `DTDLModel` - DTDL model access

#### **Step 4: Telemetry Retrieval** (`src/services/TelemetryService.ts`)

**File**: `src/services/TelemetryService.ts`
- **Method**: `getTelemetry(truckId: string, windowMinutes: number) → TelemetryRecord[]`
- **Process**:
  1. Calculate time window (startTime, endTime)
  2. Call repository to query database
  3. Return telemetry records

**File**: `src/infrastructure/repositories/TelemetryRepository.ts`
- **Method**: `findByTruckAndTimeWindow(truckId, startTime, endTime)`
- **Process**:
  1. Prisma query: `prisma.telemetryRecord.findMany({ where: { truckId, timestamp: { gte, lte } } })`
  2. Map database records to domain `TelemetryRecord[]`
  3. Return sorted by timestamp

**Output**: `TelemetryRecord[]` (array of telemetry records)

#### **Step 5: Executor Selection** (`src/services/executors/QueryExecutorRegistry.ts`)

**File**: `src/services/executors/QueryExecutorRegistry.ts`
- **Method**: `getExecutor(resolvedQuery: ResolvedQuery) → IQueryExecutor`
- **Process**:
  1. Iterate through registered executors
  2. Call `executor.canHandle(resolvedQuery.intent)`
  3. Return first matching executor

**Registered Executors**:
- `PropertyExecutor` - Handles `"get_property"`, `"current"`
- `AggregateExecutor` - Handles `"aggregate"`
- `CountExecutor` - Handles `"count"`

**Result**: `AggregateExecutor` (matches `intent: "aggregate"`)

#### **Step 6: Query Execution** (`src/services/executors/AggregateExecutor.ts`)

**File**: `src/services/executors/AggregateExecutor.ts`
- **Method**: `execute(resolvedQuery: ResolvedQuery, telemetry: TelemetryRecord[]) → QueryResult`
- **Process**:
  1. Determine field to aggregate: `"speedMph"` (from property)
  2. Extract values from telemetry: `[1.12, 2.24, 1.8, ...]` (mph)
  3. Convert to km/h: `[1.80, 3.60, 2.90, ...]` (multiply by 1.60934)
  4. Calculate average: `sum(values) / values.length`
  5. Return result with units and metadata

**Output**: `QueryResult`
```typescript
{
  value: 24.3,
  units: "km/h",
  metadata: { recordCount: 3600, timeWindow: { minutes: 60 } }
}
```

#### **Step 7: Response Formatting** (`src/services/QueryService.ts`)

**File**: `src/services/QueryService.ts`
- **Method**: `formatResponse(result, resolvedQuery, recordCount) → QueryResponse`
- **Process**:
  1. Generate natural language answer
  2. Format value and units
  3. Include metadata (recordCount, timeWindow)
  4. Return structured response

**Output**: `QueryResponse`
```json
{
  "answer": "Haul_Truck_CAT_777_2 had an average speed of 24.3 km/h over the past 60 minutes (based on 3600 records).",
  "value": 24.3,
  "units": "km/h",
  "entityId": "Haul_Truck_CAT_777_2",
  "entityName": "Haul_Truck_CAT_777_2",
  "dataUsed": {
    "recordCount": 3600,
    "timeWindow": { "minutes": 60 }
  }
}
```

#### **Step 8: HTTP Response** (`src/api/routes/query.ts`)

**File**: `src/api/routes/query.ts`
- Returns JSON response to client
- Handles errors via `errorHandler` middleware

---

## 🔧 **Command Flow (Complete End-to-End)**

### **Example: "Set the focusSnapDistanceMeters of Haul_Truck_CAT_777_2 to 300"**

#### **Step 1: HTTP Request** (`src/api/routes/command.ts`)

```typescript
POST /api/v1/command
Body: { "command": "Set the focusSnapDistanceMeters of Haul_Truck_CAT_777_2 to 300" }
```

**File**: `src/api/routes/command.ts`
- **Purpose**: HTTP endpoint handler
- **Responsibilities**:
  - Validate request body
  - Call `CommandService.executeCommand()`
  - Handle errors and format responses

#### **Step 2: Intent Extraction** (`src/infrastructure/langchain/LangChainService.ts`)

**File**: `src/infrastructure/langchain/LangChainService.ts`
- **Method**: `parseCommand(input: string) → CommandIntent`
- **Process**:
  1. Create prompt template
  2. Call LLM via LangChain
  3. Parse structured output
- **Output**: `CommandIntent`
  ```typescript
  {
    type: "command",
    action: "set",
    targetEntity: "Haul_Truck_CAT_777_2",
    property: "focusSnapDistanceMeters",
    value: 300
  }
  ```

#### **Step 3: Schema Resolution** (`src/services/SchemaResolver.ts`)

**File**: `src/services/SchemaResolver.ts`
- **Method**: `resolveCommand(intent: CommandIntent) → ResolvedCommand`
- **Process**:
  1. **Entity Resolution** (via `EntityResolver`)
     - Resolves "Haul_Truck_CAT_777_2" → `Entity`
  2. **Property Resolution** (via `PropertyResolver`)
     - Resolves "focusSnapDistanceMeters" → `DTDLPropertyInfo`
     - **Key**: Searches DTDL `contents` array for `@type="Property"` with `name="focusSnapDistanceMeters"`
     - Returns property metadata (type, schema, value, initialValue)
  3. **Validate Property Source**
     - Ensures property is from DTDL (not telemetry)
     - Telemetry properties cannot be modified
  4. **Build ResolvedCommand**

**Output**: `ResolvedCommand`
```typescript
{
  action: "set",
  targetEntities: [Entity { id: "Haul_Truck_CAT_777_2", ... }],
  property: DTDLPropertyInfo { name: "focusSnapDistanceMeters", type: "number", ... },
  value: 300,
  scope: "single"
}
```

#### **Step 4: Validation** (`src/services/UpdateValidator.ts`)

**File**: `src/services/UpdateValidator.ts`
- **Method**: `validate(entity, property, newValue) → ValidationResult`
- **Validations**:
  1. **Property Existence**: Check property exists in entity
  2. **Editability**: Check property is not read-only
  3. **Type Validation**: Check value type matches property type
  4. **Range Validation**: Check value is within min/max constraints
  5. **Allowed Values**: Check value is in allowed values list (if defined)

**File**: `src/infrastructure/repositories/ConstraintRepository.ts`
- **Method**: `getConstraint(entityType, property) → Constraint`
- **Process**: Query database for property constraints

**Output**: `ValidationResult`
```typescript
{
  valid: true  // or false with error message
}
```

#### **Step 5: Update Application** (`src/services/CommandService.ts`)

**File**: `src/services/CommandService.ts`
- **Method**: `applyUpdates(entities, property, value) → UpdateResult[]`
- **Process**:
  1. **Update In-Memory Model** (via `DTDLModel.updateEntityProperty()`)
     - Updates `entity.properties[property].value = 300`
     - Updates `entity.contents[].value = 300` (source of truth)
  2. **Persist to Database** (via `DTDLRepository.save()`)
     - Upserts entity with updated `contents` array
     - Database stores `contents`, not `properties`

**File**: `src/domain/DTDLModel.ts`
- **Method**: `updateEntityProperty(entityId, property, value) → UpdateResult`
- **Process**:
  1. Get entity from in-memory Map
  2. Update `properties[property].value`
  3. Update `contents[]` array (find Property object, update value)
  4. Return `UpdateResult` with old/new values

**File**: `src/infrastructure/repositories/DTDLRepository.ts`
- **Method**: `save(entity: Entity) → void`
- **Process**:
  1. Prisma upsert: `prisma.dTDLEntity.upsert({ where: { id }, create/update: { contents } })`
  2. Stores complete `contents` array (source of truth)

**Output**: `UpdateResult[]`
```typescript
[{
  success: true,
  entityId: "Haul_Truck_CAT_777_2",
  property: "focusSnapDistanceMeters",
  oldValue: 200,
  newValue: 300
}]
```

#### **Step 6: Response Formatting** (`src/services/CommandService.ts`)

**File**: `src/services/CommandService.ts`
- **Method**: `formatResponse(updates, errors) → CommandResponse`
- **Process**:
  1. Separate successful and failed updates
  2. Generate natural language message
  3. Include all updates and errors
  4. Return structured response

**Output**: `CommandResponse`
```json
{
  "success": true,
  "updates": [{
    "entityId": "Haul_Truck_CAT_777_2",
    "property": "focusSnapDistanceMeters",
    "oldValue": 200,
    "newValue": 300
  }],
  "message": "Updated Haul_Truck_CAT_777_2.focusSnapDistanceMeters: 200 → 300"
}
```

#### **Step 7: HTTP Response** (`src/api/routes/command.ts`)

**File**: `src/api/routes/command.ts`
- Returns JSON response to client

---

## 🏗️ **Architecture Layers Deep Dive**

### **Layer 1: Domain Layer** (Pure Business Logic)

#### **`src/domain/Entity.ts`**
- **Purpose**: Core domain model for DTDL entities
- **Key Types**:
  - `Entity` - Complete entity structure
  - `PropertyValue` - Property value with constraints
  - `PropertyConstraints` - Validation constraints
  - `UpdateResult` - Update operation result
- **Key Insight**: Separates stored fields (`contents`, `dtdlId`) from computed fields (`properties`, `relationships`)

#### **`src/domain/DTDLModel.ts`**
- **Purpose**: Manages digital twin model structure
- **Key Methods**:
  - `getEntity(id)` - Get entity by ID
  - `getEntitiesByType(type)` - Filter by type
  - `getRelatedEntities(entityId)` - Get related entities
  - `updateEntityProperty(id, property, value)` - Update property
- **Storage**: In-memory `Map<string, Entity>`
- **Key Insight**: Updates both `properties` (for access) and `contents` (source of truth)

#### **`src/domain/QueryIntent.ts`**
- **Purpose**: Structured representation of query intent
- **Key Types**:
  - `QueryIntent` - Raw intent from LLM
  - `QueryResponse` - Formatted response
  - `QuestionType` - Enum of question types
  - `TimeWindow` - Time range specification

#### **`src/domain/CommandIntent.ts`**
- **Purpose**: Structured representation of command intent
- **Key Types**:
  - `CommandIntent` - Raw intent from LLM
  - `CommandResponse` - Formatted response
  - `UpdateResult` - Individual update result

#### **`src/domain/ResolvedQuery.ts`**
- **Purpose**: Query intent resolved against schema
- **Key Types**:
  - `ResolvedQuery` - Resolved query with schema info
  - `ResolvedCommand` - Resolved command with schema info
- **Key Insight**: Contains resolved entities, properties, operations, filters

#### **`src/domain/PropertyInfo.ts`**
- **Purpose**: Property metadata types
- **Key Types**:
  - `PropertyInfo` - Union of DTDL and telemetry properties
  - `DTDLPropertyInfo` - DTDL property metadata
  - `TelemetryPropertyInfo` - Telemetry property metadata
  - `PropertyResolutionResult` - Property resolution result

#### **`src/domain/errors.ts`**
- **Purpose**: Domain-specific error classes
- **Key Classes**:
  - `DomainError` - Base domain error
  - `EntityNotFoundError` - Entity not found
  - `ValidationError` - Validation failure
  - `PropertyNotEditableError` - Property read-only
  - `PropertyNotFoundError` - Property not found
  - `InvalidValueError` - Invalid value

---

### **Layer 2: Application Service Layer**

#### **`src/services/QueryService.ts`**
- **Purpose**: Orchestrates query execution
- **Dependencies**:
  - `LangChainService` - Intent extraction
  - `SchemaResolver` - Schema resolution
  - `TelemetryService` - Telemetry queries
  - `QueryExecutorRegistry` - Executor selection
- **Flow**:
  1. Parse intent (LLM)
  2. Resolve against schema
  3. Get telemetry data
  4. Select executor
  5. Execute query
  6. Format response

#### **`src/services/CommandService.ts`**
- **Purpose**: Orchestrates command execution
- **Dependencies**:
  - `LangChainService` - Intent extraction
  - `SchemaResolver` - Schema resolution
  - `DTDLModel` - Model updates
  - `UpdateValidator` - Validation
  - `DTDLRepository` - Persistence
- **Flow**:
  1. Parse intent (LLM)
  2. Resolve against schema
  3. Validate updates
  4. Apply updates
  5. Persist to database
  6. Format response

#### **`src/services/SchemaResolver.ts`**
- **Purpose**: Resolves intents against DTDL/telemetry schema
- **Dependencies**:
  - `EntityResolver` - Entity resolution
  - `PropertyResolver` - Property resolution
  - `DTDLModel` - Model access
- **Key Methods**:
  - `resolveQuery(intent)` - Resolve query intent
  - `resolveCommand(intent)` - Resolve command intent
  - `mapQuestionTypeToIntent(questionType)` - Map to generic intent

#### **`src/services/PropertyResolver.ts`**
- **Purpose**: Resolves property names from natural language
- **Key Feature**: Uses DTDL `contents` array as source of truth (Requirement B)
- **Methods**:
  - `resolveProperty(entity, name)` - Resolve property
  - `findPropertyInDTDL(entity, name)` - Search DTDL contents
  - `findPropertyInTelemetry(name)` - Search telemetry schema
  - `getAllProperties(entity)` - Get all available properties
- **Matching Strategies**:
  - Exact match
  - Fuzzy match (via variations)
  - Partial match
  - Levenshtein distance

#### **`src/services/TelemetryService.ts`**
- **Purpose**: Telemetry business logic
- **Dependencies**: `ITelemetryRepository`
- **Methods**:
  - `getTelemetry(truckId, windowMinutes)` - Get telemetry records
  - `getTelemetryByPath(pathId, windowMinutes)` - Get by path
  - `calculateAverageSpeed(records)` - Calculate average
  - `calculateMaxSpeed(records)` - Calculate maximum
  - `calculateMinSpeed(records)` - Calculate minimum
  - `countTrips(records, source, dest)` - Count trips
  - `calculateRouteUtilization(records, minutes)` - Calculate utilization

#### **`src/services/UpdateValidator.ts`**
- **Purpose**: Validates property updates
- **Dependencies**: `IConstraintRepository`
- **Validations**:
  1. Property existence
  2. Editability (read-only check)
  3. Type validation
  4. Range validation (min/max)
  5. Allowed values validation

#### **`src/services/executors/QueryExecutorRegistry.ts`**
- **Purpose**: Manages and selects query executors
- **Registered Executors**:
  - `PropertyExecutor` - Property queries
  - `AggregateExecutor` - Aggregate queries
  - `CountExecutor` - Count queries
- **Method**: `getExecutor(resolvedQuery)` - Select executor by intent

#### **`src/services/executors/PropertyExecutor.ts`**
- **Purpose**: Handles property value queries
- **Handles**: `"get_property"`, `"current"` intents
- **Process**:
  - For DTDL properties: Get from entity
  - For telemetry properties: Get from most recent record
  - Convert units (e.g., speedMph → km/h)

#### **`src/services/executors/AggregateExecutor.ts`**
- **Purpose**: Handles aggregate queries
- **Handles**: `"aggregate"` intent
- **Operations**: average, max, min, sum
- **Process**:
  - Extract values from telemetry
  - Convert units (speedMph → km/h)
  - Perform aggregation
  - Return result with metadata

#### **`src/services/executors/CountExecutor.ts`**
- **Purpose**: Handles count queries
- **Handles**: `"count"` intent
- **Process**:
  - Count trips between paths
  - Count trips on a path
  - Count all path entries

---

### **Layer 3: Infrastructure Layer**

#### **`src/infrastructure/langchain/LangChainService.ts`**
- **Purpose**: LLM integration
- **Dependencies**: `@langchain/openai`, `@langchain/anthropic`
- **Methods**:
  - `parseQuery(input)` - Parse query to QueryIntent
  - `parseCommand(input)` - Parse command to CommandIntent
- **Technology**: LangChain with structured output parsing

#### **`src/infrastructure/resolvers/EntityResolver.ts`**
- **Purpose**: Resolves natural language entity references
- **Methods**:
  - `resolve(reference, model)` - Resolve single entity
  - `resolveBulk(reference, model, filter)` - Resolve multiple entities
- **Matching Strategies**:
  - Exact match
  - Case-insensitive match
  - Partial match
  - Type-based match
  - Fuzzy match

#### **`src/infrastructure/repositories/TelemetryRepository.ts`**
- **Purpose**: Data access for telemetry
- **Implements**: `ITelemetryRepository`
- **Methods**:
  - `findByTruckAndTimeWindow()` - Query by truck and time
  - `findByRouteAndTimeWindow()` - Query by route and time
  - `create()` - Create single record
  - `createMany()` - Create multiple records
- **Technology**: Prisma ORM

#### **`src/infrastructure/repositories/DTDLRepository.ts`**
- **Purpose**: Data access for DTDL entities
- **Implements**: `IDTDLRepository`
- **Methods**:
  - `findAll()` - Get all entities
  - `findById()` - Get by ID
  - `findByType()` - Get by type
  - `save()` - Upsert entity
  - `saveMany()` - Upsert multiple entities
- **Key Insight**: Stores `contents` array (source of truth), computes `properties` on-the-fly

#### **`src/infrastructure/repositories/ConstraintRepository.ts`**
- **Purpose**: Data access for property constraints
- **Implements**: `IConstraintRepository`
- **Methods**:
  - `getConstraint(entityType, property)` - Get constraint
  - `getAllConstraints()` - Get all constraints
  - `saveConstraint(constraint)` - Save constraint

#### **`src/infrastructure/database/prisma.ts`**
- **Purpose**: Prisma client singleton
- **Exports**: `prisma` - PrismaClient instance

---

### **Layer 4: API Layer**

#### **`src/api/app.ts`**
- **Purpose**: Express application setup
- **Responsibilities**:
  - Configure middleware (CORS, JSON parsing, logging)
  - Setup Swagger documentation
  - Register routes
  - Setup error handling
- **Key Features**:
  - Trust proxy (for Render)
  - Dynamic Swagger URL detection
  - CORS support

#### **`src/api/routes/query.ts`**
- **Purpose**: Query endpoint handler
- **Route**: `POST /api/v1/query`
- **Process**:
  1. Validate request body
  2. Call `QueryService.executeQuery()`
  3. Return JSON response
  4. Handle errors

#### **`src/api/routes/command.ts`**
- **Purpose**: Command endpoint handler
- **Route**: `POST /api/v1/command`
- **Process**:
  1. Validate request body
  2. Call `CommandService.executeCommand()`
  3. Return JSON response
  4. Handle errors

#### **`src/api/routes/health.ts`**
- **Purpose**: Health check endpoint
- **Route**: `GET /api/v1/health`
- **Returns**: `{ status: "ok" }`

#### **`src/api/routes/admin.ts`**
- **Purpose**: Admin endpoints
- **Routes**:
  - `GET /api/v1/admin/timestamps/check` - Check timestamp status
  - `POST /api/v1/admin/timestamps/update` - Update timestamps

#### **`src/api/middleware/errorHandler.ts`**
- **Purpose**: Global error handling
- **Process**:
  - Catches `DomainError` → 400 status
  - Catches other errors → 500 status
  - Logs errors

#### **`src/api/middleware/requestLogger.ts`**
- **Purpose**: Request logging
- **Logs**: Method, path, status, duration

#### **`src/api/swagger/swagger.config.ts`**
- **Purpose**: Swagger/OpenAPI documentation
- **Features**:
  - Dynamic server URL detection
  - API endpoint documentation
  - Request/response schemas

---

### **Layer 5: Utilities**

#### **`src/utils/dataLoader.ts`**
- **Purpose**: Load data from files
- **Functions**:
  - `loadDTDLFromFile(filePath)` - Load DTDL from JSON
  - `loadTelemetryFromCSV(filePath)` - Load telemetry from CSV
  - `loadTelemetryFromJSON(filePath)` - Load telemetry from JSON
- **Key Feature**: Converts DTDL v2 format to Entity format

#### **`src/config/env.ts`**
- **Purpose**: Environment configuration
- **Features**:
  - Zod schema validation
  - Type-safe configuration
  - Default values
  - Provider-specific validation

---

## 🔄 **Data Flow Diagrams**

### **Query Flow**

```
User Query
  ↓
HTTP POST /api/v1/query
  ↓
query.ts (Route Handler)
  ↓
QueryService.executeQuery()
  ├─ LangChainService.parseQuery() → QueryIntent
  ├─ SchemaResolver.resolveQuery() → ResolvedQuery
  │   ├─ EntityResolver.resolve() → Entity
  │   └─ PropertyResolver.resolveProperty() → PropertyInfo
  ├─ TelemetryService.getTelemetry() → TelemetryRecord[]
  │   └─ TelemetryRepository.findByTruckAndTimeWindow()
  │       └─ Prisma Query → Database
  ├─ QueryExecutorRegistry.getExecutor() → IQueryExecutor
  ├─ Executor.execute() → QueryResult
  └─ formatResponse() → QueryResponse
  ↓
HTTP JSON Response
```

### **Command Flow**

```
User Command
  ↓
HTTP POST /api/v1/command
  ↓
command.ts (Route Handler)
  ↓
CommandService.executeCommand()
  ├─ LangChainService.parseCommand() → CommandIntent
  ├─ SchemaResolver.resolveCommand() → ResolvedCommand
  │   ├─ EntityResolver.resolveBulk() → Entity[]
  │   └─ PropertyResolver.resolveProperty() → DTDLPropertyInfo
  ├─ UpdateValidator.validate() → ValidationResult
  │   └─ ConstraintRepository.getConstraint() → Constraint
  ├─ DTDLModel.updateEntityProperty() → UpdateResult
  │   ├─ Update entity.properties[property].value
  │   └─ Update entity.contents[].value (source of truth)
  └─ DTDLRepository.save() → Persist to Database
      └─ Prisma Upsert → Database
  ↓
HTTP JSON Response
```

---

## 🎯 **Key Design Patterns**

### **1. Clean Architecture**
- **Separation**: 4 distinct layers (API, Services, Domain, Infrastructure)
- **Dependency Direction**: Outer layers depend on inner layers
- **Domain Independence**: Domain layer has no external dependencies

### **2. Repository Pattern**
- **Abstraction**: `ITelemetryRepository`, `IDTDLRepository`, `IConstraintRepository`
- **Implementation**: `PrismaTelemetryRepository`, `PrismaDTDLRepository`, `PrismaConstraintRepository`
- **Benefit**: Easy to swap implementations (e.g., in-memory for testing)

### **3. Strategy Pattern** (Executors)
- **Interface**: `IQueryExecutor`
- **Implementations**: `PropertyExecutor`, `AggregateExecutor`, `CountExecutor`
- **Registry**: `QueryExecutorRegistry` manages and selects executors
- **Benefit**: Extensible without modifying core code

### **4. Dependency Injection**
- **Constructor Injection**: All services receive dependencies via constructor
- **Example**: `QueryService(langChainService, schemaResolver, telemetryService, executorRegistry)`
- **Benefit**: Testable, maintainable, flexible

### **5. Schema-Driven Resolution**
- **PropertyResolver**: Uses DTDL `contents` array as source of truth
- **No Hardcoding**: Properties resolved dynamically from schema
- **Benefit**: Works with any DTDL model without code changes

---

## 📊 **Component Interaction Matrix**

| Component | Depends On | Used By |
|-----------|-----------|---------|
| `QueryService` | LangChainService, SchemaResolver, TelemetryService, QueryExecutorRegistry | query.ts |
| `CommandService` | LangChainService, SchemaResolver, DTDLModel, UpdateValidator, DTDLRepository | command.ts |
| `SchemaResolver` | EntityResolver, PropertyResolver, DTDLModel | QueryService, CommandService |
| `PropertyResolver` | (None - pure logic) | SchemaResolver |
| `EntityResolver` | (None - pure logic) | SchemaResolver |
| `TelemetryService` | ITelemetryRepository | QueryService, Executors |
| `UpdateValidator` | IConstraintRepository | CommandService |
| `QueryExecutorRegistry` | TelemetryService | QueryService |
| `LangChainService` | @langchain/openai, @langchain/anthropic | QueryService, CommandService |
| `PrismaTelemetryRepository` | Prisma | TelemetryService |
| `PrismaDTDLRepository` | Prisma | CommandService, main.ts |
| `PrismaConstraintRepository` | Prisma | UpdateValidator |

---

## 🔑 **Key Architectural Decisions**

### **1. Why Schema-Driven Property Resolution?**
- **Requirement B**: Must use DTDL model as source of truth
- **Benefit**: No hardcoded mappings, works with any DTDL model
- **Implementation**: `PropertyResolver.findPropertyInDTDL()` searches `contents` array

### **2. Why Tool-Based Executors?**
- **Stretch #2**: Minimal internal tool schema
- **Benefit**: Extensible, testable, maintainable
- **Implementation**: `QueryExecutorRegistry` with pluggable executors

### **3. Why Update Both Properties and Contents?**
- **Properties**: Fast in-memory access
- **Contents**: Source of truth, stored in database
- **Benefit**: Immediate access + correct persistence

### **4. Why Separate ResolvedQuery from QueryIntent?**
- **QueryIntent**: Raw intent from LLM (natural language references)
- **ResolvedQuery**: Resolved against schema (DTDL entities, properties)
- **Benefit**: Clear separation of concerns, type safety

### **5. Why Repository Pattern?**
- **Abstraction**: Services depend on interfaces, not implementations
- **Benefit**: Easy to swap implementations, testable
- **Example**: Can use in-memory repository for testing

---

## 🎓 **Complete Flow Summary**

### **Query: "What was the average speed of Haul_Truck_CAT_777_2 over the past hour?"**

1. **HTTP Request** → `query.ts`
2. **Intent Extraction** → `LangChainService.parseQuery()` → `QueryIntent`
3. **Schema Resolution** → `SchemaResolver.resolveQuery()` → `ResolvedQuery`
   - Entity: "Haul_Truck_CAT_777_2" → `Entity`
   - Property: "speed" → `TelemetryPropertyInfo { name: "speedMph" }`
   - Intent: "average_speed" → "aggregate" with operation "average"
4. **Telemetry Retrieval** → `TelemetryService.getTelemetry()` → `TelemetryRecord[]`
   - Repository: `findByTruckAndTimeWindow("Haul_Truck_CAT_777_2", startTime, endTime)`
   - Database: Prisma query → 3600 records
5. **Executor Selection** → `QueryExecutorRegistry.getExecutor()` → `AggregateExecutor`
6. **Query Execution** → `AggregateExecutor.execute()` → `QueryResult`
   - Extract speedMph values
   - Convert to km/h
   - Calculate average: 24.3 km/h
7. **Response Formatting** → `QueryService.formatResponse()` → `QueryResponse`
8. **HTTP Response** → JSON to client

### **Command: "Set the focusSnapDistanceMeters of Haul_Truck_CAT_777_2 to 300"**

1. **HTTP Request** → `command.ts`
2. **Intent Extraction** → `LangChainService.parseCommand()` → `CommandIntent`
3. **Schema Resolution** → `SchemaResolver.resolveCommand()` → `ResolvedCommand`
   - Entity: "Haul_Truck_CAT_777_2" → `Entity`
   - Property: "focusSnapDistanceMeters" → `DTDLPropertyInfo` (from DTDL contents)
4. **Validation** → `UpdateValidator.validate()` → `ValidationResult`
   - Property exists ✓
   - Property is editable ✓
   - Value type is number ✓
   - Value is within range (0-10000) ✓
5. **Update Application** → `DTDLModel.updateEntityProperty()` → `UpdateResult`
   - Update `properties["focusSnapDistanceMeters"].value = 300`
   - Update `contents[].value = 300` (source of truth)
6. **Persistence** → `DTDLRepository.save()` → Database
   - Prisma upsert with updated `contents` array
7. **Response Formatting** → `CommandService.formatResponse()` → `CommandResponse`
8. **HTTP Response** → JSON to client

---

## ✅ **Architecture Compliance**

### **Requirement A: Natural-Language Query Handling** ✅
- **Implementation**: `QueryService` → `LangChainService` → `SchemaResolver` → `Executor`
- **Files**: `QueryService.ts`, `LangChainService.ts`, `SchemaResolver.ts`, Executors

### **Requirement B: DTDL-Based Property Resolution** ✅
- **Implementation**: `PropertyResolver.findPropertyInDTDL()` searches `contents` array
- **Files**: `PropertyResolver.ts`, `SchemaResolver.ts`

### **Requirement C: Safety/Guardrails** ✅
- **Implementation**: `UpdateValidator` with multi-layer validation
- **Files**: `UpdateValidator.ts`, `ConstraintRepository.ts`

### **Requirement D: Clear Separation of Concerns** ✅
- **Implementation**: 4-layer clean architecture
- **Files**: All files organized by layer

### **Stretch #1: Bulk Updates** ✅
- **Implementation**: `EntityResolver.resolveBulk()` with relationship traversal
- **Files**: `EntityResolver.ts`, `CommandService.ts`

### **Stretch #2: Tool-Based Architecture** ✅
- **Implementation**: `QueryExecutorRegistry` with pluggable executors
- **Files**: `QueryExecutorRegistry.ts`, Executors

### **Stretch #3: Explainability** ✅
- **Implementation**: `dataUsed`, `updates` array, natural language messages
- **Files**: `QueryService.ts`, `CommandService.ts`

---

## 🎯 **Summary**

This codebase implements a **production-ready, clean architecture** with:

1. **4-Layer Separation**: API → Services → Domain → Infrastructure
2. **Schema-Driven**: Uses DTDL model as source of truth
3. **Tool-Based**: Pluggable executors for extensibility
4. **Type-Safe**: Full TypeScript with runtime validation
5. **Testable**: Dependency injection, repository pattern
6. **Maintainable**: Clear responsibilities, SOLID principles
7. **Extensible**: Easy to add new query types, executors, properties

**Every file has a clear purpose and follows the architecture principles!** 🎉


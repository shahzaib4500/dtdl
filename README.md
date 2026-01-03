# DTDL AI Challenge

AI-driven digital twin platform for mine sites using DTDL (Digital Twin Definition Language) and telemetry data.

## Overview

This system provides:
- **Natural Language Query Processing**: Answer questions about mine equipment using DTDL models and telemetry data
- **Natural Language Command Processing**: Update DTDL model properties via natural language commands with validation
- **RESTful API**: Express-based API for integration

## Architecture

The system follows a clean architecture with clear separation of concerns:

- **Domain Layer**: Core business logic, entities, and domain models
- **Application Service Layer**: Orchestrates domain operations
- **Infrastructure Layer**: External integrations (LangChain, PostgreSQL, Prisma)
- **API Layer**: Express routes and middleware

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Tech Stack

- **TypeScript**: Type-safe development
- **Node.js**: Runtime environment
- **Express**: Web framework
- **LangChain**: LLM integration and structured output parsing
- **PostgreSQL**: Database for telemetry and DTDL entities
- **Prisma**: ORM and database migrations
- **Zod**: Runtime validation and schema definition

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- OpenAI API key OR Anthropic API key

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dtdl_challenge"
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4
PORT=3000
```

### 3. Setup Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Load Sample Data (Optional)

Place your DTDL model in `data/dtdl-model.json` and telemetry data in `data/telemetry.json` or `data/telemetry.csv`.

The system will automatically load data from these files on first startup if the database is empty.

### 5. Start Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

## API Endpoints

### Health Check

```bash
GET /api/v1/health
```

### Query (Natural Language)

```bash
POST /api/v1/query
Content-Type: application/json

{
  "query": "What was the average speed of truck 56 over the past hour?"
}
```

**Response:**
```json
{
  "answer": "Truck 56 had an average speed of 24.3 km/h over the past 60 minutes (based on 12 records).",
  "value": 24.3,
  "units": "km/h",
  "entityId": "Truck_56",
  "entityName": "Truck_56",
  "dataUsed": {
    "recordCount": 12,
    "timeWindow": {
      "minutes": 60
    }
  }
}
```

### Command (Natural Language)

```bash
POST /api/v1/command
Content-Type: application/json

{
  "command": "Set the speed limit of truck 56 to 32 km/h"
}
```

**Response:**
```json
{
  "success": true,
  "updates": [
    {
      "success": true,
      "entityId": "Truck_56",
      "property": "maxSpeedKph",
      "oldValue": 40.0,
      "newValue": 32.0
    }
  ],
  "message": "Updated Truck_56.maxSpeedKph: 40 → 32"
}
```

## Example Queries

### Speed Queries
- "What was the average speed of truck 56 over the past hour?"
- "What was the maximum speed of truck 56 today?"
- "What was the minimum speed of truck 57 over the past 30 minutes?"

### Trip Queries
- "How many trips did truck 56 make from Loader A to Stockpile 1 today?"

### Route Queries
- "What is the route utilization for Route 1 over the past hour?"

## Example Commands

### Single Entity Updates
- "Set the speed limit of truck 56 to 32 km/h"
- "Update truck 56's max speed to 35 km/h"
- "Change the payload of truck 57 to 250 tonnes"

### Bulk Updates (Stretch Goal)
- "For all trucks on Route 1, set max speed to 35 km/h"
- "Reduce max speed by 10 percent for all CAT 793 trucks"

## Data Format

### DTDL Model Format

```json
[
  {
    "id": "Truck_56",
    "type": "HaulTruck",
    "properties": {
      "maxSpeedKph": {
        "value": 40.0,
        "type": "number",
        "editable": true,
        "constraints": {
          "min": 0,
          "max": 100
        }
      }
    },
    "relationships": {
      "assignedRoute": "Route_1"
    }
  }
]
```

### Telemetry Format (JSON)

```json
[
  {
    "timestamp": "2024-01-15T10:00:00Z",
    "truckId": "Truck_56",
    "speed": 24.5,
    "position": { "lat": -23.5, "lon": 117.2 },
    "direction": "North",
    "routeId": "Route_1"
  }
]
```

### Telemetry Format (CSV)

```csv
timestamp,truckId,speed,lat,lon,direction,routeId
2024-01-15T10:00:00Z,Truck_56,24.5,-23.5,117.2,North,Route_1
```

## Validation & Safety

The system includes validation rules:

- **Property Existence**: Checks if property exists on entity
- **Editability**: Validates if property can be modified
- **Value Constraints**: Enforces min/max values and allowed values
- **Type Validation**: Ensures value types match property definitions

Invalid commands are rejected with clear error messages.

## Project Structure

```
dtdl-ai-challenge/
├── src/
│   ├── api/              # Express routes and middleware
│   ├── config/           # Configuration management
│   ├── domain/           # Domain models and business logic
│   ├── infrastructure/    # External integrations
│   │   ├── database/     # Prisma client
│   │   ├── langchain/    # LLM integration
│   │   ├── repositories/ # Data access layer
│   │   └── resolvers/     # Entity resolution
│   ├── services/         # Application services
│   ├── utils/            # Utility functions
│   └── main.ts           # Entry point
├── prisma/
│   └── schema.prisma     # Database schema
├── data/                 # Sample data files
├── ARCHITECTURE.md       # Architecture documentation
└── README.md
```

## Deployment (Render)

### Using render.yaml (Recommended)

The project includes a `render.yaml` file for easy deployment:

1. **Connect your GitHub repo** to Render
2. **Render will automatically detect** the `render.yaml` file
3. **Set environment variables** in Render dashboard:
   - `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` if using Anthropic)
4. **Deploy** - Render will automatically:
   - Install dependencies with `npm ci`
   - Build TypeScript with `npm run build`
   - Generate Prisma client
   - Run database migrations
   - Start the server

### Manual Configuration

If you need to configure manually in Render dashboard:

**Build Command:**
```bash
npm ci && npm run build && npx prisma generate && npx prisma migrate deploy
```

**Start Command:**
```bash
node dist/main.js
```

**Important Notes:**
- Use **npm** (not yarn) - the project uses `package-lock.json`
- Ensure the build command includes `npm run build` to compile TypeScript
- The start command should be `node dist/main.js` (not `npm start` which might have issues)
- Make sure `DATABASE_URL` is set (Render can auto-link if using render.yaml)

### Environment Variables

Required in Render dashboard:
- `DATABASE_URL` - PostgreSQL connection string (auto-set if using render.yaml database)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` - LLM API key
- `LLM_PROVIDER` - `openai` or `anthropic`
- `LLM_MODEL` - Model name (e.g., `gpt-4`, `gpt-3.5-turbo`, `claude-3-opus`)
- `PORT` - Server port (default: 3000, Render sets this automatically)
- `NODE_ENV` - Set to `production`

## Development

### Running Tests

```bash
npm test
```

### Database Studio

```bash
npm run db:studio
```

### Linting

```bash
npm run lint
```

## Key Design Decisions

1. **Clean Architecture**: Separation of concerns with domain, service, infrastructure, and API layers
2. **Type Safety**: TypeScript throughout with Zod for runtime validation
3. **Repository Pattern**: Abstracted data access for testability
4. **Structured Output Parsing**: LangChain structured outputs for reliable LLM parsing
5. **Validation Layer**: Comprehensive validation before applying updates

## Assumptions

- DTDL model is provided in JSON format
- Telemetry data is in CSV or JSON format
- LLM API is available and accessible
- PostgreSQL database is set up and accessible
- Entity IDs follow a consistent naming pattern (e.g., `Truck_56`)

## Future Enhancements

- Bulk update support with relationship traversal
- Explainability: Show reasoning chain
- WebSocket support for real-time updates
- GraphQL API alternative
- Authentication and authorization
- Rate limiting
- Monitoring and observability

## License

MIT


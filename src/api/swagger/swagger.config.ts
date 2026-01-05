/**
 * Swagger/OpenAPI Configuration
 */

import swaggerJsdoc from "swagger-jsdoc";
import { config } from "../../config/env.js";

// Determine base URL - use BASE_URL env var, or fallback to localhost
const getBaseUrl = (): string => {
  if (config.BASE_URL) {
    return config.BASE_URL;
  }
  // For production, try to detect from RENDER environment
  if (config.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  // Default to localhost for development
  return `http://localhost:${config.PORT}`;
};

const baseUrl = getBaseUrl();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DTDL AI Challenge API",
      version: "1.0.0",
      description: `
AI-driven digital twin platform for mine sites using DTDL (Digital Twin Definition Language) and telemetry data.

## Features

- **Natural Language Query Processing**: Answer questions about mine equipment using DTDL models and telemetry data
- **Natural Language Command Processing**: Update DTDL model properties via natural language commands with validation
- **Safety & Validation**: Comprehensive validation rules to prevent invalid updates

## Authentication

Currently no authentication required. In production, add API keys or OAuth.

## Base URL

\`${baseUrl}\`
      `,
      contact: {
        name: "API Support",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: baseUrl,
        description: config.NODE_ENV === "production" ? "Production server" : "Development server",
      },
    ],
    tags: [
      {
        name: "Admin",
        description: "Administrative endpoints for managing telemetry data",
      },
      {
        name: "Health",
        description: "Health check endpoints",
      },
      {
        name: "Query",
        description: "Natural language query processing",
      },
      {
        name: "Command",
        description: "Natural language command processing",
      },
    ],
    components: {
      schemas: {
        QueryRequest: {
          type: "object",
          required: ["query"],
          properties: {
            query: {
              type: "string",
              description: "Natural language query about mine equipment",
              example: "What was the average speed of truck 56 over the past hour?",
            },
          },
        },
        QueryResponse: {
          type: "object",
          properties: {
            answer: {
              type: "string",
              description: "Human-readable answer to the query",
              example: "Truck 56 had an average speed of 24.3 km/h over the past 60 minutes (based on 12 records).",
            },
            value: {
              type: "number",
              description: "Numeric value of the result",
              example: 24.3,
            },
            units: {
              type: "string",
              description: "Units of the value",
              example: "km/h",
            },
            entityId: {
              type: "string",
              description: "DTDL entity ID that was queried",
              example: "Truck_56",
            },
            entityName: {
              type: "string",
              description: "Human-readable entity name",
              example: "Truck_56",
            },
            dataUsed: {
              type: "object",
              properties: {
                recordCount: {
                  type: "number",
                  description: "Number of telemetry records used",
                  example: 12,
                },
                timeWindow: {
                  type: "object",
                  properties: {
                    minutes: {
                      type: "number",
                      example: 60,
                    },
                  },
                },
              },
            },
          },
        },
        CommandRequest: {
          type: "object",
          required: ["command"],
          properties: {
            command: {
              type: "string",
              description: "Natural language command to update DTDL model",
              example: "Set the speed limit of truck 56 to 32 km/h",
            },
          },
        },
        UpdateResult: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            entityId: {
              type: "string",
              example: "Truck_56",
            },
            property: {
              type: "string",
              example: "maxSpeedKph",
            },
            oldValue: {
              type: "number",
              example: 40.0,
            },
            newValue: {
              type: "number",
              example: 32.0,
            },
            error: {
              type: "string",
              nullable: true,
            },
          },
        },
        CommandResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the command was successfully executed",
              example: true,
            },
            updates: {
              type: "array",
              items: {
                $ref: "#/components/schemas/UpdateResult",
              },
            },
            message: {
              type: "string",
              description: "Human-readable message about the result",
              example: "Updated Truck_56.maxSpeedKph: 40 → 32",
            },
            errors: {
              type: "array",
              items: {
                type: "string",
              },
              nullable: true,
              description: "Array of error messages if any updates failed",
            },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              example: "2024-01-15T10:30:00.000Z",
            },
            service: {
              type: "string",
              example: "DTDL AI Challenge",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            code: {
              type: "string",
              description: "Error code",
              example: "ENTITY_NOT_FOUND",
            },
          },
        },
      },
    },
  },
  apis: ["./src/api/routes/*.ts", "./src/api/swagger/*.ts"], // Paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);


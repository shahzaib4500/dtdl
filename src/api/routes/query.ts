/**
 * API: Query Routes
 * Handles natural language query requests
 */

import { Router, Request, Response } from "express";
import { QueryService } from "../../services/QueryService.js";
import { DomainError } from "../../domain/errors.js";

const router = Router();

/**
 * @swagger
 * /api/v1/query:
 *   post:
 *     summary: Execute a natural language query
 *     description: |
 *       Processes a natural language question about mine equipment and returns structured results.
 *       
 *       **Supported Query Types:**
 *       - Average speed: "What was the average speed of truck 56 over the past hour?"
 *       - Maximum speed: "What was the maximum speed of truck 56 today?"
 *       - Minimum speed: "What was the minimum speed of truck 57 over the past 30 minutes?"
 *       - Trip count: "How many trips did truck 56 make from Loader A to Stockpile 1 today?"
 *       - Route utilization: "What is the route utilization for Route 1 over the past hour?"
 *     tags: [Query]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryRequest'
 *           examples:
 *             averageSpeed:
 *               summary: Average speed query
 *               value:
 *                 query: "What was the average speed of truck 56 over the past hour?"
 *             maxSpeed:
 *               summary: Maximum speed query
 *               value:
 *                 query: "What was the maximum speed of truck 56 today?"
 *             tripCount:
 *               summary: Trip count query
 *               value:
 *                 query: "How many trips did truck 56 make from Loader A to Stockpile 1 today?"
 *     responses:
 *       200:
 *         description: Query executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QueryResponse'
 *             example:
 *               answer: "Truck 56 had an average speed of 24.3 km/h over the past 60 minutes (based on 12 records)."
 *               value: 24.3
 *               units: "km/h"
 *               entityId: "Truck_56"
 *               entityName: "Truck_56"
 *               dataUsed:
 *                 recordCount: 12
 *                 timeWindow:
 *                   minutes: 60
 *       400:
 *         description: Bad request - Invalid query or entity not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: "Entity 'truck 99' not found"
 *               code: "ENTITY_NOT_FOUND"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */

export function createQueryRouter(queryService: QueryService): Router {
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== "string") {
        return res.status(400).json({
          error: "Invalid request. 'query' field is required and must be a string.",
        });
      }

      const result = await queryService.executeQuery(query);

      return res.json(result);
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(400).json({
          error: error.message,
          code: error.code,
        });
      }

      // Check if the error indicates a command was sent to query endpoint
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("command") ||
        errorMessage.includes("set") ||
        errorMessage.includes("update") ||
        errorMessage.includes("change") ||
        errorMessage.includes("does not fit into any of the question types")
      ) {
        return res.status(400).json({
          error: "This appears to be a command, not a query. Please use the /api/v1/command endpoint instead.",
          code: "INVALID_REQUEST_TYPE",
          suggestion: "Use POST /api/v1/command for commands like 'Set the focusSnapDistanceMeters of all haul trucks to 250'",
        });
      }

      console.error("Query error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: errorMessage,
      });
    }
  });

  return router;
}

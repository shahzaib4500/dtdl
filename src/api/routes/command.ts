/**
 * API: Command Routes
 * Handles natural language command requests
 */

import { Router, Request, Response } from "express";
import { CommandService } from "../../services/CommandService.js";
import { DomainError } from "../../domain/errors.js";

const router = Router();

/**
 * @swagger
 * /api/v1/command:
 *   post:
 *     summary: Execute a natural language command
 *     description: |
 *       Processes a natural language command to update DTDL model properties with validation.
 *       
 *       **Supported Commands:**
 *       - Single entity update: "Set the speed limit of truck 56 to 32 km/h"
 *       - Property update: "Update truck 56's max speed to 35 km/h"
 *       - Bulk update: "For all trucks on Route 1, set max speed to 35 km/h"
 *       
 *       **Validation:**
 *       - Property must exist on the entity
 *       - Property must be editable (not read-only)
 *       - Value must be within allowed constraints (min/max)
 *       - Value type must match property type
 *     tags: [Command]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommandRequest'
 *           examples:
 *             singleUpdate:
 *               summary: Single entity update
 *               value:
 *                 command: "Set the speed limit of truck 56 to 32 km/h"
 *             bulkUpdate:
 *               summary: Bulk update
 *               value:
 *                 command: "For all trucks on Route 1, set max speed to 35 km/h"
 *             invalidValue:
 *               summary: Invalid value (will be rejected)
 *               value:
 *                 command: "Set truck 56 speed to -10 km/h"
 *     responses:
 *       200:
 *         description: Command executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommandResponse'
 *             example:
 *               success: true
 *               updates:
 *                 - success: true
 *                   entityId: "Truck_56"
 *                   property: "maxSpeedKph"
 *                   oldValue: 40.0
 *                   newValue: 32.0
 *               message: "Updated Truck_56.maxSpeedKph: 40 → 32"
 *       400:
 *         description: Bad request - Invalid command, validation error, or entity not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidProperty:
 *                 value:
 *                   error: "Property 'invalidProperty' does not exist on entity 'Truck_56'"
 *                   code: "PROPERTY_NOT_FOUND"
 *               readOnly:
 *                 value:
 *                   error: "Property 'id' is not editable"
 *                   code: "PROPERTY_NOT_EDITABLE"
 *               invalidValue:
 *                 value:
 *                   error: "Invalid value '-10' for property 'maxSpeedKph': Value -10 is below minimum 0"
 *                   code: "INVALID_VALUE"
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

export function createCommandRouter(commandService: CommandService): Router {
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { command } = req.body;

      if (!command || typeof command !== "string") {
        return res.status(400).json({
          error: "Invalid request. 'command' field is required and must be a string.",
        });
      }

      const result = await commandService.executeCommand(command);

      return res.json(result);
    } catch (error) {
      if (error instanceof DomainError) {
        return res.status(400).json({
          error: error.message,
          code: error.code,
        });
      }

      console.error("Command error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}

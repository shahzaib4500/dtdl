/**
 * Service: Command Service
 * Orchestrates command execution flow using schema-driven architecture
 * 
 * Architecture:
 * 1. Intent Extraction (LLM) - Extract command intent
 * 2. Schema Resolution - Resolve against DTDL schema (Requirement B)
 * 3. Validation - Validate against constraints
 * 4. Execution - Apply updates to DTDL model and persist
 * 
 * This implements:
 * - Requirement B: Uses DTDL model for property identification
 * - Requirement C: Safety/guardrails with validation
 * - Requirement D: Clear separation of concerns
 */

import type { LangChainService } from "../infrastructure/langchain/LangChainService.js";
import type { DTDLModel } from "../domain/DTDLModel.js";
import type { UpdateValidator } from "./UpdateValidator.js";
import type { CommandResponse, UpdateResult } from "../domain/CommandIntent.js";
import type { IDTDLRepository } from "../infrastructure/repositories/DTDLRepository.js";
import type { SchemaResolver } from "./SchemaResolver.js";
import { DomainError } from "../domain/errors.js";

export class CommandService {
  constructor(
    private langChainService: LangChainService,
    private schemaResolver: SchemaResolver,
    private dtdlModel: DTDLModel,
    private validator: UpdateValidator,
    private dtdlRepository: IDTDLRepository
  ) {}

  /**
   * Execute a natural language command
   * 
   * Flow:
   * 1. Extract intent from natural language (LLM)
   * 2. Resolve intent against DTDL schema (SchemaResolver) - Requirement B
   * 3. Validate updates against constraints (UpdateValidator) - Requirement C
   * 4. Apply updates to DTDL model and persist
   */
  async executeCommand(userInput: string): Promise<CommandResponse> {
    try {
      // 1. Parse natural language to CommandIntent (LLM)
      const intent = await this.langChainService.parseCommand(userInput);

      // 2. Resolve intent against DTDL schema (SchemaResolver)
      // This uses DTDL model to resolve entities and properties (Requirement B)
      const resolvedCommand = this.schemaResolver.resolveCommand(intent);

      // 3. Validate each update against constraints (Requirement C)
      const validationResults = await Promise.all(
        resolvedCommand.targetEntities.map((entity) =>
          this.validator.validate(
            entity,
            resolvedCommand.property.name,
            resolvedCommand.value
          )
        )
      );

      // 4. Filter out invalid updates
      const validEntities = resolvedCommand.targetEntities.filter(
        (_, index) => validationResults[index].valid
      );
      const errors = validationResults
        .map((result, index) =>
          result.valid
            ? null
            : `${resolvedCommand.targetEntities[index].id}: ${result.error}`
        )
        .filter((e): e is string => e !== null);

      // 5. Apply updates to DTDL model and persist
      const updates = await this.applyUpdates(
        validEntities,
        resolvedCommand.property.name,
        resolvedCommand.value
      );

      // 6. Return response
      return this.formatResponse(updates, errors);
    } catch (error) {
      // Handle domain errors gracefully
      if (error instanceof DomainError) {
        return {
          success: false,
          updates: [],
          message: error.message,
          errors: [error.message],
        };
      }
      throw error;
    }
  }

  // Note: Property name mapping is now handled by PropertyResolver
  // which uses DTDL model as source of truth (Requirement B)

  /**
   * Apply updates to entities
   * 
   * Updates both in-memory model and persists to database.
   * 
   * Flow:
   * 1. Update in-memory DTDLModel (updates both properties and contents array)
   * 2. Persist updated entity to database via repository
   * 3. Handle errors gracefully (log but don't fail entire batch)
   */
  private async applyUpdates(
    entities: any[],
    property: string,
    value: any
  ): Promise<UpdateResult[]> {
    const updates: UpdateResult[] = [];

    for (const entity of entities) {
      // 1. Update in-memory model (updates both properties and contents array)
      const result = this.dtdlModel.updateEntityProperty(
        entity.id,
        property,
        value
      );
      
      // 2. If update was successful, persist to database
      if (result.success) {
        try {
          const updatedEntity = this.dtdlModel.getEntity(entity.id);
          if (updatedEntity) {
            // Persist the updated entity to database
            // The repository will upsert the entity, updating the contents array
            await this.dtdlRepository.save(updatedEntity);
          } else {
            // This shouldn't happen, but handle gracefully
            console.error(
              `Entity '${entity.id}' not found in model after update. This indicates a synchronization issue.`
            );
            result.success = false;
            result.error = "Entity not found after update";
          }
        } catch (error) {
          // Database persistence failed
          // Log the error but don't fail the entire operation
          // The in-memory update succeeded, so we return partial success
          console.error(
            `Failed to persist update for entity '${entity.id}':`,
            error instanceof Error ? error.message : String(error)
          );
          result.success = false;
          result.error = `Database persistence failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      
      updates.push(result);
    }

    return updates;
  }

  /**
   * Format response
   */
  private formatResponse(
    updates: UpdateResult[],
    errors: string[]
  ): CommandResponse {
    const successful = updates.filter((u) => u.success);
    const failed = updates.filter((u) => !u.success);

    let message = "";
    if (successful.length > 0) {
      if (successful.length === 1) {
        const update = successful[0];
        message = `Updated ${update.entityId}.${update.property}: ${update.oldValue} → ${update.newValue}`;
      } else {
        message = `Successfully updated ${successful.length} entit${successful.length === 1 ? "y" : "ies"}`;
      }
    }

    const allErrors: string[] = [];
    if (failed.length > 0 || errors.length > 0) {
      allErrors.push(
        ...failed.map((u) => u.error || "Unknown error"),
        ...errors
      );
      message += `\n${allErrors.length} error${allErrors.length === 1 ? "" : "s"}: ${allErrors.join("; ")}`;
    }

    return {
      success: successful.length > 0,
      updates,
      message,
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  }
}


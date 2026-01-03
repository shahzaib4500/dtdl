/**
 * Infrastructure: LangChain Service
 * Handles LLM integration using LangChain
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import type { BaseOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import { config } from "../../config/env.js";
import type { QueryIntent } from "../../domain/QueryIntent.js";
import type { CommandIntent } from "../../domain/CommandIntent.js";

// Zod schemas for structured output
const queryIntentSchema = z.object({
  type: z.literal("query"),
  questionType: z.enum([
    "average_speed",
    "current_speed",
    "trip_count",
    "route_utilization",
    "max_speed",
    "min_speed",
    "property",
  ]),
  targetEntity: z.string().describe("The entity being queried (e.g., 'truck 56')"),
  timeWindow: z.object({
    minutes: z.number().describe("Time window in minutes (use 1 minute for current_speed and property queries)"),
    startTime: z.string().optional().describe("ISO timestamp if specified"),
    endTime: z.string().optional().describe("ISO timestamp if specified"),
  }),
  sourcePath: z.string().optional().describe("Source path/route for trip_count queries (e.g., 'path_1', 'Route_1', 'Loader_A')"),
  destinationPath: z.string().optional().describe("Destination path/route for trip_count queries (e.g., 'path_1', 'Stockpile_1')"),
  propertyName: z.string().optional().describe("Property name for property queries (e.g., 'haulPathId', 'status', 'engineTemp', 'fuelLevel', 'payload')"),
});

const commandIntentSchema = z.object({
  type: z.literal("command"),
  action: z.enum(["set", "update", "change"]),
  targetEntity: z.string().describe("The entity being modified (e.g., 'truck 56')"),
  property: z.string().describe("The property name in natural language (e.g., 'speed limit')"),
  value: z.union([z.number(), z.string(), z.boolean()]).describe("The new value"),
  scope: z.enum(["single", "bulk"]).optional().describe("Whether this affects one or multiple entities"),
  filter: z
    .object({
      type: z.string().optional(),
      relationship: z
        .object({
          name: z.string(),
          targetId: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export class LangChainService {
  private llm: ChatOpenAI | ChatAnthropic;
  private queryParser: BaseOutputParser<QueryIntent>;
  private commandParser: BaseOutputParser<CommandIntent>;

  constructor() {
    // Initialize LLM based on provider
    if (config.LLM_PROVIDER === "anthropic") {
      this.llm = new ChatAnthropic({
        anthropicApiKey: config.ANTHROPIC_API_KEY!,
        modelName: config.LLM_MODEL,
        temperature: config.LLM_TEMPERATURE,
      });
    } else {
      this.llm = new ChatOpenAI({
        openAIApiKey: config.OPENAI_API_KEY!,
        modelName: config.LLM_MODEL,
        temperature: config.LLM_TEMPERATURE,
      });
    }

    // Initialize parsers - cast schemas to any to avoid TypeScript type compatibility issues with LangChain's InteropZodType
    this.queryParser = StructuredOutputParser.fromZodSchema(queryIntentSchema as any) as BaseOutputParser<QueryIntent>;
    this.commandParser = StructuredOutputParser.fromZodSchema(commandIntentSchema as any) as BaseOutputParser<CommandIntent>;
  }

  /**
   * Parse natural language query into structured QueryIntent
   */
  async parseQuery(input: string): Promise<QueryIntent> {
    const formatInstructions = this.queryParser.getFormatInstructions();

    const prompt = PromptTemplate.fromTemplate(`
You are an AI assistant that parses questions about mine equipment and telemetry data.

Parse the following question and extract:
1. Question type: 
   - "average_speed" for average speed over a time period
   - "current_speed" for the most recent/current speed (use 1 minute time window)
   - "trip_count" for number of trips (extract source and destination paths if mentioned)
   - "route_utilization" for route usage
   - "max_speed" for maximum speed
   - "min_speed" for minimum speed
   - "property" for queries about specific properties/attributes (e.g., "What is the haul path ID?", "What is the status?", "What is the engine temperature?")
2. Target entity (e.g., "truck 56", "Truck_56", "loader A", "Haul_Truck_CAT_777_2")
   - For route_utilization questions, if the question mentions a path/route (e.g., "path_1", "Route_1"), extract it as sourcePath and use "ALL" as targetEntity
   - For route_utilization, targetEntity can be "ALL" to query all trucks on a path
3. Time window (convert phrases like "past hour" to minutes, use 1 minute for "current" and "property" queries)
4. For trip_count questions, extract:
   - sourcePath: The starting path/route (e.g., "path_1", "Route_1", "Loader_A")
   - destinationPath: The destination path/route (e.g., "path_1", "Stockpile_1")
   - If only one path is mentioned (e.g., "trips from path_1"), use it as sourcePath
   - Path names can be: "path_1", "path_2", "Route_1", "Loader_A", "Stockpile_1", etc.
5. For route_utilization questions, extract:
   - sourcePath: The path/route being queried (e.g., "path_1", "Route_1")
   - If a path is mentioned in the question, extract it as sourcePath
   - Path names can be: "path_1", "path_2", "Route_1", etc.
5. For property questions, extract:
   - propertyName: The property being queried (e.g., "haulPathId" for "haul path ID", "status" for "status", "engineTemp" for "engine temperature", "fuelLevel" for "fuel level")
   - Common property mappings:
     * "haul path ID" / "haul path" / "path ID" → "haulPathId"
     * "status" → "status"
     * "engine temperature" / "engine temp" → "engineTemp"
     * "fuel level" → "fuelLevel"
     * "payload" → "payload"
     * "heading" → "headingDeg"
     * "position" / "pos" → "posX" (or ask for clarification)

Question: {input}

{format_instructions}
`);

    const chain = prompt.pipe(this.llm).pipe(this.queryParser);

    try {
      const result = await chain.invoke({ 
        input,
        format_instructions: formatInstructions 
      }) as any;
      
      // Convert time window strings to dates if provided
      const timeWindow = {
        minutes: result.timeWindow.minutes,
        startTime: result.timeWindow.startTime
          ? new Date(result.timeWindow.startTime)
          : undefined,
        endTime: result.timeWindow.endTime
          ? new Date(result.timeWindow.endTime)
          : undefined,
      };

      return {
        type: "query",
        questionType: result.questionType,
        targetEntity: result.targetEntity,
        timeWindow,
        sourcePath: result.sourcePath,
        destinationPath: result.destinationPath,
        propertyName: result.propertyName,
      };
    } catch (error) {
      console.error("Error parsing query:", error);
      throw new Error(`Failed to parse query: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Parse natural language command into structured CommandIntent
   */
  async parseCommand(input: string): Promise<CommandIntent> {
    const formatInstructions = this.commandParser.getFormatInstructions();

    const prompt = PromptTemplate.fromTemplate(`
You are an AI assistant that parses commands to update mine equipment properties.

Parse the following command and extract:
1. Action (set, update, change)
2. Target entity (e.g., "truck 56", "all trucks on Route 1")
3. Property name in natural language (e.g., "speed limit", "max speed", "payload")
4. New value (extract number, string, or boolean)
5. Scope (single entity or bulk update)
6. Filter conditions if bulk update (type, relationship)

Command: {input}

{format_instructions}
`);

    const chain = prompt.pipe(this.llm).pipe(this.commandParser);

    try {
      const result = await chain.invoke({ 
        input,
        format_instructions: formatInstructions 
      }) as any;
      return {
        type: "command",
        action: result.action,
        targetEntity: result.targetEntity,
        property: result.property,
        value: result.value,
        scope: result.scope,
        filter: result.filter,
      };
    } catch (error) {
      console.error("Error parsing command:", error);
      throw new Error(`Failed to parse command: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}


/**
 * Environment configuration
 * Centralized configuration management with validation
 */

import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // LLM Configuration
  LLM_PROVIDER: z.enum(["openai", "anthropic"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-4"),
  LLM_TEMPERATURE: z.coerce.number().default(0),
  
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BASE_URL: z.string().optional(), // Base URL for API (e.g., https://your-app.onrender.com)
  
  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

type Env = z.infer<typeof envSchema>;

let config: Env;

try {
  config = envSchema.parse(process.env);
  
  // Validate API key is present for selected provider
  if (config.LLM_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER is 'openai'");
  }
  
  if (config.LLM_PROVIDER === "anthropic" && !config.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER is 'anthropic'");
  }
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid environment configuration:");
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { config };
export type { Env };


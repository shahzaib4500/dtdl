/**
 * API: Express Application Setup
 */

import express, { Express, Request, Response, NextFunction } from "express";
import swaggerUi from "swagger-ui-express";
import { createQueryRouter } from "./routes/query.js";
import { createCommandRouter } from "./routes/command.js";
import healthRouter from "./routes/health.js";
import adminRouter from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { QueryService } from "../services/QueryService.js";
import { CommandService } from "../services/CommandService.js";
import { swaggerSpec } from "./swagger/swagger.config.js";

export function createApp(
  queryService: QueryService,
  commandService: CommandService
): Express {
  const app = express();

  // Trust proxy (for Render and other reverse proxies)
  // This ensures req.protocol and req.get("host") work correctly
  app.set("trust proxy", 1);

  // CORS middleware
  app.use((req: Request, res: Response, next: NextFunction): void => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    
    next();
  });

  // Middleware
  app.use(express.json());
  app.use(requestLogger);

  // Swagger Documentation
  // Dynamically set server URL based on request host
  app.use("/api-docs", swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
    // Detect protocol correctly (handles Render's proxy)
    const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    const host = req.get("host") || req.get("x-forwarded-host") || `localhost:${process.env.PORT || 3000}`;
    const serverUrl = `${protocol}://${host}`;
    
    const swaggerSpecWithHost = {
      ...swaggerSpec,
      servers: [
        {
          url: serverUrl,
          description: "Current server",
        },
      ],
    };
    swaggerUi.setup(swaggerSpecWithHost, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "DTDL AI Challenge API Documentation",
      customfavIcon: "/favicon.ico",
    })(req, res, next);
  });

  // Routes
  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/query", createQueryRouter(queryService));
  app.use("/api/v1/command", createCommandRouter(commandService));
  app.use("/api/v1/admin", adminRouter);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}


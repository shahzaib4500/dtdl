/**
 * API: Error Handling Middleware
 */

import { Request, Response, NextFunction } from "express";
import { DomainError } from "../../domain/errors.js";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof DomainError) {
    return res.status(400).json({
      error: err.message,
      code: err.code,
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}


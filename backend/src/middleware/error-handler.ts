import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  const message = error instanceof Error ? error.message : "Unexpected server error";

  console.error(error);
  response.status(500).json({
    error: {
      message: "Internal server error"
    }
  });

  if (process.env.NODE_ENV !== "production") {
    console.error(message);
  }
};

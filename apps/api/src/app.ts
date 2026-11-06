// Author(s): Sophia Koshy
// Start date: 2026-11-05
// Last updated: 2026-11-06
// P4: Prototype 
// Purpose: builds the Fastify app and receives the repository through dependency injection

import Fastify from "fastify";
import cors from "@fastify/cors";

import type { ChartRepository } from "../repositories/ChartRepository";
import { config } from "../config";

export function buildApp(repository: ChartRepository) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  app.register(cors, {
    origin: config.corsOrigin,
  });

  // List all charts
  app.get("/charts", async () => {
    return repository.listCharts();
  });

  // Get one chart
  app.get<{ Params: { id: number } }>(
    "/charts/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "integer",
              minimum: 1,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const chart = await repository.getChartById(
        request.params.id
      );

      if (!chart) {
        return reply.code(404).send({
          error: "Chart not found",
        });
      }

      return chart;
    }
  );

  return app;
}

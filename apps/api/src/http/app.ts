// Author(s): Sophia Koshy & Kaitlyn Clevidence
// Start date: 2026-11-05
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: builds the Fastify app and receives the repositories through kysely

import Fastify from "fastify";
import cors from "@fastify/cors";

import type { ChartRepository } from "../repositories/ChartRepository.js";
import type { PatientRepository } from "../repositories/PatientRepository.js";
import { config } from "../config/index.js";


export interface Repositories {
  charts: ChartRepository;
  patients: PatientRepository;
}

export function buildApp(repositories: Repositories) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
  });

  app.register(cors, {
    origin: config.corsOrigin,
  });

  // List all charts
  app.get("/charts", async () => {
    return repositories.charts.listCharts();
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
      const chart = await repositories.charts.getChartById(
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

  // Get one patient
  app.get<{ Params: { id: number } }>(
    "/patients/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "integer", minimum: 1 } },
        },
      },
    },
    async (request, reply) => {
      const patient = await repositories.patients.getPatientById(
        request.params.id
      );

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      return patient;
    }
  );

  // List all charts for one patient
  app.get<{ Params: { id: number } }>(
    "/patients/:id/charts",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "integer", minimum: 1 } },
        },
      },
    },
    async (request, reply) => {
      const patient = await repositories.patients.getPatientById(
        request.params.id
      );

      if (!patient) {
        return reply.code(404).send({ error: "Patient not found" });
      }

      return repositories.charts.listChartsByPatientId(request.params.id);
    }
  );

  return app;
}

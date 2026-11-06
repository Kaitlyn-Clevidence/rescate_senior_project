// Author(s): Sophia Koshy
// Start date: 2026-11-05
// Last updated: 2026-11-05
// P4: Prototype 
// Purpose: builds the Fastify app and receives the repository through dependency injection

import Fastify from "fastify";
import cors from "@fastify/cors";

export interface PatientRepository {
  getPatientById(id: number): Promise<unknown | undefined>;
}

export function buildApp(repository: PatientRepository) {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: "http://localhost:5173",
  });

  app.get<{ Params: { id: number } }>(
    "/api/patients/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "integer" },
          },
        },
      },
    },
    async (request, reply) => {
      const id = request.params.id;

      const patient = await repository.getPatientById(id);

      if (!patient) {
        return reply.code(404).send({
          error: "Patient not found",
        });
      }

      return reply.code(200).send(patient);
    }
  );

  return app;
}

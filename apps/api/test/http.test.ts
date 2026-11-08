// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: tests the HTTP routes of the API app using a fake in-memory repository

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, type Repositories } from "../src/http/app.js";
import type { Chart } from "../src/repositories/ChartRepository.js";
import type { Patient } from "../src/repositories/PatientRepository.js";

const chart1: Chart = {
  chart_id: 1,
  encounter_date: new Date("2024-01-15T18:00:00.000Z"),
  nature_of_call: "B/P check",
  patient_name: "Izzy Sullivan",
};
const chart2: Chart = {
  chart_id: 2,
  encounter_date: new Date("2024-02-20T22:30:00.000Z"),
  nature_of_call: "Vehicle Accident",
  patient_name: "Aidan Madonna",
};
const aidan: Patient = {
  patient_id: 3,
  first_name: "Aidan",
  last_name: "Madonna",
  birth_date: new Date("1985-08-20T12:00:00.000Z"),
  gender: "M",
};
const izzy: Patient = {
  patient_id: 4,
  first_name: "Izzy",
  last_name: "Sullivan",
  birth_date: null,
  gender: "F",
};

function makeRepositories(): Repositories {
  const charts = [chart1, chart2];
  const patients = [aidan, izzy];
  return {
    charts: {
      listCharts: async () => [chart2, chart1],
      getChartById: async (id) => charts.find((c) => c.chart_id === id),
      listChartsByPatientId: async (patientId) =>
        patientId === 3 ? [chart2] : [],
    },
    patients: {
      getPatientById: async (id) => patients.find((p) => p.patient_id === id),
    },
  };
}

let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  app = buildApp(makeRepositories());
});

afterEach(async () => {
  await app.close();
});

describe("GET /charts", () => {
  it("returns every chart as JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/charts" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
    expect(res.json()[0]).toMatchObject({ chart_id: 2, patient_name: "Aidan Madonna" });
  });

  it("serializes dates as ISO text", async () => {
    const res = await app.inject({ method: "GET", url: "/charts" });

    expect(res.json()[1].encounter_date).toBe("2024-01-15T18:00:00.000Z");
  });
});

describe("GET /charts/:id", () => {
  it("returns one chart", async () => {
    const res = await app.inject({ method: "GET", url: "/charts/1" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ chart_id: 1, nature_of_call: "B/P check" });
  });

  it("returns 404 for a chart that does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/charts/999" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Chart not found" });
  });

  it.each(["abc", "0", "-5", "1.5"])("rejects the bad id %s with 400", async (id) => {
    const res = await app.inject({ method: "GET", url: `/charts/${id}` });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /patients/:id", () => {
  it("returns one patient", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/3" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ patient_id: 3, first_name: "Aidan" });
  });

  it("returns null for a missing birth date", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/4" });

    expect(res.json().birth_date).toBeNull();
  });

  it("returns 404 for a patient that does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/999" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Patient not found" });
  });

  it.each(["abc", "0", "-1"])("rejects the bad id %s with 400", async (id) => {
    const res = await app.inject({ method: "GET", url: `/patients/${id}` });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /patients/:id/charts", () => {
  it("returns all charts for the patient", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/3/charts" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      expect.objectContaining({ chart_id: 2, nature_of_call: "Vehicle Accident" }),
    ]);
  });

  it("returns an empty list for a patient with no charts", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/4/charts" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns 404 when the patient does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/999/charts" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Patient not found" });
  });

  it("rejects a bad id with 400", async () => {
    const res = await app.inject({ method: "GET", url: "/patients/abc/charts" });

    expect(res.statusCode).toBe(400);
  });
});

describe("routing and CORS", () => {
  it("returns 404 for an unknown route", async () => {
    const res = await app.inject({ method: "GET", url: "/nope" });

    expect(res.statusCode).toBe(404);
  });

  it("allows the configured web origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/charts",
      headers: { origin: "http://localhost:5173" },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not allow any other origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/charts",
      headers: { origin: "http://evil.example" },
    });

    // the header may only ever name the configured origin, never echo the caller's or use *
    expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.example");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// Updated: 11-17-2026
// P5: MVP
// Purpose: tests the section registry, which decides which chart sections
// are required for each call type, nature of call, and checkbox combination.

import { describe, expect, it } from "vitest";
import { NATURES_OF_CALL } from "../src/domain/Chart.js";
import {
  allowedSections,
  requiredSections,
  SHORT_FORM_NATURES,
  usesFullChart,
} from "../src/domain/sections.js";

const short = { transport: false, full_chart: false };

describe("section registry", () => {
  it("B/P check short form: clinic block, crew, vitals, consent", () => {
    expect(requiredSections("clinic", "bp_check", short)).toEqual([
      "clinic", "crew", "vitals", "consent_forms",
    ]);
  });

  it("injection short form: crew, allergies, medications, consent", () => {
    expect(requiredSections("clinic", "injection", short)).toEqual([
      "clinic", "crew", "chart_patient_info", "medications_given", "consent_forms",
    ]);
  });

  it("minor wound short form needs wound care", () => {
    expect(requiredSections("clinic", "minor_wound", short)).toContain("wound_care");
  });

  it("suture removal short form needs wound care", () => {
    expect(requiredSections("clinic", "suture_removal", short)).toContain("wound_care");
  });

  it("ticking full chart on a short-form nature gives the full chart", () => {
    expect(
      requiredSections("clinic", "bp_check", { transport: false, full_chart: true })
    ).toEqual(["clinic", "crew", "chart_patient_info", "vitals", "consent_forms"]);
  });

  it("natures without a short form are always the full chart", () => {
    expect(usesFullChart("clinic", "cardiac", false)).toBe(true);
    expect(requiredSections("clinic", "cardiac", short)).toContain("chart_patient_info");
  });

  it("obstetrics only when the nature is OB", () => {
    expect(requiredSections("clinic", "ob", short)).toContain("obstetrics");
    expect(requiredSections("clinic", "cardiac", short)).not.toContain("obstetrics");
  });

  it("transport only when the checkbox is on", () => {
    const on = { transport: true, full_chart: false };
    expect(requiredSections("clinic", "bp_check", on)).toContain("transport");
    expect(requiredSections("clinic", "bp_check", short)).not.toContain("transport");
  });

  it("ambulance always uses the full chart, for any nature", () => {
    expect(usesFullChart("ambulance", "bp_check", false)).toBe(true);
    expect(
      requiredSections("ambulance", "significant_injury_or_illness", short)
    ).toEqual(["ambulance", "crew", "chart_patient_info", "vitals", "consent_forms"]);
  });

  it("never offers the clinic block on an ambulance chart", () => {
    expect(allowedSections("ambulance")).not.toContain("clinic");
    expect(allowedSections("clinic")).not.toContain("ambulance");
  });
});

describe("the 25 natures of call", () => {
  it("has 25 natures with no duplicates", () => {
    expect(NATURES_OF_CALL).toHaveLength(25);
    expect(new Set(NATURES_OF_CALL).size).toBe(25);
  });

  it("gives these 13 natures a short form", () => {
    expect([...SHORT_FORM_NATURES].sort()).toEqual(
      [
        "bp_check", "injection", "minor_wound", "suture_removal",
        "abd_pain", "animal_bite_sting", "burn", "fall", "assault",
        "industrial_accident", "mental_health", "drugs_alcohol", "diabetic_problem",
      ].sort()
    );
  });

  it.each([
    "stroke", "cardiac_arrest_death", "drowning",
    "stab_gun_shot", "seizure", "vehicle_accident",
  ] as const)("%s is always the full chart", (nature) => {
    expect(usesFullChart("clinic", nature, false)).toBe(true);
  });

  it("abd pain short form: baseline, patient info, vitals, physical exam", () => {
    expect([...requiredSections("clinic", "abd_pain", short)].sort()).toEqual(
      ["clinic", "crew", "chart_patient_info", "vitals", "physical_exam", "consent_forms"].sort()
    );
  });

  it("burn short form: baseline, patient info, vitals, wound care, burn assessment", () => {
    expect([...requiredSections("clinic", "burn", short)].sort()).toEqual(
      [
        "clinic", "crew", "chart_patient_info", "vitals", "wound_care",
        "assessments", "consent_forms",
      ].sort()
    );
  });

  it("diabetic problem short form includes medications given", () => {
    expect(requiredSections("clinic", "diabetic_problem", short)).toEqual([
      "clinic", "crew", "chart_patient_info", "vitals", "medications_given",
      "consent_forms",
    ]);
  });

  it("fall short form: vitals and physical exam, but wound care is not forced", () => {
    const required = requiredSections("clinic", "fall", short);

    expect(required).toContain("physical_exam");
    expect(required).toContain("vitals");
    expect(required).not.toContain("wound_care");
  });

  it("mental health and drugs/alcohol short forms: patient info and vitals only", () => {
    for (const nature of ["mental_health", "drugs_alcohol"] as const) {
      expect(requiredSections("clinic", nature, short)).toEqual([
        "clinic", "crew", "chart_patient_info", "vitals", "consent_forms",
      ]);
    }
  });

  it("a short form is always a subset of the same nature's full chart", () => {
    const full = { transport: false, full_chart: true };

    for (const nature of SHORT_FORM_NATURES) {
      const fullRequired = requiredSections("clinic", nature, full);
      for (const section of requiredSections("clinic", nature, short)) {
        expect(fullRequired, `${nature}: ${section}`).toContain(section);
      }
    }
  });
});

describe("crew", () => {
  it("is required on both clinic and ambulance charts", () => {
    expect(requiredSections("clinic", "bp_check", short)).toContain("crew");
    expect(requiredSections("ambulance", "trauma", short)).toContain("crew");
  });
});

describe("vehicle accident", () => {
  it("is only available on ambulance charts", () => {
    expect(allowedSections("ambulance")).toContain("vehicle_accident");
    expect(allowedSections("clinic")).not.toContain("vehicle_accident");
  });

  it("is required only when its checkbox is on", () => {
    const on = { transport: false, full_chart: false, vehicle_accident: true };
    expect(requiredSections("ambulance", "trauma", on)).toContain("vehicle_accident");
    expect(requiredSections("ambulance", "trauma", short)).not.toContain("vehicle_accident");
  });
});

describe("AMA", () => {
  it("requires nothing except the AMA form, on either call type", () => {
    const ama = { transport: true, full_chart: true, ama: true };

    expect(requiredSections("clinic", "cardiac", ama)).toEqual(["consent_forms"]);
    expect(requiredSections("ambulance", "trauma", ama)).toEqual(["consent_forms"]);
  });
});

// An independent statement of what each short form and full chart requires,
// written from the confirmed requirements (docs/tiered-form-plan.md, section 4)
// and not generated from the registry, so a wrong or missing rule in the
// registry makes a test fail.
const BASE = ["clinic", "crew", "consent_forms"];
const SHORT_FORMS: Record<string, string[]> = {
  bp_check: ["vitals"],
  injection: ["chart_patient_info", "medications_given"],
  minor_wound: ["wound_care"],
  suture_removal: ["wound_care"],
  abd_pain: ["chart_patient_info", "vitals", "physical_exam"],
  animal_bite_sting: ["chart_patient_info", "vitals", "wound_care"],
  burn: ["chart_patient_info", "vitals", "wound_care", "assessments"],
  fall: ["vitals", "physical_exam"],
  assault: ["vitals", "wound_care", "physical_exam"],
  industrial_accident: ["vitals", "wound_care", "physical_exam"],
  mental_health: ["chart_patient_info", "vitals"],
  drugs_alcohol: ["chart_patient_info", "vitals"],
  diabetic_problem: ["chart_patient_info", "vitals", "medications_given"],
};
// The full chart always has patient info and vitals, plus whatever the nature
// needs on top.
const FULL_EXTRAS: Record<string, string[]> = {
  injection: ["medications_given"],
  diabetic_problem: ["medications_given"],
  minor_wound: ["wound_care"],
  suture_removal: ["wound_care"],
  animal_bite_sting: ["wound_care"],
  burn: ["wound_care", "assessments"],
  assault: ["wound_care", "physical_exam"],
  industrial_accident: ["wound_care", "physical_exam"],
  abd_pain: ["physical_exam"],
  fall: ["physical_exam"],
  ob: ["obstetrics"],
};

const sorted = (list: string[]) => [...list].sort();

describe("exactly what each nature requires", () => {
  it.each(Object.entries(SHORT_FORMS))("%s short form", (nature, extras) => {
    const required = requiredSections("clinic", nature as never, short);

    expect(sorted(required)).toEqual(sorted([...BASE, ...extras]));
  });

  it.each(NATURES_OF_CALL)("%s full chart", (nature) => {
    const required = requiredSections("clinic", nature, { transport: false, full_chart: true });
    const expected = [...BASE, "chart_patient_info", "vitals", ...(FULL_EXTRAS[nature] ?? [])];

    expect(sorted(required)).toEqual(sorted(expected));
  });

  it.each(NATURES_OF_CALL)("%s on an ambulance is the full chart, with the ambulance block", (nature) => {
    const required = requiredSections("ambulance", nature, short);
    const expected = [
      "ambulance", "crew", "consent_forms", "chart_patient_info", "vitals",
      ...(FULL_EXTRAS[nature] ?? []),
    ];

    expect(sorted(required)).toEqual(sorted(expected));
  });
});

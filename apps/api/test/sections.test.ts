// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: tests the section registry, which decides which chart sections
// are required for each call type, nature of call, and checkbox combination.

import { describe, expect, it } from "vitest";
import {
  allowedSections,
  requiredSections,
  usesFullChart,
} from "../src/domain/sections.js";

const short = { transport: false, full_chart: false };

describe("section registry", () => {
  it("B/P check short form: clinic block, vitals, consent", () => {
    expect(requiredSections("clinic", "bp_check", short)).toEqual([
      "clinic", "vitals", "consent_forms",
    ]);
  });

  it("injection short form: allergies, medications, consent", () => {
    expect(requiredSections("clinic", "injection", short)).toEqual([
      "clinic", "chart_patient_info", "medications_given", "consent_forms",
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
    ).toEqual(["clinic", "chart_patient_info", "vitals", "consent_forms"]);
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
    ).toEqual(["ambulance", "chart_patient_info", "vitals", "consent_forms"]);
  });

  it("never offers the clinic block on an ambulance chart", () => {
    expect(allowedSections("ambulance")).not.toContain("clinic");
    expect(allowedSections("clinic")).not.toContain("ambulance");
  });
});

// Author(s): Kaitlyn Clevidence
// Started: 11-12-2026
// Updated: 11-24-2026
// P5: MVP
// Purpose: the section registry. The single list of which sections exist,
// which table each maps to, and when each is required.
// Required sections depend on five inputs: call type, nature of call, the
// transport checkbox, the full-chart checkbox, and AMA (an AMA chart needs
// only the AMA form) plus the vehicle accident checkbox (ambulance only).

import type { CallType, ChartSections, NatureOfCall } from "./Chart.js";

export type SectionKey = "clinic" | "ambulance" | keyof ChartSections;
export type Requirement =
  | "always"
  | "never"
  | "if_transport" // required only when the transport checkbox is on
  | "if_vehicle_accident" // required only when the vehicle accident box is on
  | readonly NatureOfCall[]; // required only for these natures

export interface SectionRule {
  table: string; // must match the migration
  cardinality: "one" | "many";
  call_types: readonly CallType[]; // call types this section can appear on
  short_form: Requirement; // rule when the short form is in use
  full_chart: Requirement; // rule when the full chart is in use
}

// Natures that have a short clinic form. The user can still tick
// "full chart" to get everything.
// Stroke, cardiac arrest/death, drowning, stab/gun shot, seizure and vehicle
// accident stay full-chart only (high acuity).
export const SHORT_FORM_NATURES: readonly NatureOfCall[] = [
  "bp_check",
  "injection",
  "minor_wound",
  "suture_removal",
  "abd_pain",
  "animal_bite_sting",
  "burn",
  "fall",
  "assault",
  "industrial_accident",
  "mental_health",
  "drugs_alcohol",
  "diabetic_problem",
];

export interface FormOptions {
  transport: boolean; 
  full_chart: boolean; 
  vehicle_accident?: boolean; 
  ama?: boolean; 
}

export const SECTION_REGISTRY = {
  clinic: {
    table: "clinic_visits",
    cardinality: "one",
    call_types: ["clinic"],
    short_form: "always",
    full_chart: "always",
  },
  ambulance: {
    table: "ambulance_calls",
    cardinality: "one",
    call_types: ["ambulance"],
    short_form: "always",
    full_chart: "always",
  },
  // Ambulance charts list the whole crew. A clinic chart needs at least one
  // provider. How many, and their role, is a service check, not a registry one.
  crew: {
    table: "chart_crew",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: "always",
    full_chart: "always",
  },
  vehicle_accident: {
    table: "vehicle_accident",
    cardinality: "one",
    call_types: ["ambulance"],
    short_form: "never",
    full_chart: "if_vehicle_accident",
  },
  // Short form (injection): only the allergy fields are required. That is a
  // field-level rule, to be added later; for now the section is required.
  chart_patient_info: {
    table: "chart_patient_info",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: [
      "injection", "abd_pain", "animal_bite_sting", "burn",
      "mental_health", "drugs_alcohol", "diabetic_problem",
    ],
    full_chart: "always",
  },
  vitals: {
    table: "vitals",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: [
      "bp_check", "abd_pain", "animal_bite_sting", "burn", "fall", "assault",
      "industrial_accident", "mental_health", "drugs_alcohol", "diabetic_problem",
    ],
    full_chart: "always",
  },
  // A short form is always a subset of the full chart, so every nature
  // required on a short form is also required on the full chart.
  medications_given: {
    table: "medications_given",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: ["injection", "diabetic_problem"],
    full_chart: ["injection", "diabetic_problem"],
  },
  wound_care: {
    table: "wound_care",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: [
      "minor_wound", "suture_removal", "animal_bite_sting", "burn",
      "assault", "industrial_accident",
    ],
    full_chart: [
      "minor_wound", "suture_removal", "animal_bite_sting", "burn",
      "assault", "industrial_accident",
    ],
  },
  obstetrics: {
    table: "obstetrics",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: "never",
    full_chart: ["ob"],
  },
  transport: {
    table: "transports",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: "if_transport",
    full_chart: "if_transport",
  },
  consent_forms: {
    table: "chart_forms",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: "always",
    full_chart: "always",
  },
  // TODO: whether procedures and fluids are ever required is undecided.
  // "never" means they can be saved but are not forced on the form.
  procedures_performed: {
    table: "procedures_performed",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: "never",
    full_chart: "never",
  },
  fluid_intake_output: {
    table: "fluid_intake_output",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: "never",
    full_chart: "never",
  },
  // Required on these natures' short forms (abdomen only for abd pain is a
  // field-level rule, to be added later), so also on their full chart.
  physical_exam: {
    table: "physical_exam",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: ["abd_pain", "fall", "assault", "industrial_accident"],
    full_chart: ["abd_pain", "fall", "assault", "industrial_accident"],
  },
  // The burn calculation.
  assessments: {
    table: "assessments",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: ["burn"],
    full_chart: ["burn"],
  },
} as const satisfies Record<SectionKey, SectionRule>;

// Widened view of the registry. The literal type from "as const" makes
// call_types.includes() reject a plain CallType, so helpers read through this.
const RULES: Record<SectionKey, SectionRule> = SECTION_REGISTRY;
const KEYS = Object.keys(RULES) as SectionKey[];

// Ambulance charts and any nature without a short form always use the
// full chart. Otherwise it is the user's checkbox.
export function usesFullChart(
  callType: CallType,
  nature: NatureOfCall,
  chosenFullChart: boolean
): boolean {
  if (callType === "ambulance") return true;
  if (!SHORT_FORM_NATURES.includes(nature)) return true;
  return chosenFullChart;
}

function isRequired(
  rule: Requirement,
  nature: NatureOfCall,
  options: FormOptions
): boolean {
  if (rule === "always") return true;
  if (rule === "never") return false;
  if (rule === "if_transport") return options.transport;
  if (rule === "if_vehicle_accident") return options.vehicle_accident ?? false;
  return rule.includes(nature);
}

// Sections that may appear on this call type.
export function allowedSections(callType: CallType): SectionKey[] {
  return KEYS.filter((k) => RULES[k].call_types.includes(callType));
}

// Sections that must be filled in before this chart can be submitted.
export function requiredSections(
  callType: CallType,
  nature: NatureOfCall,
  options: FormOptions
): SectionKey[] {
  // AMA: the patient is leaving against advice, no care is given, and
  // nothing is required except the AMA form itself.
  if (options.ama) return ["consent_forms"];

  const tier = usesFullChart(callType, nature, options.full_chart)
    ? "full_chart"
    : "short_form";
  return allowedSections(callType).filter((k) =>
    isRequired(RULES[k][tier], nature, options)
  );
}

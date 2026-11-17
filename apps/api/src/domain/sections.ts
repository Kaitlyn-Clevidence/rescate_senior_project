// Author(s): Kaitlyn Clevidence
// Started: 11-12-2026
// Updated: 11-16-2026
// P5: MVP
// Purpose: the section registry. The single list of which sections exist,
// which table each maps to, and when each is required.
// Required sections depend on four inputs: call type, nature of call, the
// transport checkbox and the full-chart checkbox.

import type { CallType, ChartSections, NatureOfCall } from "./Chart.js";

export type SectionKey = "clinic" | "ambulance" | keyof ChartSections;

export type Requirement =
  | "always"
  | "never"
  | "if_transport" // required only when the transport checkbox is on
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
export const SHORT_FORM_NATURES: readonly NatureOfCall[] = [
  "bp_check",
  "injection",
  "minor_wound",
  "suture_removal",
];

export interface FormOptions {
  transport: boolean; // the "transport?" checkbox
  full_chart: boolean; // the "full chart" checkbox
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
  // Short form (injection): only the allergy fields are required. That is a
  // field-level rule, to be added later; for now the section is required.
  chart_patient_info: {
    table: "chart_patient_info",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: ["injection"],
    full_chart: "always",
  },
  vitals: {
    table: "vitals",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: ["bp_check"],
    full_chart: "always",
  },
  medications_given: {
    table: "medications_given",
    cardinality: "many",
    call_types: ["clinic", "ambulance"],
    short_form: ["injection"],
    full_chart: ["injection"],
  },
  wound_care: {
    table: "wound_care",
    cardinality: "one",
    call_types: ["clinic", "ambulance"],
    short_form: ["minor_wound", "suture_removal"],
    full_chart: ["minor_wound", "suture_removal"],
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
  transport: boolean
): boolean {
  if (rule === "always") return true;
  if (rule === "never") return false;
  if (rule === "if_transport") return transport;
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
  const tier = usesFullChart(callType, nature, options.full_chart)
    ? "full_chart"
    : "short_form";
  return allowedSections(callType).filter((k) =>
    isRequired(RULES[k][tier], nature, options.transport)
  );
}

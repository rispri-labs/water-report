/**
 * Water report reader: compares a laboratory report with the Indian drinking water standard (IS 10500:2012 as amended),
 * works out the water type and corrosion/scaling indices from the major ions, and lists next steps.
 *
 * The limits are transcribed from published summaries of the standard. They are not an official Bureau of Indian Standards
 * publication: confirm against the current standard before relying on them. Rows with `verified: false` have not yet been
 * compared line by line with a published copy of the standard.
 */
import { screenWaterChemistry, type ChemistryResult, type MajorIonAnalysis } from "@rispri-labs/water-chemistry";

export interface ReportInput {
  pH?: number; tdsMgL?: number; turbidityNTU?: number; hardnessMgL?: number; alkalinityMgL?: number; chlorideMgL?: number; sulfateMgL?: number;
  fluorideMgL?: number; nitrateMgL?: number; ironMgL?: number; arsenicMgL?: number; leadMgL?: number; chromiumMgL?: number; manganeseMgL?: number;
  calciumMgL?: number; magnesiumMgL?: number; freeChlorineMgL?: number;
  sodiumMgL?: number; potassiumMgL?: number; bicarbonateMgL?: number; temperatureC?: number;
}
type Key = Exclude<keyof ReportInput, "sodiumMgL" | "potassiumMgL" | "bicarbonateMgL" | "temperatureC">;
interface Limit { label: string; unit: string; acceptable?: number; permissible?: number | null; low?: number; high?: number; verified: boolean; hint: string }

export const LIMITS: Record<Key, Limit> = {
  pH: { label: "pH", unit: "", low: 6.5, high: 8.5, verified: true, hint: "No relaxation outside 6.5 to 8.5." },
  turbidityNTU: { label: "Turbidity", unit: "NTU", acceptable: 1, permissible: 5, verified: true, hint: "" },
  tdsMgL: { label: "Total dissolved solids", unit: "mg/L", acceptable: 500, permissible: 2000, verified: true, hint: "" },
  hardnessMgL: { label: "Total hardness", unit: "mg/L as CaCO₃", acceptable: 200, permissible: 600, verified: true, hint: "" },
  alkalinityMgL: { label: "Alkalinity", unit: "mg/L as CaCO₃", acceptable: 200, permissible: 600, verified: true, hint: "" },
  chlorideMgL: { label: "Chloride", unit: "mg/L", acceptable: 250, permissible: 1000, verified: true, hint: "" },
  sulfateMgL: { label: "Sulphate", unit: "mg/L", acceptable: 200, permissible: 400, verified: true, hint: "" },
  fluorideMgL: { label: "Fluoride", unit: "mg/L", acceptable: 1.0, permissible: 1.5, verified: true, hint: "" },
  nitrateMgL: { label: "Nitrate", unit: "mg/L as NO₃", acceptable: 45, permissible: null, verified: true, hint: "No relaxation." },
  ironMgL: { label: "Iron", unit: "mg/L", acceptable: 1.0, permissible: null, verified: true, hint: "No relaxation (the limit was 0.3 mg/L before the amendment)." },
  arsenicMgL: { label: "Arsenic", unit: "mg/L", acceptable: 0.01, permissible: null, verified: true, hint: "No relaxation." },
  leadMgL: { label: "Lead", unit: "mg/L", acceptable: 0.01, permissible: null, verified: true, hint: "" },
  chromiumMgL: { label: "Chromium", unit: "mg/L", acceptable: 0.05, permissible: null, verified: true, hint: "" },
  manganeseMgL: { label: "Manganese", unit: "mg/L", acceptable: 0.1, permissible: 0.3, verified: false, hint: "" },
  calciumMgL: { label: "Calcium", unit: "mg/L", acceptable: 75, permissible: 200, verified: false, hint: "" },
  magnesiumMgL: { label: "Magnesium", unit: "mg/L", acceptable: 30, permissible: 100, verified: false, hint: "" },
  freeChlorineMgL: { label: "Free residual chlorine", unit: "mg/L", low: 0.2, high: 1.0, verified: false, hint: "At least 0.2 mg/L where the water is chlorinated, up to 1.0 mg/L permissible." },
};
export const ORDER: Key[] = ["pH", "turbidityNTU", "tdsMgL", "hardnessMgL", "alkalinityMgL", "chlorideMgL", "sulfateMgL", "fluorideMgL", "nitrateMgL", "ironMgL", "arsenicMgL", "leadMgL", "chromiumMgL", "manganeseMgL", "calciumMgL", "magnesiumMgL", "freeChlorineMgL"];

export type Status = "ok" | "acceptable-exceeded" | "exceeds" | "outside-range" | "below-minimum";
export interface ReportRow { key: Key; label: string; unit: string; value: number; status: Status; acceptable: number | null; permissible: number | null; low: number | null; high: number | null; verified: boolean; text: string }
export interface Action { parameter: string; text: string; treatments: string[] }

const MAX: Record<string, number> = { pH: 14, turbidityNTU: 5000, freeChlorineMgL: 100 };
export function validateReport(input: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `${k} must be a number of zero or more.`;
    if (v > (MAX[k] ?? 1_000_000)) return `${k} is too large.`;
  }
  if (input.pH === undefined && Object.keys(input).filter((k) => input[k] !== undefined).length === 0) return "Enter at least one value from the report.";
  return null;
}

function judge(key: Key, v: number): { status: Status; text: string } {
  const L = LIMITS[key], u = L.unit ? ` ${L.unit}` : "";
  if (L.low !== undefined && L.high !== undefined) {
    if (v < L.low) return key === "freeChlorineMgL" ? { status: "below-minimum", text: `Below the ${L.low}${u} minimum. This matters only if the supply is meant to be chlorinated.` } : { status: "outside-range", text: `Below ${L.low}. The standard allows no relaxation.` };
    if (v > L.high) return key === "freeChlorineMgL" ? { status: "exceeds", text: `Above the ${L.high}${u} limit.` } : { status: "outside-range", text: `Above ${L.high}. The standard allows no relaxation.` };
    return { status: "ok", text: `Inside ${L.low} to ${L.high}${u}.` };
  }
  const acc = L.acceptable!;
  if (v <= acc) return { status: "ok", text: `At or below the ${acc}${u} acceptable limit.` };
  if (L.permissible != null && v <= L.permissible) return { status: "acceptable-exceeded", text: `Above the ${acc}${u} acceptable limit but within the ${L.permissible}${u} permissible limit, which applies only where no better source exists.` };
  return { status: "exceeds", text: L.permissible != null ? `Above the ${L.permissible}${u} permissible limit.` : `Above the ${acc}${u} limit. The standard allows no relaxation.` };
}

/** Major-ion analysis from the report, with the assumptions made to fill gaps listed. */
function ionAnalysis(r: ReportInput): { analysis: MajorIonAnalysis | null; assumptions: string[] } {
  const assumptions: string[] = [];
  if (r.pH === undefined) return { analysis: null, assumptions };
  let bicarbonate = r.bicarbonateMgL;
  if (bicarbonate === undefined && r.alkalinityMgL !== undefined) {
    bicarbonate = Number((r.alkalinityMgL * 1.2192).toFixed(1));
    assumptions.push(`Bicarbonate taken as ${bicarbonate} mg/L from alkalinity (alkalinity × 1.22, valid when pH is below about 8.3).`);
  }
  let calcium = r.calciumMgL, magnesium = r.magnesiumMgL;
  if (calcium !== undefined && magnesium === undefined && r.hardnessMgL !== undefined) {
    magnesium = Math.max(0, Number(((r.hardnessMgL - calcium * 2.497) / 4.118).toFixed(1)));
    assumptions.push(`Magnesium taken as ${magnesium} mg/L from total hardness minus the calcium hardness.`);
  }
  return {
    analysis: { pH: r.pH, temperatureC: r.temperatureC, tdsMgL: r.tdsMgL, calciumMgL: calcium, magnesiumMgL: magnesium, sodiumMgL: r.sodiumMgL, potassiumMgL: r.potassiumMgL, chlorideMgL: r.chlorideMgL, sulfateMgL: r.sulfateMgL, bicarbonateMgL: bicarbonate, nitrateMgL: r.nitrateMgL, fluorideMgL: r.fluorideMgL },
    assumptions,
  };
}

/** Dominant cation and anion by milli-equivalent share; "mixed" when none passes 50 percent. */
export function waterType(a: MajorIonAnalysis): { type: string; cationPercent: Record<string, number>; anionPercent: Record<string, number> } | null {
  const v = (n?: number) => n ?? 0;
  const ca = v(a.calciumMgL) / 20.04, mg = v(a.magnesiumMgL) / 12.15, na = (v(a.sodiumMgL) / 22.99) + (v(a.potassiumMgL) / 39.1);
  const hco3 = v(a.bicarbonateMgL) / 61.02, so4 = v(a.sulfateMgL) / 48.03, cl = v(a.chlorideMgL) / 35.45;
  const cat = ca + mg + na, an = hco3 + so4 + cl;
  if (cat <= 0 || an <= 0 || a.calciumMgL === undefined || a.chlorideMgL === undefined || a.bicarbonateMgL === undefined) return null;
  const pc = (x: number, t: number) => Number(((x / t) * 100).toFixed(1));
  const cp = { Ca: pc(ca, cat), Mg: pc(mg, cat), "Na+K": pc(na, cat) }, ap = { HCO3: pc(hco3, an), SO4: pc(so4, an), Cl: pc(cl, an) };
  const top = (o: Record<string, number>) => { const [k, x] = Object.entries(o).sort((p, q) => q[1] - p[1])[0]; return x >= 50 ? k : "mixed"; };
  const c = top(cp), an2 = top(ap);
  return { type: c === "mixed" && an2 === "mixed" ? "mixed" : `${c}-${an2}`.replace("mixed-", "mixed cation, ").replace("-mixed", ", mixed anion"), cationPercent: cp, anionPercent: ap };
}

/** Ryznar stability index and Larson ratio, from the Langelier screening and the ions (screening values). */
export function corrosionIndices(res: ChemistryResult, a: MajorIonAnalysis, pH: number) {
  const ryznar = res.lsi === null ? null : Number((2 * (pH - res.lsi) - pH).toFixed(2));
  const v = (n?: number) => n ?? 0;
  const alk = v(a.bicarbonateMgL) / 61.02;
  const larson = a.chlorideMgL !== undefined && a.sulfateMgL !== undefined && alk > 0 ? Number(((v(a.chlorideMgL) / 35.45 + v(a.sulfateMgL) / 48.03) / alk).toFixed(2)) : null;
  return { ryznar, larson, ryznarMeaning: ryznar === null ? null : ryznar < 6.2 ? "scale-forming tendency" : ryznar <= 6.8 ? "near balance" : "corrosive tendency", larsonMeaning: larson === null ? null : larson < 0.8 ? "chloride and sulphate unlikely to interfere with protective films" : larson <= 1.2 ? "chloride and sulphate may interfere with protective films" : "chloride and sulphate likely to raise corrosion rates" };
}

const NEXT: Partial<Record<Key, { text: string; treatments: string[] }>> = {
  arsenicMgL: { text: "Arsenic has no relaxation. Do not use this source for drinking or cooking until it is treated. Arsenic removal needs the right media and a check of the iron and pH of your water.", treatments: ["household arsenic and fluoride filter", "arsenic-selective resin", "community arsenic removal plant", "combined fluoride, arsenic and iron plant"] },
  fluorideMgL: { text: "Fluoride above the limit stains teeth and, over years, affects bones. Fluoride is removed with specific media, not by boiling or an ordinary filter.", treatments: ["bead defluoridation filter", "household arsenic and fluoride filter", "combined fluoride, arsenic and iron plant", "electrochemical fluoride and arsenic removal"] },
  ironMgL: { text: "Iron turns water yellow or brown and stains. It is removed by aeration, settling and filtration, sized to the iron level and the flow.", treatments: ["household iron filter", "aeration, settling and sand filter", "high-flow iron filter"] },
  manganeseMgL: { text: "Manganese is removed along with iron, but it needs a stronger oxidation step. Get both tested together.", treatments: ["aeration, settling and sand filter", "high-flow iron filter"] },
  tdsMgL: { text: "High dissolved solids are removed by membranes or electrodialysis. The right choice depends on the TDS, the volume you need and what you do with the reject water.", treatments: ["reverse osmosis or nanofiltration", "electrodialysis", "reject-water management"] },
  chlorideMgL: { text: "Chloride is removed with membranes; boiling and ordinary filters do not help.", treatments: ["reverse osmosis or nanofiltration", "electrodialysis"] },
  sulfateMgL: { text: "Sulphate is removed with nanofiltration or reverse osmosis.", treatments: ["reverse osmosis or nanofiltration", "nanofiltration"] },
  hardnessMgL: { text: "Hardness causes scale on heaters, pipes and membranes. A softener removes it; for drinking, a membrane also does.", treatments: ["ion-exchange water softener", "reverse osmosis or nanofiltration"] },
  nitrateMgL: { text: "Nitrate is a health risk for infants. It is removed by reverse osmosis or ion exchange, or by using a safer source.", treatments: ["reverse osmosis or nanofiltration"] },
  turbidityNTU: { text: "Cloudy water hides germs from disinfection. Remove the particles first, then disinfect.", treatments: ["low-cost turbidity filter", "ceramic microfiltration"] },
  leadMgL: { text: "Lead above the limit needs laboratory confirmation and a check of pipes and fittings as well as the source.", treatments: ["accredited laboratory testing", "multi-stage treatment train"] },
  chromiumMgL: { text: "Chromium above the limit needs laboratory confirmation of its form and treatment matched to it.", treatments: ["multi-stage treatment train", "accredited laboratory testing"] },
  alkalinityMgL: { text: "High alkalinity usually goes with hardness and scaling. A softener or a membrane addresses it.", treatments: ["ion-exchange water softener", "reverse osmosis or nanofiltration"] },
  pH: { text: "pH outside 6.5 to 8.5 is corrected by dosing, matched to the water and its buffering. Get the alkalinity measured first.", treatments: ["pH correction by chemical dosing", "accredited laboratory testing"] },
};

export interface ReportResult {
  rows: ReportRow[];
  counts: { ok: number; acceptableExceeded: number; exceeds: number };
  verdict: { level: "ok" | "warn" | "fail"; text: string };
  notTested: string[];
  actions: Action[];
  chemistry: ChemistryResult | null;
  assumptions: string[];
  waterType: ReturnType<typeof waterType>;
  indices: ReturnType<typeof corrosionIndices> | null;
}

export function analyseReport(r: ReportInput): ReportResult {
  const rows: ReportRow[] = [];
  for (const key of ORDER) {
    const v = r[key];
    if (v === undefined) continue;
    const L = LIMITS[key], j = judge(key, v);
    rows.push({ key, label: L.label, unit: L.unit, value: v, status: j.status, acceptable: L.acceptable ?? null, permissible: L.permissible ?? null, low: L.low ?? null, high: L.high ?? null, verified: L.verified, text: j.text });
  }
  const bad = rows.filter((x) => x.status === "exceeds" || x.status === "outside-range");
  const relaxed = rows.filter((x) => x.status === "acceptable-exceeded" || x.status === "below-minimum");
  const counts = { ok: rows.filter((x) => x.status === "ok").length, acceptableExceeded: relaxed.length, exceeds: bad.length };
  const verdict = bad.length
    ? { level: "fail" as const, text: `${bad.length} parameter${bad.length > 1 ? "s are" : " is"} outside IS 10500: ${bad.map((x) => x.label).join(", ")}. This water is not within the standard for drinking.` }
    : relaxed.length
      ? { level: "warn" as const, text: `No parameter breaks the permissible limit, but ${relaxed.map((x) => x.label).join(", ")} ${relaxed.length > 1 ? "need" : "needs"} attention. The permissible limit applies only where no better source exists.` }
      : { level: "ok" as const, text: "Every parameter you entered is inside the acceptable limit." };
  const tested = new Set(rows.map((x) => x.key));
  const notTested = (["arsenicMgL", "fluorideMgL", "nitrateMgL", "ironMgL", "turbidityNTU"] as Key[]).filter((k) => !tested.has(k)).map((k) => LIMITS[k].label);
  const seen = new Set<string>();
  const actions: Action[] = [];
  for (const row of [...bad, ...relaxed]) {
    const n = NEXT[row.key]; if (!n || seen.has(row.key)) continue; seen.add(row.key);
    actions.push({ parameter: row.label, text: n.text, treatments: n.treatments });
  }
  const { analysis, assumptions } = ionAnalysis(r);
  let chemistry: ChemistryResult | null = null, indices: ReportResult["indices"] = null, type: ReportResult["waterType"] = null;
  if (analysis) {
    try { chemistry = screenWaterChemistry(analysis); indices = corrosionIndices(chemistry, analysis, r.pH!); type = waterType(analysis); } catch { chemistry = null; }
  }
  return { rows, counts, verdict, notTested, actions, chemistry, assumptions, waterType: type, indices };
}

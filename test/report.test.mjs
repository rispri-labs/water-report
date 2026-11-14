import test from "node:test";
import assert from "node:assert/strict";
import { analyseReport, LIMITS, ORDER, validateReport } from "../dist/index.js";

test("well-known IS 10500 limits are in the table", () => {
  const L = (k) => LIMITS[k];
  assert.deepEqual([L("fluorideMgL").acceptable, L("fluorideMgL").permissible], [1.0, 1.5]);
  assert.deepEqual([L("tdsMgL").acceptable, L("tdsMgL").permissible], [500, 2000]);
  assert.deepEqual([L("chlorideMgL").acceptable, L("chlorideMgL").permissible], [250, 1000]);
  assert.deepEqual([L("sulfateMgL").acceptable, L("sulfateMgL").permissible], [200, 400]);
  assert.deepEqual([L("hardnessMgL").acceptable, L("hardnessMgL").permissible], [200, 600]);
  assert.equal(L("nitrateMgL").acceptable, 45);
  assert.equal(L("arsenicMgL").acceptable, 0.01);
});

test("each parameter is judged against its own acceptable and permissible limit", () => {
  const rows = (v) => analyseReport(v).rows[0];
  assert.equal(rows({ fluorideMgL: 0.8 }).status, "ok");
  assert.equal(rows({ fluorideMgL: 1.2 }).status, "acceptable-exceeded");
  assert.equal(rows({ fluorideMgL: 1.8 }).status, "exceeds");
  assert.equal(rows({ tdsMgL: 450 }).status, "ok");
  assert.equal(rows({ tdsMgL: 2500 }).status, "exceeds");
  assert.equal(rows({ arsenicMgL: 0.02 }).status, "exceeds", "arsenic has no relaxation");
});

test("the verdict follows the worst row", () => {
  assert.equal(analyseReport({ fluorideMgL: 0.5, pH: 7.2 }).verdict.level, "ok");
  assert.equal(analyseReport({ fluorideMgL: 1.2 }).verdict.level, "warn");
  const bad = analyseReport({ fluorideMgL: 2.1, tdsMgL: 300 });
  assert.equal(bad.verdict.level, "fail"); assert.equal(bad.counts.exceeds, 1);
});

test("next steps name generic treatments, never a vendor", () => {
  const r = analyseReport({ ironMgL: 2, hardnessMgL: 800, fluorideMgL: 3 });
  assert.ok(r.actions.length >= 3);
  for (const a of r.actions) { assert.ok(Array.isArray(a.treatments) && a.treatments.length > 0); assert.ok(!("items" in a)); }
  assert.ok(r.actions.find((a) => a.parameter.toLowerCase().includes("iron")).treatments.some((t) => /aeration|iron/.test(t)));
});

test("with the major ions it reports water type and corrosion indices; without them it does not guess", () => {
  const base = { pH: 7.6, tdsMgL: 600, alkalinityMgL: 200, hardnessMgL: 300 };
  const hard = analyseReport({ ...base, calciumMgL: 120, magnesiumMgL: 10, sodiumMgL: 20, chlorideMgL: 20, sulfateMgL: 20, bicarbonateMgL: 400 });
  assert.equal(hard.waterType.type, "Ca-HCO3"); assert.ok(hard.indices.ryznar !== null && hard.indices.larson !== null);
  const salty = analyseReport({ ...base, calciumMgL: 20, magnesiumMgL: 5, sodiumMgL: 300, chlorideMgL: 400, sulfateMgL: 30, bicarbonateMgL: 100 });
  assert.equal(salty.waterType.type, "Na+K-Cl");
  const thin = analyseReport({ pH: 7.6, tdsMgL: 600 });
  assert.equal(thin.waterType, null); assert.equal(thin.indices.ryznar, null); assert.equal(thin.indices.larson, null);
  assert.ok(thin.chemistry.flags.some((f) => f.code === "incomplete-analysis"), "an incomplete analysis is flagged");
  assert.ok(thin.notTested.length > 0, "it lists what was not tested");
});

test("every limit row is complete and bad input is refused", () => {
  for (const k of ORDER) { const l = LIMITS[k]; assert.ok(l.label && typeof l.unit === "string", k); assert.equal(typeof l.verified, "boolean"); }
  assert.equal(typeof validateReport({ pH: 15 }), "string");
  assert.equal(validateReport({ pH: 7.2, tdsMgL: 300 }), null);
});

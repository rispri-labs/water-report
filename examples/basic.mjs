import { analyseReport } from "../dist/index.js";

const r = analyseReport({ pH: 8.9, tdsMgL: 1450, hardnessMgL: 520, fluorideMgL: 1.8, ironMgL: 0.2, nitrateMgL: 30, calciumMgL: 150, magnesiumMgL: 35, sodiumMgL: 200, chlorideMgL: 380, sulfateMgL: 150, bicarbonateMgL: 260 });
console.log(r.verdict.text);
for (const row of r.rows) console.log(`${row.label}: ${row.value} ${row.unit} -> ${row.status}`);
for (const a of r.actions) console.log(`\n${a.parameter}: ${a.text}\n  options: ${a.treatments.join("; ")}`);
console.log("\nwater type:", r.waterType?.type, " LSI:", r.indices?.lsi);

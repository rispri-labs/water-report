# @rispri-labs/water-report

Reads a drinking water laboratory report against the Indian standard **IS 10500:2012 (as amended)** and tells you, in plain words:

- which parameters are inside the acceptable limit, above it but inside the permissible limit, or outside the standard
- the water type (for example calcium bicarbonate) and the Langelier, Ryznar and Larson corrosion and scaling indices, when the major ions are given
- which parameters were not tested but usually should be
- next steps for each problem, as generic treatment names (never a vendor)

TypeScript, runs in Node 20+ and in the browser. Depends on [`@rispri-labs/water-chemistry`](https://github.com/rispri-labs/water-chemistry).

## Install

```bash
npm install @rispri-labs/water-report
```

## Use

```js
import { analyseReport } from "@rispri-labs/water-report";

const r = analyseReport({ pH: 8.9, tdsMgL: 1450, hardnessMgL: 520, fluorideMgL: 1.8, ironMgL: 0.2 });

r.verdict;   // { level: "fail", text: "2 parameters are outside IS 10500: ..." }
r.rows;      // each parameter: value, status, acceptable and permissible limits, explanation
r.actions;   // [{ parameter, text, treatments: ["bead defluoridation filter", ...] }]
r.notTested; // parameters usually worth testing
```

Concentrations are mg/L unless the key says otherwise (`turbidityNTU`, `pH`). Arsenic, lead and chromium are in mg/L (0.01 mg/L is 10 µg/L).

## About the limits

The limits in `LIMITS` are **transcribed from published summaries of IS 10500**, not from an official Bureau of Indian Standards publication, and the standard is revised. Each row has a `verified` flag: `true` means the value was compared with a published copy; `false` means it has not been compared line by line yet. Please check the current standard before using a result for compliance, and open an issue (with the clause) if a value is wrong.

## Important

This is a screening and learning tool. It is not a substitute for a laboratory test, a jar test, a pilot or the judgement of a qualified engineer, and it comes with no warranty (see the licence). Check every result against your own data before it informs a design, a purchase or a compliance decision.

## Contributing and licence

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under the [Apache License 2.0](LICENSE).

Built by [Rispri Labs](https://risprilabs.com), Agra, India, and extracted from the free EnviroSaathi advisor tools at https://risprilabs.com/envirosaathi. The packages in the `@rispri-labs` scope: `water-chemistry`, `water-report`, `scaling-limit`, `neutralisation`, `soft-sensor`, `epanet-network`.

import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const runs = Number(process.env.PECHO_BENCH_RUNS ?? 5);
if (!Number.isInteger(runs) || runs < 3)
  throw new Error("Use at least three measured builds per compiler");
const directory = path.resolve(".cache/compiler-benchmark");
await mkdir(directory, { recursive: true });
const results = { babel: [], oxc: [] };
const outputs = {};
async function build(compiler, label) {
  const output = path.join(directory, compiler);
  const start = performance.now();
  const run = spawnSync(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--config",
      "vite.renderer.config.mts",
      "--outDir",
      output,
    ],
    {
      env: { ...process.env, PECHO_REACT_COMPILER: compiler },
      encoding: "utf8",
    },
  );
  const milliseconds = performance.now() - start;
  await writeFile(
    path.join(directory, `${compiler}-${label}.log`),
    run.stdout + run.stderr,
  );
  if (run.error || run.status !== 0)
    throw run.error ?? new Error(`${compiler} build failed; see ${directory}`);
  const files = await readdir(path.join(output, "assets"));
  let bytes = 0,
    gzipBytes = 0,
    memoCacheSentinels = 0;
  const assets = [];
  for (const file of files.filter((file) => file.endsWith(".js"))) {
    const content = await readFile(path.join(output, "assets", file));
    bytes += content.length;
    gzipBytes += gzipSync(content).length;
    memoCacheSentinels +=
      content.toString().split("react.memo_cache_sentinel").length - 1;
    assets.push(file);
  }
  if (!memoCacheSentinels)
    throw new Error(`${compiler} emitted no React Compiler memo cache markers`);
  outputs[compiler] = { bytes, gzipBytes, memoCacheSentinels, assets };
  console.log(`${compiler} ${label}: ${milliseconds.toFixed(1)} ms`);
  return milliseconds;
}
// Warm the OS/dependency caches once per compiler, then alternate their order.
await build("babel", "warmup");
await build("oxc", "warmup");
for (let run = 0; run < runs; run++) {
  for (const compiler of run % 2 ? ["oxc", "babel"] : ["babel", "oxc"]) {
    results[compiler].push(await build(compiler, run + 1));
  }
}
const summary = Object.fromEntries(
  Object.entries(results).map(([compiler, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return [
      compiler,
      {
        milliseconds: values,
        median:
          sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2,
        min: sorted[0],
        max: sorted.at(-1),
        ...outputs[compiler],
      },
    ];
  }),
);
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const versions = Object.fromEntries(
  [
    "vite",
    "@vitejs/plugin-react",
    "@babel/core",
    "@rolldown/plugin-babel",
    "babel-plugin-react-compiler",
    "oxc-transform-react",
  ].map((name) => [name, lock.packages[`node_modules/${name}`].version]),
);
const report = {
  date: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  cpu: os.cpus()[0].model,
  dependencies: versions,
  warmups: 1,
  runs,
  summary,
};
await writeFile(
  path.join(directory, "results.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));

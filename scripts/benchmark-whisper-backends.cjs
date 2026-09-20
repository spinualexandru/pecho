// Opt-in Linux benchmark, using existing local model/audio assets.
// PECHO_BENCH_FP16=1 additionally downloads two pinned Tiny fp16 exports (~76 MB).
// See docs/whisper-gpu-evaluation.md for the two distinct packaging boundaries.
const { _electron, chromium, expect } = require("@playwright/test");
const { spawn, execFileSync } = require("node:child_process");
const {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  readdir,
} = require("node:fs/promises");
const { tmpdir, cpus, totalmem, release } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");

const packageRoot = path.resolve("out/Personal Echo-linux-x64");
const asar = path.join(packageRoot, "resources/app.asar");
const assets = path.resolve(
  process.env.PECHO_LANGUAGE_PROFILE ?? ".cache/language-profile",
);
const output = path.resolve(".cache/whisper-backends");
const model = path.join(assets, "transformers/Xenova/whisper-tiny.en");

async function bounded(promise, milliseconds, onTimeout) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error(`Benchmark timeout after ${milliseconds} ms`));
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function gpuInventory() {
  try {
    return execFileSync(
      "nvidia-smi",
      [
        "--query-gpu=name,driver_version,memory.total,memory.used",
        "--format=csv",
      ],
      { encoding: "utf8", timeout: 5000 },
    );
  } catch {
    return null;
  }
}

async function prepareFp16() {
  const manifest = require("../src/helpers/whisper-manifest.json")[
    "Xenova/whisper-tiny.en"
  ];
  const destination = path.join(output, "fp16");
  await mkdir(path.join(destination, "onnx"), { recursive: true });
  for (const file of Object.keys(manifest.files).filter(
    (file) => !file.endsWith(".onnx"),
  )) {
    await writeFile(
      path.join(destination, file),
      await readFile(path.join(model, file)),
    );
  }
  for (const [file, size] of [
    ["encoder_model_fp16.onnx", 16519776],
    ["decoder_model_merged_fp16.onnx", 59602260],
  ]) {
    const target = path.join(destination, "onnx", file);
    try {
      if ((await readFile(target)).length === size) continue;
    } catch {}
    const response = await fetch(
      `https://huggingface.co/Xenova/whisper-tiny.en/resolve/${manifest.revision}/onnx/${file}`,
      { signal: AbortSignal.timeout(120000) },
    );
    assert.equal(response.ok, true);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes.byteLength, size);
    await writeFile(target, bytes);
  }
}

async function native(
  device,
  failure = null,
  dtype = "q8",
  profileOnly = false,
) {
  const profile = await mkdtemp(path.join(tmpdir(), "pecho-native-bench-"));
  let electron;
  try {
    electron = await _electron.launch({
      executablePath: require("electron"),
      args: [asar, `--user-data-dir=${profile}`],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
      timeout: 30000,
    });
    return await bounded(
      electron.evaluate(
        async ({ app }, options) => {
          const requirePackaged = process.mainModule
            .require("node:module")
            .createRequire(app.getAppPath() + "/package.json");
          const fs = requirePackaged("node:fs");
          const { pipeline, env } = requirePackaged(
            "@huggingface/transformers",
          );
          const ort = requirePackaged("onnxruntime-node");
          env.allowRemoteModels = false;
          const buffer = fs.readFileSync(options.audio);
          const short = new Float32Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.length / 4,
          );
          const long = new Float32Array(short.length * 5);
          for (let i = 0; i < 5; i++) long.set(short, i * short.length);
          const result = {
            boundary:
              "Installed Electron executable, packaged ASAR main and dependencies",
            versions: process.versions,
            backends: ort.listSupportedBackends(),
            requestedDevice: options.device,
            failureInjection: options.failure,
            dtype: options.dtype,
            profileOnly: options.profileOnly,
            rssBeforeBytes: process.memoryUsage().rss,
            runs: [],
          };
          let peak = result.rssBeforeBytes;
          const sampler = setInterval(() => {
            peak = Math.max(peak, process.memoryUsage().rss);
          }, 20);
          let transcriber;
          const start = performance.now();
          try {
            try {
              if (options.failure === "injected-initialization")
                throw new Error(
                  "Injected WebGPU initialization failure (benchmark only)",
                );
              transcriber = await pipeline(
                "automatic-speech-recognition",
                options.model,
                {
                  device: options.device,
                  dtype: options.dtype,
                  local_files_only: true,
                  session_options: !options.profileOnly
                    ? {}
                    : {
                        enableProfiling: true,
                        profileFilePrefix: options.profilePrefix,
                      },
                },
              );
              result.sessionDevice = options.device;
              result.sessionDtype = options.dtype;
            } catch (error) {
              result.initializationError = String(error);
              result.failedAttemptMs = performance.now() - start;
              transcriber = await pipeline(
                "automatic-speech-recognition",
                options.cpuModel,
                {
                  device: "cpu",
                  dtype: "q8",
                  local_files_only: true,
                },
              );
              result.sessionDevice = "cpu";
              result.sessionDtype = "q8";
            }
            result.loadMs = performance.now() - start;
            result.rssLoadedBytes = process.memoryUsage().rss;
            const gpuSnapshot = () => {
              try {
                const raw = requirePackaged("node:child_process").execFileSync(
                  "nvidia-smi",
                  [
                    "--query-compute-apps=pid,used_gpu_memory",
                    "--format=csv,noheader,nounits",
                  ],
                  { encoding: "utf8", timeout: 5000 },
                );
                return (
                  raw
                    .split("\n")
                    .find(
                      (line) => Number(line.split(",")[0]) === process.pid,
                    ) ?? null
                );
              } catch {
                return null;
              }
            };
            result.nvidiaProcessMemoryAfterLoad = gpuSnapshot();
            for (const [name, audio] of options.failure || options.profileOnly
              ? [["short", short]]
              : [
                  ["short", short],
                  ["long-repeat", long],
                ]) {
              for (
                let repeat = 0;
                repeat < (options.failure || options.profileOnly ? 1 : 3);
                repeat++
              ) {
                const began = performance.now();
                const transcription = await transcriber(audio, {
                  return_timestamps: false,
                  chunk_length_s: 30,
                  stride_length_s: 5,
                });
                result.runs.push({
                  name,
                  repeat,
                  audioSeconds: audio.length / 16000,
                  inferenceMs: performance.now() - began,
                  text: transcription.text,
                  rssAfterBytes: process.memoryUsage().rss,
                });
              }
            }
            result.nvidiaProcessMemoryAfterInference = gpuSnapshot();
            if (options.profileOnly)
              for (const session of Object.values(transcriber.model.sessions))
                session.endProfiling();
          } finally {
            await transcriber?.dispose();
            clearInterval(sampler);
            result.sampledPeakRssBytes = Math.max(
              peak,
              process.memoryUsage().rss,
            );
            result.processLifetimeMaxRssBytes =
              process.resourceUsage().maxRSS * 1024;
          }
          return result;
        },
        {
          device,
          failure,
          dtype,
          profileOnly,
          model: dtype === "fp16" ? path.join(output, "fp16") : model,
          cpuModel: model,
          audio: path.join(assets, "jfk.wav.f32"),
          profilePrefix: path.join(output, device + "-" + dtype),
        },
      ),
      180000,
      () => electron.process().kill("SIGKILL"),
    );
  } finally {
    if (electron)
      await bounded(electron.close(), 5000, () =>
        electron.process().kill("SIGKILL"),
      ).catch(() => {});
    await rm(profile, { recursive: true, force: true });
  }
}

async function packaged(disableGpu) {
  const profile = await mkdtemp(path.join(tmpdir(), "pecho-shipped-bench-"));
  const { symlink } = require("node:fs/promises");
  await symlink(
    path.join(assets, "transformers"),
    path.join(profile, "transformers"),
  );
  const child = spawn(
    path.join(packageRoot, "Personal Echo"),
    [
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      ...(disableGpu ? ["--disable-gpu", "--disable-software-rasterizer"] : []),
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "" } },
  );
  let browser;
  let logs = "";
  child.stdout.resume();
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(logs || "Debugger timeout")),
        20000,
      );
      child.stderr.on("data", (chunk) => {
        logs = (logs + chunk).slice(-16000);
        const match = logs.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Exit ${code}: ${logs}`));
      });
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    await expect(
      page.getByRole("heading", { name: "Personal Echo" }),
    ).toBeVisible({ timeout: 20000 });
    const adapter = await page.evaluate(async () => {
      if (!navigator.gpu) return { api: false, adapter: false };
      const adapter = await navigator.gpu.requestAdapter();
      return {
        api: true,
        adapter: !!adapter,
        info: adapter
          ? {
              vendor: adapter.info.vendor,
              architecture: adapter.info.architecture,
              device: adapter.info.device,
              description: adapter.info.description,
              isFallbackAdapter: adapter.info.isFallbackAdapter,
            }
          : null,
        features: adapter ? Array.from(adapter.features) : [],
      };
    });
    const audio = await readFile(path.join(assets, "jfk.wav.f32"));
    const short = Array.from(
      new Float32Array(audio.buffer, audio.byteOffset, audio.length / 4),
    );
    const result = {
      boundary: "Hardened shipped executable, actual renderer IPC",
      disableGpu,
      adapter,
      runs: [],
    };
    const loadStart = performance.now();
    await bounded(
      page.evaluate(() =>
        window.recording.downloadWhisperModel("Xenova/whisper-tiny.en"),
      ),
      30000,
      () => child.kill("SIGKILL"),
    );
    result.loadMs = performance.now() - loadStart;
    for (const [name, samples] of disableGpu
      ? [["short", short]]
      : [
          ["short", short],
          ["long-repeat", Array(5).fill(short).flat()],
          ["tail-after-35s-silence", [...Array(35 * 16000).fill(0), ...short]],
        ]) {
      const began = performance.now();
      const text = await bounded(
        page.evaluate(
          (samples) =>
            window.recording.transcribeAudio(
              new Float32Array(samples).buffer,
              "Xenova/whisper-tiny.en",
              "en",
            ),
          samples,
        ),
        60000,
        () => child.kill("SIGKILL"),
      );
      result.runs.push({
        name,
        audioSeconds: samples.length / 16000,
        ipcMs: performance.now() - began,
        text,
      });
      assert.match(text, /ask not what your country can do for you/i);
    }
    return result;
  } finally {
    child.kill("SIGTERM");
    await browser?.close().catch(() => {});
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => child.kill("SIGKILL"), 2000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    await rm(profile, { recursive: true, force: true });
  }
}

(async () => {
  await mkdir(output, { recursive: true });
  const previousFiles = new Set(await readdir(output));
  const report = {
    recordedAt: new Date().toISOString(),
    hardware: {
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      ramBytes: totalmem(),
      kernel: release(),
      gpu: gpuInventory(),
    },
    native: [],
    packaged: [],
    profiles: [],
  };
  const save = () =>
    writeFile(
      path.join(output, "results.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  await save();
  for (const [device, failure] of [
    ["cpu", null],
    ["webgpu", null],
    ["cuda", "unavailable-provider"],
    ["dml", "unsupported-platform"],
    ["webgpu", "injected-initialization"],
  ]) {
    console.log(`Benchmarking ${device}: ${failure ?? "normal"}`);
    const result = await native(device, failure);
    assert.match(
      result.runs[0].text,
      /ask not what your country can do for you/i,
    );
    if (failure) {
      assert.equal(result.sessionDevice, "cpu");
      assert.ok(result.initializationError);
    }
    report.native.push(result);
    await save();
  }
  if (process.env.PECHO_BENCH_FP16 === "1") {
    await prepareFp16();
    report.native.push(await native("webgpu", null, "fp16"));
    await save();
  }
  for (const disableGpu of [false, true]) {
    console.log(`Checking hardened package, disableGpu=${disableGpu}`);
    report.packaged.push(await packaged(disableGpu));
    await save();
  }
  for (const device of ["cpu", "webgpu"]) {
    console.log(`Profiling ${device} (separate from timing)`);
    report.native.push(await native(device, null, "q8", true));
    await save();
  }
  if (process.env.PECHO_BENCH_FP16 === "1")
    report.native.push(await native("webgpu", null, "fp16", true));
  for (const file of await readdir(output)) {
    if (previousFiles.has(file)) continue;
    if (!/^(cpu|webgpu)-(q8|fp16)_.*\.json$/.test(file)) continue;
    const lines = require("node:readline").createInterface({
      input: require("node:fs").createReadStream(path.join(output, file)),
      crlfDelay: Infinity,
    });
    const providers = {};
    for await (const line of lines) {
      if (line === "[" || line === "]") continue;
      const event = JSON.parse(line.replace(/,$/, ""));
      const provider = event.args?.provider;
      if (provider) providers[provider] = (providers[provider] ?? 0) + 1;
    }
    report.profiles.push({ file, providers });
  }
  await save();
  console.log(`Saved ${path.join(output, "results.json")}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

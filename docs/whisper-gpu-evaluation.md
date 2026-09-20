# Whisper GPU evaluation (ALX-52)

## Decision

Keep CPU/q8 as the shipped transcription backend and defer a GPU setting. Native WebGPU/fp16 does improve warm inference on this machine: the median 55-second result is 3.75 seconds versus 4.75 seconds on CPU/q8. However, loading plus first short transcription takes 2.76 seconds versus 2.09 seconds, the existing q8 export is substantially slower on GPU, and fp16 requires new cache/precision handling plus production fallback validation. These small synthetic samples support further fp16 evaluation, not a default switch or a user-facing promise. The measurements below separate native provider execution from Chromium's WebGPU API and hardware inventory.

Two directly related production corrections accompany the evaluation: transcription now requests 30-second chunks with a 5-second overlap on each side, and the Ollama selector no longer compares downloaded file sizes against total VRAM. Previously Whisper's feature extractor silently truncated recordings after 30 seconds; model file bytes also omitted activations, caches, runtime workspaces, other processes, and Ollama's actual device placement.

## Runtime and compatible paths

Validated on Linux x64, Electron 44.4.3 (Chromium 152.0.7977.130, embedded Node 24.21.0), Transformers.js 4.3.0 and native ONNX Runtime 1.30.0. The host's Node 26.9.0 only orchestrates the check. Hardware: Intel Core i9-14900HX, 32 logical CPUs, Intel Raptor Lake integrated graphics plus NVIDIA GeForce RTX 4090 Laptop GPU (16,376 MiB total, driver 615.71.09). Exact kernel, RAM, runtime versions, and measurements are retained in the [compact JSON report](whisper-gpu-results.json).

- **Native CPU/q8:** current production path. The pinned `Xenova/whisper-tiny.en` export contains the quantized encoder and merged decoder and works offline from the existing cache (42,985,755 total file bytes).
- **Native WebGPU/q8:** bundled in this ORT distribution and accepts the same pinned files. ORT profiling shows mixed WebGPU/CPU execution; requesting `webgpu` does not mean every operator runs on the GPU. No renderer migration or GPU download is required for this path.
- **Native WebGPU/fp16:** alternative precision using `encoder_model_fp16.onnx` (16,519,776 bytes) and `decoder_model_merged_fp16.onnx` (59,602,260 bytes) at the same model revision. These are benchmark assets only. The production manifest and downloader still contain q8 files; adopting fp16 would require separate precision-aware manifests/cache status and retaining CPU/q8 fallback assets.
- **Native CUDA:** Transformers.js lists it on Linux x64, but this install's backend inventory marks it unbundled. Session creation fails because its shared library is absent. Installing large optional CUDA dependencies is outside this experiment.
- **Native DirectML/CoreML:** platform-specific candidates, not Linux alternatives. DirectML is explicitly rejected in this runtime. Windows/macOS behavior remains unmeasured.
- **Renderer WebGPU:** the hardened app exposes `navigator.gpu`, but `requestAdapter()` returns null on this machine under normal launch flags. That does not prevent native main-process WebGPU from working. No unsafe-WebGPU flags, production fuses, global driver settings, or app architecture were changed.

The [Transformers.js v4 announcement](https://huggingface.co/blog/transformersjs-v4) explicitly describes server-side WebGPU support. The installed `src/backends/onnx.js` selects native ORT in Node, defaults to CPU, and includes WebGPU among supported device names; `onnxruntime-node.listSupportedBackends()` distinguishes bundled CPU/WebGPU from unbundled CUDA/TensorRT. Neither list proves session initialization, hardware execution, or speed. The [official WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu) also demonstrates `onnx-community/whisper-tiny.en`; its [export inventory](https://huggingface.co/onnx-community/whisper-tiny.en/tree/3a6d57e/onnx) includes fp32, fp16, q8, q4, and other variants. Those additional exports and larger models are candidates, not validated combinations here. Existing pinned Xenova exports avoid an unnecessary model migration for this comparison.

## Method and results

The English fixture is the existing 11-second `jfk.wav`, converted to mono 16 kHz float32 by the language check. The longer input concatenates that exact fixture five times (55 seconds). Both native backends receive identical inputs and generation settings (`return_timestamps: false`, `chunk_length_s: 30`, `stride_length_s: 5`). Each uses a fresh process, measures local-cache pipeline loading separately, and runs each clip three times. The first short inference is cold; subsequent calls reuse the loaded pipeline. This is a small, sequential desktop sample, not an isolated performance lab or meeting-quality benchmark. No microphone capture was used.

Timing runs disable ORT profiling. A separate one-short-clip pass records executed-provider event counts; tracing noticeably changes timing and memory consumption, so its measurements must not be merged with the performance results. Load times include local parsing/session creation, not downloads, process startup, or a cold filesystem cache. Native RSS is main-process resident memory, sampled every 20 ms plus process-lifetime maximum RSS; it is not total application memory or VRAM. NVIDIA per-process memory snapshots after loading/inference are approximate allocations reported for the native main PID, not peaks or incremental tensor requirements. A missing NVIDIA sample is unknown, not zero.

Measured on September 20, 2026; times below are seconds. Warm short columns show both runs; long values show the median and range of all three calls after the short calls.

| Requested native backend | Local load | First 11s clip | Warm 11s clips | Warm 55s clip median (range) | Load + first 11s clip |
| ------------------------ | ---------: | -------------: | -------------: | ---------------------------: | --------------------: |
| CPU/q8                   |      0.891 |          1.199 |   1.080, 1.089 |          4.752 (4.565–4.893) |                 2.090 |
| WebGPU/q8                |      1.297 |          2.628 |   2.588, 2.704 |       16.835 (16.806–17.329) |                 3.925 |
| WebGPU/fp16              |      1.418 |          1.337 |   0.675, 0.777 |          3.746 (3.305–4.003) |                 2.755 |

| Requested native backend | Main RSS before / loaded (MiB) | Main lifetime maximum RSS (MiB) | NVIDIA main-process allocation after load / inference (MiB) |
| ------------------------ | -----------------------------: | ------------------------------: | ----------------------------------------------------------: |
| CPU/q8                   |                      258 / 448 |                           1,427 |                                   No matching process entry |
| WebGPU/q8                |                      259 / 462 |                           1,430 |                                                    71 / 570 |
| WebGPU/fp16              |                      258 / 444 |                           1,423 |                                                   184 / 661 |

NVIDIA entries for the native main PID establish use of the discrete GPU independently of the first GPU returned by system inventory. The separate short-clip trace contains 9,487 CPU operator events for CPU/q8; WebGPU/q8 contains 10,391 WebGPU and 5,138 CPU events; WebGPU/fp16 contains 7,647 WebGPU and 3,660 CPU events. These are executed event counts across encoder/decoder sessions, not unique nodes, time shares, or a percentage of arithmetic performed on GPU. Native GPU acceleration here includes substantial CPU work.

All three candidates produce the same short output on all three calls: “And so my fellow Americans ask not what your country can do for you, ask what you can do for your country.” Longer outputs are deterministic within each candidate but differ between candidates. Against five source repetitions, CPU/q8 emits eight “And so” starts and some shortened phrases; WebGPU/q8 emits six starts and some shortened phrases; WebGPU/fp16 emits six complete repetitions. Thus fp16 does not establish quality equivalence, and none of these outputs is a perfect transcript of the concatenated source. The silence-prefix regression clip also produces a spurious leading “you”, followed by the complete recognizable speech. Chunking preserves late speech; it does not remove Whisper's silence hallucinations or overlap errors.

The hardened executable's CPU IPC check measures 0.866 seconds for loading, 2.028 seconds for the short clip, 11.360 seconds for the repeated clip, and 4.161 seconds for the silence-prefix clip. Chromium-GPU-disabled CPU transcription also succeeds (1.897 seconds). Those figures include Playwright's large audio-array serialization, renderer transfer and IPC overhead; use the native table for backend comparisons, not a subtraction between these different measurement boundaries.

The fixture source is [Xenova/transformers.js-docs at fbe92bd97d48f3ec17779d8d8f2964e1c6bc7634](https://huggingface.co/datasets/Xenova/transformers.js-docs/tree/fbe92bd97d48f3ec17779d8d8f2964e1c6bc7634). Audio stays local and is not bundled or redistributed; the dataset does not declare a dataset-wide license. The model revision is `79fb389fc764e7c395bd330e9531d9d32ada7049`. The report records exact outputs from this local benchmark. Repetition stresses chunk handling but encourages overlap mistakes and is not evidence of real meeting accuracy, multilingual parity, diarization, or robustness to noise.

## Packaging and failure boundaries

The benchmark has two intentionally distinct checks:

1. Installed Electron loads **the packaged `resources/app.asar`** and resolves Transformers/ORT from that ASAR. Playwright evaluates candidate pipelines in its main process. This exercises packaged dependencies, native binary resolution, offline model loading, and real inference; it does not run the hardened shipped executable's main-process debugger. The installed test executable is needed because production security fuses disable that debugger.
2. The **actual hardened packaged executable** is spawned normally and attached through Chromium CDP. Real renderer IPC loads/transcribes on the shipped CPU service. The updated check includes an additional 46-second input containing 35 seconds of silence followed by the recognizable 11-second speech, proving that speech beyond the first Whisper window reaches inference. It also launches with Chromium GPU disabled and verifies successful CPU transcription. Those Chromium flags do not disable native ORT/Vulkan; this is a renderer-unavailable check, not proof of physically missing native GPU hardware.

The prototype harness retries native CPU/q8 after a real unavailable-CUDA initialization error, a real unsupported-DirectML error, and an explicitly injected WebGPU initialization exception. Each retry must produce the known speech phrase. These are benchmark-local fallback experiments, not a shipped automatic GPU fallback feature. Production remains explicitly CPU/q8 and does not attempt a GPU session. Device loss during inference, out-of-memory failures, hard driver crashes, and machines without a native WebGPU adapter are not covered by these three cases. A production adoption would need initialization and inference recovery, disposal/isolation, a single CPU retry, and truthful requested/active/fallback status before users could rely on it.

## Reproduce

Requires Linux, a display, the installed dependencies, a packaged build, and the local fixture/model cache prepared by the language check. Benchmark processes have bounded timeouts and isolated temporary profiles; inference disallows remote models. The existing model cache is only read. The optional fp16 downloads are pinned, checked against the measured file lengths, and stored separately under `.cache/whisper-backends/fp16`.

```sh
npm run package
# Only if the existing local speech/model fixtures are absent:
PECHO_LANGUAGE_PROFILE=.cache/language-profile node scripts/check-languages-packaged.cjs
# Existing CPU/q8 assets only:
node scripts/benchmark-whisper-backends.cjs
# Include the ~76 MB fp16 alternative (reuses files on subsequent runs):
PECHO_BENCH_FP16=1 node scripts/benchmark-whisper-backends.cjs
```

Results and separate ORT traces are written under `.cache/whisper-backends`. Traces can be large; only the compact measurement report belongs in source control. GPU inventory via `nvidia-smi` is optional; the check records null when it is unavailable. The app's `systeminformation` inventory remains separate from this backend validation and is not an inference-device detector.

Before reconsidering adoption, demonstrate a repeatable load-plus-transcription improvement on representative meeting audio, verify accuracy against references, repeat on target operating systems/devices, and prove the selected backend plus CPU recovery through the hardened packaged service. A different export/precision could change the result; this decision does not claim GPU transcription is universally slower.

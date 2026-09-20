# Modernization checks and compiler evaluation

Validated locally on September 20, 2026, on Linux x64, Intel Core i9-14900HX,
Node 26.9.0. Windows and macOS are configured in CI but have not been run locally
or remotely as part of this change.

## Reproduce the checks

```sh
npm ci
npm run check
npm run package
npm run test:e2e:packaged
npm audit
npm run bench:compiler
```

`check` runs Oxfmt, a production renderer build (including generated routes),
TypeScript 7, type-aware Oxlint, and unit tests. Oxlint uses `oxlint-tsgolint`
7.0.2002 alongside TypeScript 7.0.2. Its rules include `no-floating-promises`
with `ignoreVoid: false`, `no-misused-promises`, and `await-thenable`, in addition
to the existing correctness and React rules. An explicit `void` cannot hide an
unhandled promise. See [Oxlint's type-aware setup](https://oxc.rs/docs/guide/usage/linter/type-aware).

The async fixes await window loading and system-theme restoration, handle startup
and UI IPC failures, and give polling timers synchronous callbacks with rejection
handlers. New regressions cover failed system-theme IPC, model poll recovery,
unmount during a rejected poll, and transcription failure followed by recording
retry. No rule is disabled to accommodate these paths.

The three-platform workflow uses npm 12.0.2 to enforce `allowScripts`, uses the
lockfile, and packages each host's app before
UI testing. The launcher selects the platform/architecture-specific executable,
attaches via Chromium CDP without changing production fuses, and bounds shutdown
with signal escalation. It cleans up after startup failures. The two packaged UI
tests explicitly record and attach Playwright traces; manually attached CDP
contexts do not inherit Playwright fixture tracing. CI uploads reports on failure.
The Linux-only native geometry test loads the packaged ASAR with the installed
Electron binary under Ozone headless so native bounds can be inspected.

## React Compiler comparison

The benchmark builds the same production renderer configuration and source tree,
changing only the React Compiler integration. Each compiler receives one warm-up
build, followed by five fresh-process builds in alternating order. The reported
wall time includes Node/Vite startup and bundling; it is not a transform-only or
cold-machine benchmark. Every build starts with an emptied output directory.
The script saves raw build logs, output, and JSON results under
`.cache/compiler-benchmark/`; set `PECHO_BENCH_RUNS` to increase repetitions.

Versions: Vite 8.3.0, plugin-react 6.1.1, Babel 8.0.6,
`@rolldown/plugin-babel` 0.2.4, Babel React Compiler 1.0.0,
`oxc-transform-react` 0.145.0. Although npm's current Oxc release is 0.150.0,
plugin-react 6.1.1 requires `^0.145.0`; this evaluation respects that peer range.
[Native React Compiler support is experimental](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#react-compiler).

| Measurement                      |                        Babel |                   Native Oxc |
| -------------------------------- | ---------------------------: | ---------------------------: |
| Measured wall times (ms)         | 1861, 2174, 2173, 2074, 2216 | 1272, 1110, 1067, 1228, 1151 |
| Median (ms)                      |                         2173 |                         1151 |
| Range (ms)                       |                    1861–2216 |                    1067–1272 |
| Total emitted JavaScript (bytes) |                       588043 |                       589240 |
| Sum of gzipped JS chunks (bytes) |                       190313 |                       190769 |

Oxc reduced median renderer build time by 47%, about one second here, with a
456-byte gzip increase (0.24%). Both outputs contain React Compiler memo-cache
markers and equivalent route/chunk coverage; they are not byte-identical.
Both separately packaged builds passed all three Electron E2E tests. The ordinary
unit suite tests source behavior without React Compiler enabled; the packaged
E2E runs are the evidence for compiled renderer compatibility.

Oxc emits four recoverable diagnostics for `try/finally` in `useRecording`,
`useWhisperModels`, and `WhisperModels`, leaving those functions unoptimized.
A separate Babel compiler logger inspection reports the same four unsupported
constructs. Cleanup is preserved; it is not rewritten to satisfy an optimizer.
Oxc diagnostics remain enabled so future changes stay visible.

**Decision:** use Oxc by default after the measured improvement and packaged
compatibility checks. Keep Babel dependencies and the selector for comparison or
fallback: set `PECHO_REACT_COMPILER=babel` before `npm run package` or
`npm run build:renderer` (PowerShell: `$env:PECHO_REACT_COMPILER = 'babel'`).
Unset it to restore the default. Unknown values fail explicitly.

## Validation boundary

Locally passed: Oxfmt, type-aware Oxlint, TS7, 41 unit tests, production renderer
build, Linux packaging, and all three packaged E2E tests for both compiler paths.
The final default package also passed the E2E suite. npm audit reports no known
vulnerabilities. These are local results, not a claim of a remote CI run.

The UI checks use an HTTP Ollama protocol fixture and an oscillator-backed audio
stream, never microphone capture. Real Whisper English/French inference and
offline model-management checks remain the separately documented opt-in scripts
in the README; they are not part of this compiler benchmark or CI. Physical
capture, real Ollama output, Windows/macOS packaged behavior, dock appearance,
monitor hot-plugging, installers, signing and notarization still need their
respective platform/service validation.

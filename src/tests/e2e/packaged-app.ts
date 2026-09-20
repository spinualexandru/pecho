import {
  chromium,
  expect,
  type Browser,
  type BrowserContext,
  type TestInfo,
} from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const packageRoot = path.resolve(
  `out/Personal Echo-${process.platform}-${process.arch}`,
);
const appRoot =
  process.platform === "darwin"
    ? path.join(packageRoot, "Personal Echo.app", "Contents")
    : packageRoot;
export const packagedAsar = path.join(
  appRoot,
  process.platform === "darwin" ? "Resources" : "resources",
  "app.asar",
);
const executable =
  process.platform === "darwin"
    ? path.join(appRoot, "MacOS", "Personal Echo")
    : path.join(
        appRoot,
        process.platform === "win32" ? "Personal Echo.exe" : "Personal Echo",
      );

function waitForExit(
  child: ChildProcess,
  milliseconds: number,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, milliseconds);
    child.once("exit", onExit);
  });
}
async function terminate(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid)
    return;
  child.kill("SIGTERM");
  if (await waitForExit(child, 2000)) return;
  child.kill("SIGKILL");
  if (!(await waitForExit(child, 2000)))
    throw new Error("Packaged app did not exit after SIGKILL");
}

// Production fuses disable the Node debugger used by electron.launch. Attach to
// Chromium instead, keeping the shipped binary and its security fuses intact.
export async function launchPackaged(
  profile: string,
  env: NodeJS.ProcessEnv = process.env,
  testInfo?: TestInfo,
) {
  await mkdir(".cache", { recursive: true });
  const child = spawn(
    executable,
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`],
    {
      env: { ...env, ELECTRON_RUN_AS_NODE: "" },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let browser: Browser | undefined;
  let tracedContext: BrowserContext | undefined;
  const finishTrace = async () => {
    if (!tracedContext || !testInfo) return;
    const context = tracedContext;
    tracedContext = undefined;
    const tracePath = testInfo.outputPath("packaged-trace.zip");
    await context.tracing.stop({ path: tracePath });
    await testInfo.attach("packaged-trace", {
      path: tracePath,
      contentType: "application/zip",
    });
  };
  let logs = "";
  try {
    const endpoint = await new Promise<string>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("No debugger endpoint: " + logs)),
        20000,
      );
      child.stderr.on("data", (chunk) => {
        logs = (logs + String(chunk)).slice(-16000);
        const match = logs.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(deadline);
          resolve(match[1]);
        }
      });
      child.once("error", (error) => {
        clearTimeout(deadline);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(deadline);
        reject(new Error(`App exited ${code ?? signal}: ${logs}`));
      });
    });
    browser = await chromium.connectOverCDP(endpoint, { timeout: 20000 });
    const context = browser.contexts()[0];
    if (testInfo) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      });
      tracedContext = context;
    }
    const page =
      context.pages()[0] ??
      (await context.waitForEvent("page", { timeout: 20000 }));
    await expect(
      page.getByRole("heading", { name: "Personal Echo" }),
    ).toBeVisible();
    const connectedBrowser = browser;
    return {
      firstWindow: async () => page,
      close: async () => {
        // Close the native window first so its state is persisted. On macOS the
        // app remains alive without windows, so follow with bounded termination.
        await finishTrace().catch((error) =>
          console.error("Could not save packaged trace", error),
        );
        const quit = page
          .evaluate(() => window.electronWindow.close())
          .catch(() => {});
        let timer: ReturnType<typeof setTimeout> | undefined;
        await Promise.race([
          quit,
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 3000);
          }),
        ]);
        clearTimeout(timer);
        await waitForExit(child, 1000);
        try {
          await terminate(child);
        } finally {
          await connectedBrowser.close().catch(() => {});
        }
      },
    };
  } catch (error) {
    await finishTrace().catch((traceError) =>
      console.error("Could not save startup trace", traceError),
    );
    try {
      await terminate(child);
    } finally {
      await browser?.close().catch(() => {});
    }
    throw error;
  }
}

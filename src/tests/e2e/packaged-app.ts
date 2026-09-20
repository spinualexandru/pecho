import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";

// Production fuses disable the Node debugger used by electron.launch. Attach to
// Chromium instead, keeping the shipped binary and its security fuses intact.
export async function launchPackaged(
  profile: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const child = spawn(
    path.resolve("out/Personal Echo-linux-x64/Personal Echo"),
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`],
    { env: { ...env, ELECTRON_RUN_AS_NODE: "" } },
  );
  let logs = "";
  const endpoint = await new Promise<string>((resolve, reject) => {
    const deadline = setTimeout(() => {
      child.kill();
      reject(new Error("No debugger endpoint: " + logs));
    }, 20000);
    child.stderr.on("data", (chunk) => {
      logs += chunk;
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
    child.once("exit", (code) => {
      clearTimeout(deadline);
      reject(new Error(`App exited ${code}: ${logs}`));
    });
  });
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent("page"));
  await expect(
    page.getByRole("heading", { name: "Personal Echo" }),
  ).toBeVisible();
  return {
    firstWindow: async () => page,
    close: async () => {
      // A graceful app quit writes native window persistence before restart.
      const exited = new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once("exit", () => resolve());
      });
      await page.evaluate(() => window.electronWindow.close()).catch(() => {});
      const deadline = setTimeout(() => child.kill("SIGTERM"), 5000);
      await exited;
      clearTimeout(deadline);
      await browser.close().catch(() => {});
    },
  };
}

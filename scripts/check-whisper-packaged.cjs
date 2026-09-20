// Opt-in Linux integration check: downloads the real ~43 MB Tiny checkpoint.
// Network namespaces prove offline behavior in the hardened packaged binary.
// Run after `npm run package`: node scripts/check-whisper-packaged.cjs
const { spawn, execFileSync } = require("node:child_process");
const { mkdtemp, mkdir, rm, stat } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const tiny = "Xenova/whisper-tiny.en";

async function stage(mode, profile) {
  if (mode !== "online") execFileSync("ip", ["link", "set", "lo", "up"]);
  const child = spawn(
    path.resolve("out/Personal Echo-linux-x64/Personal Echo"),
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-sandbox"],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "" } },
  );
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  let browser;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("No debugger endpoint: " + logs)),
        20000,
      );
      child.stderr.on("data", (chunk) => {
        const match = String(chunk).match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(deadline);
          resolve(match[1]);
        }
      });
      child.once("exit", (code) => {
        clearTimeout(deadline);
        reject(new Error(`App exited ${code}: ${logs}`));
      });
    });
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? (await context.waitForEvent("page"));
    await expect(
      page.getByRole("heading", { name: "Personal Echo" }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    const card = page.getByRole("region", { name: "Tiny model cache" });
    await expect(card).toBeVisible();
    if (mode === "failure") {
      await card.getByRole("button", { name: "Download", exact: true }).click();
      await expect(
        card.getByRole("button", { name: "Retry", exact: true }),
      ).toBeEnabled({ timeout: 30000 });
      assert.equal(
        (await page.evaluate(() => window.recording.getWhisperModels()))[0]
          .cached,
        false,
      );
      console.log(
        "PASS: real packaged download failure clears busy state and offers retry",
      );
    } else if (mode === "online") {
      await card.getByRole("button", { name: "Download", exact: true }).click();
      await expect(card.getByRole("progressbar")).toBeVisible({
        timeout: 20000,
      });
      await expect(
        card.getByText("43.0 MB total · Cached · Offline ready", {
          exact: true,
        }),
      ).toBeVisible({ timeout: 180000 });
      await expect(
        card.getByRole("button", { name: "Delete", exact: true }),
      ).toBeEnabled({ timeout: 30000 });
      const status = (
        await page.evaluate(() => window.recording.getWhisperModels())
      )[0];
      assert.equal(status.cachedBytes, status.totalBytes);
      assert.equal(status.error, null);
      await page.screenshot({ path: ".cache/whisper-models.png" });
      console.log(
        `PASS: real packaged first download and initialization (${status.totalBytes} bytes), aggregate progress, recovery after restart`,
      );
    } else {
      await expect(
        card.getByText("43.0 MB total · Cached · Offline ready", {
          exact: true,
        }),
      ).toBeVisible();
      // This entire process, including the app's main process, has no network.
      const text = await page.evaluate(() =>
        window.recording.transcribeAudio(
          new Float32Array(16000).buffer,
          "Xenova/whisper-tiny.en",
          "en",
        ),
      );
      assert.equal(typeof text, "string");
      console.log(
        "PASS: cached discovery and real native inference after restart with no network",
        JSON.stringify(text),
      );
      await card.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(card.getByText(/It stays selected/)).toBeVisible();
      await card
        .getByRole("button", { name: "Delete files", exact: true })
        .click();
      await expect(
        card.getByRole("button", { name: "Download", exact: true }),
      ).toBeEnabled();
      await expect(
        card.getByText("43.0 MB total · Not downloaded", { exact: true }),
      ).toBeVisible();
      await expect(
        card.getByText("Tiny · Selected", { exact: true }),
      ).toBeVisible();
      await assert.rejects(stat(path.join(profile, "transformers", tiny)), {
        code: "ENOENT",
      });
      console.log(
        "PASS: packaged offline deletion disposes the loaded model, removes files and preserves selection",
      );
    }
  } finally {
    child.kill("SIGTERM");
    await browser?.close().catch(() => {});
    if (child.exitCode === null)
      await new Promise((resolve) => child.once("exit", resolve));
  }
}

(async () => {
  if (process.argv[2]) return stage(process.argv[2], process.argv[3]);
  await mkdir(".cache", { recursive: true });
  const profile = await mkdtemp(path.join(tmpdir(), "pecho-model-e2e-"));
  try {
    for (const mode of ["failure", "online", "offline"]) {
      const args = [__filename, mode, profile];
      const command = mode === "online" ? process.execPath : "unshare";
      const fullArgs =
        mode === "online"
          ? args
          : ["--user", "--map-root-user", "--net", process.execPath, ...args];
      await new Promise((resolve, reject) => {
        const check = spawn(command, fullArgs, { stdio: "inherit" });
        check.once("error", reject);
        check.once("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`${mode} check exited ${code}`)),
        );
      });
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

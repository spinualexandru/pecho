import { launchPackaged, packagedAsar } from "./packaged-app";
import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("packaged meeting draft, synthetic recording and reduced motion survive route navigation", async ({
  browserName: _browserName,
}, testInfo) => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "pecho-desktop-"));
  let app: Awaited<ReturnType<typeof launchPackaged>> | undefined;
  try {
    app = await launchPackaged(profile, process.env, testInfo);
    const page = await app.firstWindow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page
      .getByRole("button", { name: "Manual Input", exact: true })
      .click();
    const editor = page.getByRole("textbox", {
      name: "Manual Transcript Input",
    });
    await expect(editor).toBeFocused();
    await editor.fill("Keep this draft while changing settings.");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(editor).toHaveValue(
      "Keep this draft while changing settings.",
    );
    expect(
      await page
        .locator(".meeting-phase")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    // Synthetic MediaStream from an oscillator: never requests a microphone.
    await page.evaluate(() => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const output = context.createMediaStreamDestination();
      oscillator.connect(output);
      oscillator.start();
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => output.stream,
      });
      Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
        value: async () => {
          throw new Error("Synthetic microphone only");
        },
      });
      Object.assign(window, {
        syntheticCapture: { context, stream: output.stream },
      });
    });
    await page
      .getByRole("button", { name: "Voice Recording", exact: true })
      .click();
    await expect(page.getByText("Recording in Progress")).toBeVisible();
    await expect(
      page.getByText("Capturing microphone only", { exact: false }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Resume", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as { syntheticCapture: { stream: MediaStream } }
          ).syntheticCapture.stream.getTracks()[0].readyState,
      ),
    ).toBe("live");
    await page.screenshot({ path: ".cache/desktop-recording.png" });
    // Closing the app releases capture; do not stop/submit fake audio to Whisper.
  } finally {
    await app?.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("packaged window restores named geometry across relaunch", async () => {
  test.skip(
    process.platform !== "linux",
    "Ozone headless geometry is a Linux test",
  );
  const profile = await mkdtemp(path.join(os.tmpdir(), "pecho-window-"));
  const launch = (screen = "1280,800") =>
    electron.launch({
      args: [
        packagedAsar,
        `--user-data-dir=${profile}`,
        "--ozone-platform=headless",
        `--ozone-override-screen-size=${screen}`,
      ],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
    });
  let app = await launch();
  try {
    await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setBounds({
        x: 50,
        y: 60,
        width: 640,
        height: 480,
      });
    });
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].getBounds(),
        ),
      )
      .toEqual({ x: 50, y: 60, width: 640, height: 480 });
    // Native persistence debounces resize events; wait for its observable file.
    await expect
      .poll(
        async () => {
          try {
            return JSON.parse(
              await readFile(path.join(profile, "Local State"), "utf8"),
            ).windowStates?.["personal-echo-main"]?.left;
          } catch {
            return null;
          }
        },
        { timeout: 15000 },
      )
      .toBe(50);
    await app.close();
    app = await launch();
    await app.firstWindow();
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].getBounds(),
        ),
      )
      .toEqual({ x: 50, y: 60, width: 640, height: 480 });
    await app.close();
    app = await launch("500,400");
    await app.firstWindow();
    const adjusted = await app.evaluate(({ BrowserWindow, screen }) => ({
      bounds: BrowserWindow.getAllWindows()[0].getBounds(),
      workArea: screen.getPrimaryDisplay().workArea,
    }));
    expect(adjusted.bounds.x).toBeGreaterThanOrEqual(adjusted.workArea.x);
    expect(adjusted.bounds.y).toBeGreaterThanOrEqual(adjusted.workArea.y);
    expect(adjusted.bounds.x + adjusted.bounds.width).toBeLessThanOrEqual(
      adjusted.workArea.x + adjusted.workArea.width,
    );
    expect(adjusted.bounds.y + adjusted.bounds.height).toBeLessThanOrEqual(
      adjusted.workArea.y + adjusted.workArea.height,
    );
  } finally {
    await app?.close();
    await rm(profile, { recursive: true, force: true });
  }
});

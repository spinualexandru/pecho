import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Launch the real Electron binary and production bundles, with isolated preferences.
// Ollama responses are stubbed so this test needs no local LLM or model downloads.
test("opens the app, changes settings, and summarizes a manual transcript over IPC", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "pecho-e2e-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${profile}`],
    env: { ...process.env, NODE_ENV: "test", ELECTRON_RUN_AS_NODE: "" },
  });
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("recording:get-ollama-models");
      ipcMain.handle("recording:get-ollama-models", () => [
        { name: "test-model", modified_at: "2026-09-20", size: 1024 },
      ]);
      ipcMain.removeHandler("recording:summarize-transcript");
      ipcMain.handle(
        "recording:summarize-transcript",
        (_event, transcript, model, language) => {
          if (model !== "test-model" || language !== "ro") {
            throw new Error(`Unexpected preferences: ${model}, ${language}`);
          }
          return `## Test summary\n\n${transcript}`;
        },
      );
    });
    const errors: string[] = [];
    window.on("pageerror", (error) => errors.push(error.message));
    await window.reload();
    await expect(
      window.getByRole("heading", { name: "Personal Echo" }),
    ).toBeVisible();
    await window.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(
      window.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await window.getByLabel("Summary Output Language", { exact: true }).click();
    await window.getByRole("option", { name: "Romanian", exact: true }).click();
    await window.getByRole("link", { name: "Home", exact: true }).click();
    await window
      .getByRole("button", { name: "Manual Input", exact: true })
      .click();
    await window
      .getByPlaceholder("Enter your meeting transcript here...")
      .fill("We agreed to ship on Friday.");
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect(
      window.getByRole("heading", { name: "Test summary", exact: true }),
    ).toBeVisible();
    await expect(
      window.getByRole("button", { name: "Export", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});

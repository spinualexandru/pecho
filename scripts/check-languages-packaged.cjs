// Opt-in real speech + language settings check. Requires a display and ffmpeg.
// Run after npm run package. Public fixtures and CPU/q8 model downloads total ~87 MB.
const { spawn, execFileSync } = require("node:child_process");
const { mkdtemp, mkdir, rm, readFile, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, expect } = require("@playwright/test");
const fixtureRevision = "fbe92bd97d48f3ec17779d8d8f2964e1c6bc7634";

async function launch(profile) {
  const child = spawn(
    path.resolve("out/Personal Echo-linux-x64/Personal Echo"),
    ["--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-sandbox"],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "" } },
  );
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  const endpoint = await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      child.kill();
      reject(new Error("No debugger endpoint: " + logs));
    }, 20000);
    child.stderr.on("data", (chunk) => {
      logs += chunk;
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
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.waitForEvent("page"));
  await expect(
    page.getByRole("heading", { name: "Personal Echo" }),
  ).toBeVisible({ timeout: 20000 });
  return {
    page,
    close: async () => {
      child.kill("SIGTERM");
      await browser.close().catch(() => {});
      if (child.exitCode === null)
        await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}
async function select(page, label, name) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
(async () => {
  await mkdir(".cache", { recursive: true });
  const profile = process.env.PECHO_LANGUAGE_PROFILE
    ? path.resolve(process.env.PECHO_LANGUAGE_PROFILE)
    : await mkdtemp(path.join(tmpdir(), "pecho-languages-"));
  await mkdir(profile, { recursive: true });
  let running;
  try {
    const samples = [];
    for (const [file, language, model] of [
      ["jfk.wav", "en", "Xenova/whisper-tiny.en"],
      ["french-audio.wav", "fr", "Xenova/whisper-tiny"],
    ]) {
      const response = await fetch(
        `https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/${fixtureRevision}/${file}`,
      );
      assert.equal(response.ok, true);
      const source = path.join(profile, file);
      await writeFile(source, new Uint8Array(await response.arrayBuffer()));
      const raw = source + ".f32";
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-y",
        "-i",
        source,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "f32le",
        raw,
      ]);
      const buffer = await readFile(raw);
      samples.push({
        file,
        language,
        model,
        audio: Array.from(
          new Float32Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength / 4,
          ),
        ),
      });
    }
    running = await launch(profile);
    const { page } = running;
    await page.evaluate(() => localStorage.setItem("lang", "en"));
    await page.reload();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await select(page, "Transcription Language", "French");
    for (const sample of samples) {
      await select(
        page,
        "Transcription Language",
        sample.language === "en" ? "English" : "French",
      );
      if (sample.language === "en")
        await select(page, "Whisper Model", /Tiny · English only/);
      const settings = await page.evaluate(() => ({
        model: localStorage.getItem("whisper_model"),
        language: localStorage.getItem("transcriber_language"),
      }));
      assert.equal(settings.model, sample.model);
      assert.equal(settings.language, sample.language);
      const text = await page.evaluate(
        async ({ audio, model, language }) =>
          window.recording.transcribeAudio(
            new Float32Array(audio).buffer,
            model,
            language,
          ),
        { ...sample, ...settings },
      );
      console.log(
        `REAL ${sample.language} (${sample.model}): ${JSON.stringify(text)}`,
      );
      if (sample.language === "en")
        assert.match(text, /ask not what your country can do for you/i);
      else assert.match(text, /j.adore.*j.aime.*je n.aime pas.*je déteste/i);
    }
    await assert.rejects(
      page.evaluate(() =>
        window.recording.transcribeAudio(
          new Float32Array(16000).buffer,
          "Xenova/whisper-tiny.en",
          "fr",
        ),
      ),
      /English-only/,
    );
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await select(page, "Transcription Language", "French");
    await expect(
      page.getByLabel("Whisper Model", { exact: true }),
    ).toContainText("Tiny multilingual");
    await page.getByLabel("Whisper Model", { exact: true }).click();
    await expect(
      page.getByRole("option", { name: /Tiny · English only/ }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await select(page, "Summary Output Language", "Romanian");
    await select(page, "Interface Language", "Română");
    await expect(
      page.getByRole("heading", { name: "Setări", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Limba transcrierii", { exact: true }),
    ).toHaveText("Franceză");
    await expect(
      page.getByLabel("Limba rezumatului", { exact: true }),
    ).toHaveText("Română");
    await page.getByRole("link", { name: "Acasă", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Înregistrare vocală" }),
    ).toBeVisible();
    await page.screenshot({ path: ".cache/languages-romanian-home.png" });
    await running.close();
    running = null;
    running = await launch(profile);
    await running.page
      .getByRole("link", { name: "Setări", exact: true })
      .click();
    await expect(
      running.page.getByLabel("Limba interfeței", { exact: true }),
    ).toHaveText("Română");
    await expect(
      running.page.getByLabel("Limba transcrierii", { exact: true }),
    ).toHaveText("Franceză");
    await expect(
      running.page.getByLabel("Limba rezumatului", { exact: true }),
    ).toHaveText("Română");
    await expect(
      running.page.getByLabel("Model Whisper", { exact: true }),
    ).toContainText("Tiny multilingv");
    assert.equal(await running.page.locator("html").getAttribute("lang"), "ro");
    await running.page
      .getByLabel("Limba interfeței", { exact: true })
      .scrollIntoViewIfNeeded();
    await running.page.screenshot({
      path: ".cache/languages-romanian-settings.png",
    });
    console.log(
      "PASS: real English/French speech, incompatible IPC rejection, automatic multilingual selection, translated UI and independent preferences across app restart",
    );
  } finally {
    await running?.close();
    if (!process.env.PECHO_LANGUAGE_PROFILE)
      await rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

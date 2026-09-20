import { test, expect, _electron as electron } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

test("real Electron IPC and HTTP streaming handle availability, structured results, failures and cancellation", async () => {
  test.setTimeout(90_000);
  let availability: "unavailable" | "empty" | "ready" = "unavailable";
  let generation:
    | "valid"
    | "malformed"
    | "interrupted"
    | "error"
    | "delayed"
    | "slow" = "valid";
  let canceledConnections = 0;
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    if (availability === "unavailable") {
      res.destroy();
      return;
    }
    if (req.url === "/api/version") {
      res.end(JSON.stringify({ version: "fixture-1" }));
      return;
    }
    if (req.url === "/api/tags") {
      res.end(
        JSON.stringify({
          models:
            availability === "empty"
              ? []
              : [
                  {
                    name: "fixture-model",
                    modified_at: "2026-09-20",
                    size: 1024,
                  },
                ],
        }),
      );
      return;
    }
    if (req.url !== "/api/chat") {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk.toString();
    requests.push(JSON.parse(body));
    const mode = generation;
    let timer: ReturnType<typeof setTimeout>;
    res.on("close", () => {
      clearTimeout(timer);
      if (!res.writableEnded) canceledConnections++;
    });
    if (mode === "error") {
      res.end('{"error":"fixture generation failure"}\n');
      return;
    }
    const output =
      mode === "malformed"
        ? '{"summary":"Missing required fields"}'
        : JSON.stringify({
            summary: "Am decis să livrăm vineri. 🚀",
            decisions: ["Livrare vineri"],
            actionItems: [
              { task: "Pregătește lansarea", owner: "Alex", dueDate: "Vineri" },
            ],
          });
    const send = () => {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write(
        JSON.stringify({
          message: { content: output.slice(0, 25) },
          done: false,
        }) + "\n",
      );
      timer = setTimeout(
        () => {
          res.end(
            JSON.stringify({
              message: { content: output.slice(25) },
              done: mode !== "interrupted",
            }),
          );
        },
        mode === "slow" ? 5000 : 250,
      );
    };
    if (mode === "delayed") timer = setTimeout(send, 5000);
    else send();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture port");
  const profile = await mkdtemp(path.join(os.tmpdir(), "pecho-e2e-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${profile}`],
    env: {
      ...process.env,
      NODE_ENV: "test",
      ELECTRON_RUN_AS_NODE: "",
      OLLAMA_HOST: `127.0.0.1:${address.port}/`,
    },
  });
  try {
    const window = await app.firstWindow();
    const errors: string[] = [];
    window.on("pageerror", (error) => errors.push(error.message));
    await expect(
      window.getByText(
        "Could not load Ollama models. Check that Ollama is running.",
      ),
    ).toBeVisible();
    availability = "empty";
    await window
      .getByRole("button", { name: "Refresh models", exact: true })
      .click();
    await expect(
      window.getByText(
        "Ollama has no models. Install a model in Ollama, then refresh.",
      ),
    ).toBeVisible();
    availability = "ready";
    await window
      .getByRole("button", { name: "Refresh models", exact: true })
      .click();
    await expect(
      window.getByText("Ollama connected · fixture-1"),
    ).toBeVisible();
    await expect(window.getByRole("combobox")).toHaveText("fixture-model");
    // An explicit refresh must invalidate previously usable cached models.
    availability = "empty";
    await window
      .getByRole("button", { name: "Refresh models", exact: true })
      .click();
    await expect(window.getByRole("combobox")).toBeDisabled();
    availability = "ready";
    await window
      .getByRole("button", { name: "Refresh models", exact: true })
      .click();
    await expect(window.getByRole("combobox")).toBeEnabled();
    await window.getByRole("link", { name: "Settings", exact: true }).click();
    await window.getByLabel("Summary Output Language", { exact: true }).click();
    await window.getByRole("option", { name: "Romanian", exact: true }).click();
    await window.getByRole("link", { name: "Home", exact: true }).click();
    const manual = async () => {
      await window
        .getByRole("button", { name: "Manual Input", exact: true })
        .click();
      await window
        .getByPlaceholder("Enter your meeting transcript here...")
        .fill("We agreed to ship on Friday. Alex prepares the release.");
      await window
        .getByRole("button", { name: "Generate Summary", exact: true })
        .click();
    };
    await manual();
    await expect(window.getByTestId("summary-preview")).toContainText(
      "Am decis",
    );
    await expect(window.getByTestId("structured-summary")).toContainText(
      "Pregătește lansarea",
    );
    await expect(window.getByTestId("structured-summary")).toContainText(
      "Owner: Alex",
    );
    await window.screenshot({
      path: ".cache/summary-structured.png",
      fullPage: true,
    });
    expect(JSON.stringify(requests[0])).toContain("Romanian");
    expect(requests[0].format).toMatchObject({
      type: "object",
      required: ["summary", "decisions", "actionItems"],
    });
    // Starting manual entry after a completed transcript must show the editor.
    generation = "malformed";
    await manual();
    await expect(
      window.getByText("The model returned an invalid summary. Please retry."),
    ).toBeVisible();
    await expect(window.getByTestId("structured-summary")).toHaveCount(0);
    generation = "interrupted";
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect(
      window.getByText("Could not generate the summary. Please retry."),
    ).toBeVisible();
    await expect(window.getByTestId("structured-summary")).toHaveCount(0);
    generation = "error";
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect(window.getByRole("alert")).toContainText(
      "Could not generate the summary. Please retry.",
    );
    generation = "delayed";
    const beforeDelay = requests.length;
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect.poll(() => requests.length).toBe(beforeDelay + 1);
    await window
      .getByRole("button", { name: "Cancel generation", exact: true })
      .click();
    await expect(
      window.getByText("Summary canceled", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => canceledConnections).toBeGreaterThan(0);
    generation = "slow";
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect(window.getByTestId("summary-preview")).toContainText(
      "Am decis",
    );
    await window
      .getByRole("button", { name: "Cancel generation", exact: true })
      .click();
    await expect(
      window.getByText("Summary canceled", { exact: true }),
    ).toBeVisible();
    await expect.poll(() => canceledConnections).toBeGreaterThan(1);
    await window
      .getByRole("button", { name: "Generate Summary", exact: true })
      .click();
    await expect(window.getByTestId("summary-preview")).toContainText(
      "Am decis",
    );
    await window.getByRole("link", { name: "Settings", exact: true }).click();
    await expect.poll(() => canceledConnections).toBeGreaterThan(2);
    await window.getByRole("link", { name: "Home", exact: true }).click();
    await expect(window.getByTestId("structured-summary")).toHaveCount(0);
    generation = "valid";
    await manual();
    await expect(window.getByTestId("structured-summary")).toContainText(
      "Livrare vineri",
    );
    const invalid = await window.evaluate(async () => {
      const api = globalThis.window.recording;
      const results = await Promise.allSettled([
        api.startSummary({
          requestId: crypto.randomUUID(),
          transcript: "",
          model: "fixture-model",
          language: "invalid",
        }),
        api.cancelSummary("invalid-id"),
        api.transcribeAudio(new ArrayBuffer(3)),
        api.transcribeAudio(
          new Float32Array([0]).buffer,
          "Xenova/whisper-tiny.en",
          "ro",
        ),
      ]);
      return results.map((result) => result.status);
    });
    expect(invalid).toEqual(["rejected", "rejected", "rejected", "rejected"]);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(profile, { recursive: true, force: true });
  }
});

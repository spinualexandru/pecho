import { expect, it, vi } from "vitest";
vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
import { DesktopProgress } from "@/services/desktop-progress";
it("keeps concurrent progress and clears completion, errors and dead owners", async () => {
  const publish = vi.fn();
  const progress = new DesktopProgress(publish);
  progress.set("1:summary", 2);
  progress.set("2:download", 0.5);
  expect(publish).toHaveBeenLastCalledWith(2);
  progress.clearOwner(1);
  expect(publish).toHaveBeenLastCalledWith(0.5);
  progress.clearOwner(2);
  expect(publish).toHaveBeenLastCalledWith(-1);
  await expect(
    progress.run("3:failed", async () => {
      throw new Error("failed");
    }),
  ).rejects.toThrow("failed");
  expect(publish).toHaveBeenLastCalledWith(-1);
  await progress.run("3:complete", async () => "done");
  expect(publish).toHaveBeenLastCalledWith(-1);
});
it("ignores an unsupported dock and late progress after completion", async () => {
  const publish = vi.fn();
  const progress = new DesktopProgress(publish);
  let resolve!: (value: number) => void;
  await progress.run(
    "1:download",
    async () => {},
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  resolve(0.5);
  await Promise.resolve();
  expect(publish).toHaveBeenLastCalledWith(-1);
  const unsupported = new DesktopProgress(() => {
    throw new Error("no dock");
  });
  expect(() => unsupported.set("job", 2)).not.toThrow();
});
it("does not resurrect a closed owner when an in-flight poll resolves", async () => {
  const publish = vi.fn();
  const progress = new DesktopProgress(publish);
  let resolvePoll!: (value: number) => void;
  let finish!: () => void;
  const task = progress.run(
    "1:download",
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
    () =>
      new Promise((done) => {
        resolvePoll = done;
      }),
  );
  progress.clearOwner(1);
  resolvePoll(0.5);
  await Promise.resolve();
  expect(publish).toHaveBeenLastCalledWith(-1);
  finish();
  await task;
});

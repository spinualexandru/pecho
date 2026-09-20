import { expect, it, vi } from "vitest";
import { syncThemeWithLocal } from "@/helpers/theme_helpers";

it("awaits the default system-theme IPC and propagates its failure", async () => {
  localStorage.removeItem("theme");
  const system = vi.fn().mockRejectedValue(new Error("theme IPC failed"));
  window.themeMode = {
    current: vi.fn().mockResolvedValue("light"),
    system,
  } as unknown as ThemeModeContext;
  await expect(syncThemeWithLocal()).rejects.toThrow("theme IPC failed");
  expect(localStorage.getItem("theme")).toBeNull();
});

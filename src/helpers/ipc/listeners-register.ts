import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { registerRecordingListeners } from "./recording/recording-listeners";
import { registerSystemInfoListeners } from "./system-info/system-info-listeners";

export default function registerListeners() {
  addWindowEventListeners();
  addThemeEventListeners();
  registerRecordingListeners();
  registerSystemInfoListeners();
}

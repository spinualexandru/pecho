import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeRecordingContext } from "./recording/recording-context";
import { exposeSystemInfoContext } from "./system-info/system-info-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeRecordingContext();
  exposeSystemInfoContext();
}

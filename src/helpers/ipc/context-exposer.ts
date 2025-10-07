import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeRecordingContext } from "./recording/recording-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeRecordingContext();
}

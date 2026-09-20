export function minimizeWindow() {
  window.electronWindow
    .minimize()
    .catch((error) => console.error("Could not minimize window", error));
}
export function maximizeWindow() {
  window.electronWindow
    .maximize()
    .catch((error) => console.error("Could not maximize window", error));
}
export function closeWindow() {
  window.electronWindow
    .close()
    .catch((error) => console.error("Could not close window", error));
}

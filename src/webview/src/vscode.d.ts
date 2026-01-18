// VS Code API declarations for webview
declare const vscode: {
  postMessage: (message: unknown) => void;
  getState: <T>() => T | undefined;
  setState: <T>(state: T) => void;
};

import { useState } from "react";

interface ContextFile {
  path: string;
  tokens: number;
  changed?: boolean;
}

interface ContextPanelProps {
  files: ContextFile[];
  totalTokens: number;
  onRemoveFile: (path: string) => void;
}

// Approximate max context window (adjust based on model)
const MAX_TOKENS = 32000;

function ContextPanel({ files, totalTokens, onRemoveFile }: ContextPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const tokenPercentage = Math.min((totalTokens / MAX_TOKENS) * 100, 100);
  const tokenBarClass =
    tokenPercentage < 50 ? "low" : tokenPercentage < 80 ? "medium" : "high";

  const getFileName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  return (
    <div className="context-panel">
      <div className="context-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="context-title">
          <span className="context-toggle">{isExpanded ? "▼" : "▶"}</span>
          <span>Context ({files.length} files)</span>
        </div>
        <span style={{ fontSize: "0.85em", color: "var(--vscode-descriptionForeground)" }}>
          {totalTokens.toLocaleString()} tokens
        </span>
      </div>

      <div className="token-bar">
        <div
          className={`token-bar-fill ${tokenBarClass}`}
          style={{ width: `${tokenPercentage}%` }}
        />
      </div>

      {isExpanded && files.length > 0 && (
        <div className="context-files">
          {files.map((file) => (
            <div key={file.path} className="context-file">
              <span className="context-file-name" title={file.path}>
                {file.changed && "⚠️ "}
                {getFileName(file.path)}
              </span>
              <span className="context-file-tokens">
                {file.tokens.toLocaleString()}
              </span>
              <button
                className="context-file-remove"
                onClick={() => onRemoveFile(file.path)}
                title="Remove from context"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContextPanel;

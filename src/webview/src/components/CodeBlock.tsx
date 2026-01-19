import { useMemo } from "react";

type ApplyIntent = "create" | "edit" | "command";

interface CodeBlockProps {
  code: string;
  language?: string;
  intent?: ApplyIntent;
  targetFile?: string;
  onApply: () => void;
  onCopy: () => void;
}

function CodeBlock({
  code,
  language,
  intent = "edit",
  targetFile,
  onApply,
  onCopy,
}: CodeBlockProps) {
  // Dynamic button label based on intent
  const buttonLabel = useMemo(() => {
    switch (intent) {
      case "create":
        return "Create File";
      case "command":
        return "Run in Terminal";
      case "edit":
        return "Preview & Apply";
      default:
        return "Apply";
    }
  }, [intent]);

  // Button icon (using text for simplicity, could use SVG icons)
  const buttonIcon = useMemo(() => {
    switch (intent) {
      case "create":
        return "📄";
      case "command":
        return "▶";
      case "edit":
        return "✏️";
      default:
        return "→";
    }
  }, [intent]);

  // Button class for styling
  const buttonClass = useMemo(() => {
    switch (intent) {
      case "create":
        return "apply-btn create";
      case "command":
        return "apply-btn command";
      case "edit":
        return "apply-btn edit";
      default:
        return "apply-btn";
    }
  }, [intent]);

  return (
    <div className="code-block">
      <div className="code-block-header">
        <div className="code-block-info">
          {targetFile && <span className="target-file">{targetFile}</span>}
          <span className="code-block-language">{language || "code"}</span>
        </div>
        <div className="code-block-actions">
          <button onClick={onCopy} title="Copy to clipboard" className="copy-btn">
            Copy
          </button>
          <button onClick={onApply} title={buttonLabel} className={buttonClass}>
            <span className="btn-icon">{buttonIcon}</span>
            <span className="btn-label">{buttonLabel}</span>
          </button>
        </div>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default CodeBlock;

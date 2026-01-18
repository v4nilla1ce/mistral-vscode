interface CodeBlockProps {
  code: string;
  language?: string;
  onApply: () => void;
  onCopy: () => void;
}

function CodeBlock({ code, language, onApply, onCopy }: CodeBlockProps) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{language || "code"}</span>
        <div className="code-block-actions">
          <button onClick={onCopy} title="Copy to clipboard">
            Copy
          </button>
          <button onClick={onApply} title="Apply to editor">
            Apply
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

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface InputAreaProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
  isStreaming: boolean;
  useAgent: boolean;
  onToggleAgent: (useAgent: boolean) => void;
}

function InputArea({
  onSend,
  onCancel,
  disabled,
  isStreaming,
  useAgent,
  onToggleAgent,
}: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled && !isStreaming) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-area">
      <div className="mode-toggle">
        <button
          className={!useAgent ? "active" : ""}
          onClick={() => onToggleAgent(false)}
        >
          Chat
        </button>
        <button
          className={useAgent ? "active" : ""}
          onClick={() => onToggleAgent(true)}
        >
          Agent
        </button>
      </div>

      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            useAgent
              ? "Describe a task for the agent..."
              : "Ask a question..."
          }
          disabled={disabled}
          rows={1}
        />

        {isStreaming ? (
          <button className="send-button" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button
            className="send-button"
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
          >
            Send
          </button>
        )}
      </div>

      <div style={{ fontSize: "0.8em", color: "var(--vscode-descriptionForeground)", marginTop: "6px" }}>
        {useAgent
          ? "Agent mode: Can read/write files and run commands"
          : "Press Enter to send, Shift+Enter for new line"}
      </div>
    </div>
  );
}

export default InputArea;

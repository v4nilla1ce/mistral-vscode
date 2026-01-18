interface ToolConfirmationProps {
  tool: string;
  arguments: Record<string, unknown>;
  onConfirm: () => void;
  onDeny: () => void;
}

// Tools that modify the system
const DANGEROUS_TOOLS = ["shell", "write_file", "edit_file"];
const WARNING_TOOLS = ["shell"];

function ToolConfirmation({
  tool,
  arguments: args,
  onConfirm,
  onDeny,
}: ToolConfirmationProps) {
  const isDangerous = WARNING_TOOLS.includes(tool);
  const isWrite = DANGEROUS_TOOLS.includes(tool);

  const formatArguments = () => {
    if (tool === "shell" && args.command) {
      return `$ ${args.command}`;
    }
    if ((tool === "write_file" || tool === "edit_file") && args.path) {
      return `File: ${args.path}`;
    }
    return JSON.stringify(args, null, 2);
  };

  return (
    <div className="tool-confirmation">
      <div className="tool-confirmation-header">
        <span className="tool-confirmation-icon">
          {isDangerous ? "⚠️" : isWrite ? "📝" : "🔧"}
        </span>
        <span>
          {isDangerous ? "Confirm Command" : `Tool: ${tool}`}
        </span>
      </div>

      <div className="tool-confirmation-details">
        <pre>{formatArguments()}</pre>
      </div>

      <div className="tool-confirmation-actions">
        <button className="tool-confirm-allow" onClick={onConfirm}>
          Allow
        </button>
        <button className="tool-confirm-deny" onClick={onDeny}>
          Deny
        </button>
      </div>
    </div>
  );
}

export default ToolConfirmation;

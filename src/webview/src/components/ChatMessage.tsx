import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  onApplyCode: (code: string, language?: string) => void;
  onCopyCode: (code: string) => void;
}

function ChatMessage({
  role,
  content,
  isStreaming,
  onApplyCode,
  onCopyCode,
}: ChatMessageProps) {
  return (
    <div className={`message ${role}`}>
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : undefined;
              const codeString = String(children).replace(/\n$/, "");

              // Check if it's an inline code or a block
              const isInline = !className && !codeString.includes("\n");

              if (isInline) {
                return <code {...props}>{children}</code>;
              }

              return (
                <CodeBlock
                  code={codeString}
                  language={language}
                  onApply={() => onApplyCode(codeString, language)}
                  onCopy={() => onCopyCode(codeString)}
                />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
        {isStreaming && <span className="cursor">▋</span>}
      </div>
    </div>
  );
}

export default ChatMessage;

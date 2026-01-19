import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

type ApplyIntent = "create" | "edit" | "command";

interface CodeBlockMeta {
  targetFile?: string;
  isCommand: boolean;
  cleanCode: string;
  anchor?: string;
}

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  onApplyCode: (
    code: string,
    language?: string,
    intent?: ApplyIntent,
    target?: string,
    anchor?: string
  ) => void;
  onCopyCode: (code: string) => void;
}

/**
 * Parse code block metadata from LLM output.
 * Extracts file paths and detects commands.
 */
function parseCodeBlockMeta(code: string, language: string): CodeBlockMeta {
  const lines = code.split("\n");
  const firstLine = lines[0].trim();

  // Pattern: file path in first line comment
  const fileCommentPatterns = [
    /^\/\/\s*([^\s]+\.\w+)\s*$/,           // // path/file.ext
    /^#\s*([^\s]+\.\w+)\s*$/,              // # path/file.ext
    /^\/\*\s*([^\s]+\.\w+)\s*\*\/\s*$/,    // /* path/file.ext */
    /^<!--\s*([^\s]+\.\w+)\s*-->\s*$/,     // <!-- path/file.html -->
  ];

  for (const pattern of fileCommentPatterns) {
    const match = firstLine.match(pattern);
    if (match) {
      return {
        targetFile: match[1],
        isCommand: false,
        cleanCode: lines.slice(1).join("\n").trimStart(),
      };
    }
  }

  // Pattern: Markdown file header ### filename.py
  const markdownHeaderRegex = /^#{1,3}\s+([^\s]+\.\w+)\s*$/;
  const headerMatch = firstLine.match(markdownHeaderRegex);
  if (headerMatch) {
    return {
      targetFile: headerMatch[1],
      isCommand: false,
      cleanCode: lines.slice(1).join("\n").trimStart(),
    };
  }

  // Pattern: language hint with path ```python:src/main.py
  const langPathRegex = /:([^\s]+\.\w+)$/;
  const langMatch = language.match(langPathRegex);
  if (langMatch) {
    return {
      targetFile: langMatch[1],
      isCommand: false,
      cleanCode: code,
    };
  }

  // Pattern: Shell command detection
  const isCommand = detectCommand(code);

  return {
    isCommand,
    cleanCode: code,
  };
}

/**
 * Detect if code is a shell command.
 */
function detectCommand(code: string): boolean {
  const trimmed = code.trim();
  const firstLine = trimmed.split("\n")[0].trim();

  // Shell prompt patterns
  if (/^[$>%]\s+/.test(firstLine)) {
    return true;
  }

  // Common CLI commands
  const commandPatterns = [
    /^(npm|yarn|pnpm|npx)\s+(install|run|start|test|build|dev|init|create)/i,
    /^(pip|pip3|python|python3)\s+(install|run|-m)/i,
    /^cargo\s+(build|run|test|new|init|add)/i,
    /^go\s+(run|build|test|mod|get)/i,
    /^git\s+(clone|pull|push|commit|checkout|branch|merge|rebase|stash|add|status|diff)/i,
    /^docker(-compose)?\s+(run|build|pull|push|up|down|exec|ps|logs)/i,
    /^kubectl\s+(apply|get|describe|logs|exec|delete|create)/i,
    /^(curl|wget|ssh|scp|rsync|chmod|chown|mkdir|rm|cp|mv)\s+/i,
  ];

  return commandPatterns.some((pattern) => pattern.test(firstLine));
}

/**
 * Determine intent from code analysis.
 */
function detectIntent(code: string, meta: CodeBlockMeta): ApplyIntent {
  if (meta.isCommand) {
    return "command";
  }

  if (meta.targetFile) {
    return "create";
  }

  // Check if it looks like a complete file
  const hasImportsAtTop = /^(import\s|from\s|require\(|use\s|using\s|package\s)/.test(code);
  const hasExports = /(export\s+(default\s+)?|module\.exports)/.test(code);
  const hasMainOrEntry = /(if\s+__name__\s*==\s*['"]__main__|fn\s+main\s*\(|func\s+main\s*\(|int\s+main\s*\()/.test(code);
  const lineCount = code.split("\n").length;

  // If it looks like a complete file, suggest create
  if ((hasImportsAtTop && (hasExports || hasMainOrEntry)) || lineCount > 50) {
    return "create";
  }

  // Default to edit
  return "edit";
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

              // Parse metadata from the code block
              const meta = parseCodeBlockMeta(codeString, language || "");
              const intent = detectIntent(codeString, meta);

              return (
                <CodeBlock
                  code={meta.cleanCode}
                  language={language?.split(":")[0]}
                  intent={intent}
                  targetFile={meta.targetFile}
                  onApply={() =>
                    onApplyCode(
                      meta.cleanCode,
                      language?.split(":")[0],
                      intent,
                      meta.targetFile,
                      meta.anchor
                    )
                  }
                  onCopy={() => onCopyCode(meta.cleanCode)}
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

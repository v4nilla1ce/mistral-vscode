import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "./components/ChatMessage";
import InputArea from "./components/InputArea";
import ContextPanel from "./components/ContextPanel";
import ToolConfirmation from "./components/ToolConfirmation";
import ConnectionStatus from "./components/ConnectionStatus";

// VS Code API interface
declare const vscode: {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// Message types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface ContextFile {
  path: string;
  tokens: number;
  changed?: boolean;
}

interface PendingTool {
  toolCallId: string;
  tool: string;
  arguments: Record<string, unknown>;
}

type ConnectionState = "connected" | "disconnected" | "connecting" | "reconnecting" | "error";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingTool, setPendingTool] = useState<PendingTool | null>(null);
  const [thinkingStep, setThinkingStep] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [useAgent, setUseAgent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case "connected":
          setConnectionState("connected");
          break;

        case "connectionState":
          setConnectionState(message.state as ConnectionState);
          break;

        case "connectionError":
          setConnectionState("error");
          break;

        case "reconnecting":
          setConnectionState("reconnecting");
          break;

        case "reconnected":
          setConnectionState("connected");
          break;

        case "reconnectFailed":
          setConnectionState("error");
          break;

        case "contentDelta":
          setIsStreaming(true);
          setStreamingContent((prev) => prev + message.text);
          break;

        case "contentDone":
          setIsStreaming(false);
          if (message.fullText) {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: message.fullText,
                timestamp: Date.now(),
              },
            ]);
          }
          setStreamingContent("");
          setThinkingStep(null);
          break;

        case "thinkingUpdate":
          setThinkingStep(message.thought);
          break;

        case "toolPending":
          setPendingTool({
            toolCallId: message.toolCallId,
            tool: message.tool,
            arguments: message.arguments,
          });
          break;

        case "toolResult":
          setPendingTool(null);
          break;

        case "tokenUsage":
          setTotalTokens(message.total);
          break;

        case "contextUpdated":
          setContextFiles(message.files);
          setTotalTokens(message.totalTokens);
          break;

        case "fileChanged":
          setContextFiles((prev) =>
            prev.map((f) =>
              f.path === message.filePath ? { ...f, changed: true } : f
            )
          );
          break;

        case "clearChat":
          setMessages([]);
          setStreamingContent("");
          setThinkingStep(null);
          setPendingTool(null);
          break;

        case "error":
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "system",
              content: `Error: ${message.message}`,
              timestamp: Date.now(),
            },
          ]);
          setIsStreaming(false);
          setStreamingContent("");
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify extension that webview is ready
    vscode.postMessage({ type: "ready" });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleSendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) {
        return;
      }

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        },
      ]);

      // Send to extension
      vscode.postMessage({
        type: "sendMessage",
        text,
        useAgent,
      });
    },
    [isStreaming, useAgent]
  );

  const handleConfirmTool = useCallback((approved: boolean) => {
    if (pendingTool) {
      vscode.postMessage({
        type: "confirmTool",
        toolCallId: pendingTool.toolCallId,
        approved,
      });
    }
  }, [pendingTool]);

  const handleRemoveFile = useCallback((filePath: string) => {
    vscode.postMessage({
      type: "removeFile",
      filePath,
    });
  }, []);

  const handleApplyCode = useCallback((code: string, language?: string) => {
    vscode.postMessage({
      type: "applyCode",
      code,
      language,
    });
  }, []);

  const handleCopyCode = useCallback((code: string) => {
    vscode.postMessage({
      type: "copyCode",
      code,
    });
  }, []);

  const handleCancelAgent = useCallback(() => {
    vscode.postMessage({ type: "cancelAgent" });
    setIsStreaming(false);
    setStreamingContent("");
    setThinkingStep(null);
    setPendingTool(null);
  }, []);

  return (
    <div className="chat-container">
      <ConnectionStatus state={connectionState} />

      {contextFiles.length > 0 && (
        <ContextPanel
          files={contextFiles}
          totalTokens={totalTokens}
          onRemoveFile={handleRemoveFile}
        />
      )}

      <div className="messages">
        {messages.length === 0 && !isStreaming && (
          <div className="empty-state">
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-title">Start a conversation</div>
            <div className="empty-state-description">
              Ask questions, get code suggestions, or use agent mode for complex tasks.
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            onApplyCode={handleApplyCode}
            onCopyCode={handleCopyCode}
          />
        ))}

        {thinkingStep && (
          <div className="thinking-indicator">
            <div className="thinking-dots">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
            <span>{thinkingStep}</span>
          </div>
        )}

        {pendingTool && (
          <ToolConfirmation
            tool={pendingTool.tool}
            arguments={pendingTool.arguments}
            onConfirm={() => handleConfirmTool(true)}
            onDeny={() => handleConfirmTool(false)}
          />
        )}

        {isStreaming && streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            isStreaming
            onApplyCode={handleApplyCode}
            onCopyCode={handleCopyCode}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      <InputArea
        onSend={handleSendMessage}
        onCancel={handleCancelAgent}
        disabled={connectionState !== "connected"}
        isStreaming={isStreaming}
        useAgent={useAgent}
        onToggleAgent={setUseAgent}
      />
    </div>
  );
}

export default App;

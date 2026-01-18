/**
 * JSON-RPC Client for Mistral CLI server communication.
 *
 * Manages the subprocess lifecycle and provides a typed interface
 * for RPC method calls and event subscriptions.
 */

import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import * as readline from "readline";

/**
 * Connection state of the RPC client.
 */
export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Reconnecting = "reconnecting",
  Error = "error",
}

/**
 * JSON-RPC request structure.
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

/**
 * JSON-RPC response structure.
 */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  method?: string; // For notifications
  params?: unknown;
}

/**
 * Pending request awaiting response.
 */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * RPC Event types emitted by the server.
 */
export interface RpcEvents {
  "content.delta": { text: string };
  "content.done": { full_text: string };
  "thinking.update": { thought: string };
  "tool.pending": { tool_call_id: string; tool: string; arguments: Record<string, unknown> };
  "tool.result": { tool_call_id: string; success: boolean; output: string };
  "token.usage": { prompt: number; completion: number; total: number };
  error: { code: string; message: string };
}

/**
 * Configuration for the RPC client.
 */
export interface RpcClientConfig {
  /** Path to the CLI executable */
  cliPath: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in milliseconds */
  reconnectDelay?: number;
}

/**
 * JSON-RPC client for communicating with the Mistral CLI server.
 */
export class MistralRpcClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private readline: readline.Interface | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private _state: ConnectionState = ConnectionState.Disconnected;
  private reconnectAttempts = 0;
  private config: Required<RpcClientConfig>;

  constructor(config: RpcClientConfig) {
    super();
    this.config = {
      cliPath: config.cliPath,
      timeout: config.timeout ?? 30000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
    };
  }

  /**
   * Current connection state.
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Whether the client is connected.
   */
  get isConnected(): boolean {
    return this._state === ConnectionState.Connected;
  }

  /**
   * Connect to the Mistral CLI server.
   */
  async connect(): Promise<void> {
    if (this._state === ConnectionState.Connected) {
      return;
    }

    this._setState(ConnectionState.Connecting);

    try {
      await this.spawnProcess();
      await this.initialize();
      this._setState(ConnectionState.Connected);
      this.reconnectAttempts = 0;
    } catch (error) {
      this._setState(ConnectionState.Error);
      throw error;
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.cleanup();
    this._setState(ConnectionState.Disconnected);
  }

  /**
   * Send a chat message.
   */
  async chat(
    message: string,
    contextFiles?: string[]
  ): Promise<{ content: string }> {
    return this.call("chat", {
      message,
      context_files: contextFiles ?? [],
    }) as Promise<{ content: string }>;
  }

  /**
   * Run an agent task.
   */
  async agentRun(
    task: string,
    contextFiles?: string[],
    autoConfirm?: boolean
  ): Promise<{ content: string }> {
    return this.call("agent.run", {
      task,
      context_files: contextFiles ?? [],
      auto_confirm: autoConfirm ?? false,
    }) as Promise<{ content: string }>;
  }

  /**
   * Cancel running agent task.
   */
  async agentCancel(): Promise<void> {
    await this.call("agent.cancel", {});
  }

  /**
   * Confirm or deny a pending tool call.
   */
  async agentConfirm(toolCallId: string, approved: boolean): Promise<void> {
    await this.call("agent.confirm", {
      tool_call_id: toolCallId,
      approved,
    });
  }

  /**
   * Add file to context.
   */
  async addContext(filePath: string): Promise<{ success: boolean; message: string }> {
    return this.call("context.add", { file_path: filePath }) as Promise<{
      success: boolean;
      message: string;
    }>;
  }

  /**
   * Remove file from context.
   */
  async removeContext(filePath: string): Promise<{ success: boolean; message: string }> {
    return this.call("context.remove", { file_path: filePath }) as Promise<{
      success: boolean;
      message: string;
    }>;
  }

  /**
   * List context files.
   */
  async listContext(): Promise<{
    files: Array<{ path: string; tokens: number }>;
    total_tokens: number;
  }> {
    return this.call("context.list", {}) as Promise<{
      files: Array<{ path: string; tokens: number }>;
      total_tokens: number;
    }>;
  }

  /**
   * Clear context.
   */
  async clearContext(
    files = true,
    history = true
  ): Promise<void> {
    await this.call("context.clear", { files, history });
  }

  /**
   * Set the model.
   */
  async setModel(model: string): Promise<void> {
    await this.call("model.set", { model });
  }

  /**
   * Get current model.
   */
  async getModel(): Promise<{ model: string }> {
    return this.call("model.get", {}) as Promise<{ model: string }>;
  }

  /**
   * Make a raw RPC call.
   */
  async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error("Not connected to server");
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sendMessage(request);
    });
  }

  // ==========================================================================
  // Private methods
  // ==========================================================================

  private _setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit("stateChange", state);
    }
  }

  private async spawnProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.cliPath, ["server"], {
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        });

        if (!this.process.stdout || !this.process.stdin) {
          reject(new Error("Failed to create process streams"));
          return;
        }

        // Set up line reader for stdout
        this.readline = readline.createInterface({
          input: this.process.stdout,
          crlfDelay: Infinity,
        });

        this.readline.on("line", (line) => {
          this.handleLine(line);
        });

        // Handle process errors
        this.process.on("error", (error) => {
          this.handleProcessError(error);
        });

        this.process.on("exit", (code, signal) => {
          this.handleProcessExit(code, signal);
        });

        // Log stderr
        this.process.stderr?.on("data", (data) => {
          console.error("[Mistral CLI]", data.toString());
        });

        // Give the process a moment to start
        setTimeout(resolve, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  private async initialize(): Promise<void> {
    const result = await this.call("initialize", {});
    if (!result) {
      throw new Error("Failed to initialize server");
    }
  }

  private sendMessage(message: JsonRpcRequest): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("Process stdin not writable");
    }

    const json = JSON.stringify(message);
    this.process.stdin.write(json + "\n");
  }

  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    try {
      const message: JsonRpcResponse = JSON.parse(line);

      if (message.id !== undefined) {
        // This is a response
        this.handleResponse(message);
      } else if (message.method) {
        // This is a notification
        this.handleNotification(message);
      }
    } catch (error) {
      console.error("Failed to parse server message:", line);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const id = response.id;
    if (id === undefined) {
      return;
    }

    const pending = this.pendingRequests.get(id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (response.error) {
      pending.reject(
        new Error(`RPC Error ${response.error.code}: ${response.error.message}`)
      );
    } else {
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcResponse): void {
    const method = notification.method;
    if (!method) {
      return;
    }

    // Emit the event for listeners
    this.emit(method, notification.params);
  }

  private handleProcessError(error: Error): void {
    console.error("Mistral CLI process error:", error);
    this._setState(ConnectionState.Error);
    this.attemptReconnect();
  }

  private handleProcessExit(code: number | null, signal: string | null): void {
    console.log(`Mistral CLI process exited: code=${code}, signal=${signal}`);

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Process exited"));
    }
    this.pendingRequests.clear();

    if (this._state !== ConnectionState.Disconnected) {
      this._setState(ConnectionState.Error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      this.emit("reconnectFailed");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this._setState(ConnectionState.Reconnecting);
    this.emit("reconnecting", { attempt: this.reconnectAttempts, delay });

    setTimeout(async () => {
      try {
        this.cleanup();
        await this.connect();
        this.emit("reconnected");
      } catch (error) {
        this.attemptReconnect();
      }
    }, Math.min(delay, 30000)); // Cap at 30 seconds
  }

  private cleanup(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Ignore errors
      }
      this.process = null;
    }

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Client disconnected"));
    }
    this.pendingRequests.clear();
  }
}

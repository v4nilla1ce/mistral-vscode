/**
 * Intent Detector Service
 *
 * Lightweight classifier that analyzes code blocks to determine
 * the user's intent: create new file, edit existing, or run command.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Detected intent result from analyzing a code block.
 */
export interface DetectedIntent {
  intent: "create" | "edit" | "command";
  confidence: number; // 0-1
  target?: string; // Filename or path hint
  anchor?: string; // Function/class name or context line
}

/**
 * Project type detection result.
 */
export type ProjectType = "node" | "python" | "rust" | "go" | "unknown";

/**
 * IntentDetector classifies code blocks before the user clicks "Apply".
 */
export class IntentDetector {
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Main entry point: detect intent from a code block.
   */
  public detect(
    code: string,
    language: string,
    activeFile?: string
  ): DetectedIntent {
    // Check for shell command first (highest priority for clear patterns)
    const commandIntent = this.detectCommand(code);
    if (commandIntent.confidence > 0.8) {
      return commandIntent;
    }

    // Check for file creation patterns
    const createIntent = this.detectFileCreation(code, language);
    if (createIntent.confidence > 0.7) {
      return createIntent;
    }

    // Check for edit patterns
    const editIntent = this.detectEdit(code, language, activeFile);
    if (editIntent.confidence > 0.5) {
      return editIntent;
    }

    // Default: if we have an active file and code is small, assume edit
    if (activeFile && this.getLineCount(code) < 50) {
      return {
        intent: "edit",
        confidence: 0.4,
      };
    }

    // Fallback: treat as create
    return {
      intent: "create",
      confidence: 0.3,
    };
  }

  /**
   * Detect shell command patterns.
   */
  private detectCommand(code: string): DetectedIntent {
    const trimmed = code.trim();
    const lines = trimmed.split("\n");
    const firstLine = lines[0].trim();

    // Pattern: $ command, > command, % command (shell prompts)
    const shellPromptRegex = /^[$>%]\s+(.+)$/;
    const shellMatch = firstLine.match(shellPromptRegex);
    if (shellMatch) {
      return {
        intent: "command",
        confidence: 0.95,
      };
    }

    // Pattern: npm/yarn/pnpm commands
    const npmRegex = /^(npm|yarn|pnpm|npx)\s+(install|run|start|test|build|dev|init|create)/i;
    if (npmRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: pip/python commands
    const pythonRegex = /^(pip|pip3|python|python3)\s+(install|run|-m)/i;
    if (pythonRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: cargo commands
    const cargoRegex = /^cargo\s+(build|run|test|new|init|add)/i;
    if (cargoRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: go commands
    const goRegex = /^go\s+(run|build|test|mod|get)/i;
    if (goRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: git commands
    const gitRegex = /^git\s+(clone|pull|push|commit|checkout|branch|merge|rebase|stash|add|status|diff)/i;
    if (gitRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: docker commands
    const dockerRegex = /^docker(-compose)?\s+(run|build|pull|push|up|down|exec|ps|logs)/i;
    if (dockerRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: kubectl commands
    const kubectlRegex = /^kubectl\s+(apply|get|describe|logs|exec|delete|create)/i;
    if (kubectlRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.9,
      };
    }

    // Pattern: Common CLI tools
    const cliToolsRegex = /^(curl|wget|ssh|scp|rsync|chmod|chown|mkdir|rm|cp|mv|cat|grep|find|awk|sed|head|tail)\s+/i;
    if (cliToolsRegex.test(firstLine)) {
      return {
        intent: "command",
        confidence: 0.85,
      };
    }

    // Pattern: Single line that looks like a command (no function defs, etc.)
    if (
      lines.length === 1 &&
      !firstLine.includes("{") &&
      !firstLine.includes("function") &&
      !firstLine.includes("class") &&
      !firstLine.includes("def ") &&
      !firstLine.includes("import ") &&
      !firstLine.includes("const ") &&
      !firstLine.includes("let ") &&
      !firstLine.includes("var ")
    ) {
      // Could be a command, low confidence
      return {
        intent: "command",
        confidence: 0.4,
      };
    }

    return {
      intent: "command",
      confidence: 0,
    };
  }

  /**
   * Detect file creation patterns.
   */
  private detectFileCreation(code: string, language: string): DetectedIntent {
    const trimmed = code.trim();
    const lines = trimmed.split("\n");
    const firstLine = lines[0];

    // Pattern: Top-line file path comment
    // e.g., // src/utils/helper.ts, # app/models.py, /* src/main.c */
    const fileCommentPatterns = [
      /^\/\/\s*([^\s]+\.\w+)\s*$/,           // // path/file.ext
      /^#\s*([^\s]+\.\w+)\s*$/,              // # path/file.ext
      /^\/\*\s*([^\s]+\.\w+)\s*\*\/\s*$/,    // /* path/file.ext */
      /^<!--\s*([^\s]+\.\w+)\s*-->\s*$/,     // <!-- path/file.html -->
      /^"""\s*([^\s]+\.\w+)\s*"""\s*$/,      // """ path/file.py """
    ];

    for (const pattern of fileCommentPatterns) {
      const match = firstLine.match(pattern);
      if (match) {
        return {
          intent: "create",
          confidence: 0.95,
          target: match[1],
        };
      }
    }

    // Pattern: Markdown file header ### filename.py
    const markdownHeaderRegex = /^#{1,3}\s+([^\s]+\.\w+)\s*$/;
    const headerMatch = firstLine.match(markdownHeaderRegex);
    if (headerMatch) {
      return {
        intent: "create",
        confidence: 0.9,
        target: headerMatch[1],
      };
    }

    // Pattern: Language hint with path ```python:src/main.py
    const langPathRegex = /:([^\s]+\.\w+)$/;
    const langMatch = language.match(langPathRegex);
    if (langMatch) {
      return {
        intent: "create",
        confidence: 0.9,
        target: langMatch[1],
      };
    }

    // Pattern: File looks like a complete module (has imports at top, exports/class/function definitions)
    const hasImports = /^(import\s|from\s|require\(|use\s|using\s)/.test(trimmed);
    const hasExports = /(export\s+(default\s+)?|module\.exports\s*=)/.test(trimmed);
    const hasClassOrFunction = /(^|\n)(class\s+\w+|function\s+\w+|def\s+\w+|fn\s+\w+|func\s+\w+)/.test(trimmed);

    if (hasImports && (hasExports || hasClassOrFunction) && this.getLineCount(code) > 20) {
      return {
        intent: "create",
        confidence: 0.7,
      };
    }

    // Pattern: Config file patterns
    const configPatterns = [
      /^{\s*"name"\s*:/, // package.json
      /^{\s*"compilerOptions"\s*:/, // tsconfig.json
      /^\[tool\./, // pyproject.toml
      /^version\s*=/, // Cargo.toml
      /^FROM\s+/, // Dockerfile
      /^version:\s*['"]?\d/, // docker-compose.yml
    ];

    for (const pattern of configPatterns) {
      if (pattern.test(trimmed)) {
        return {
          intent: "create",
          confidence: 0.85,
        };
      }
    }

    return {
      intent: "create",
      confidence: 0,
    };
  }

  /**
   * Detect edit patterns.
   */
  private detectEdit(
    code: string,
    language: string,
    activeFile?: string
  ): DetectedIntent {
    const trimmed = code.trim();
    const lines = trimmed.split("\n");
    const lineCount = lines.length;

    // Pattern: Single import/require statement
    const singleImportRegex = /^(import\s+.+|from\s+.+\s+import\s+.+|const\s+\w+\s*=\s*require\(.+\)|use\s+.+;?)$/;
    if (lineCount <= 3 && lines.some((l) => singleImportRegex.test(l.trim()))) {
      return {
        intent: "edit",
        confidence: 0.85,
        anchor: "imports", // Hint to insert at import section
      };
    }

    // Pattern: Single function or method (small, likely a modification)
    const singleFunctionRegex = /^(async\s+)?(function|const|let|var)\s+(\w+)/;
    const funcMatch = trimmed.match(singleFunctionRegex);
    if (funcMatch && lineCount < 30) {
      return {
        intent: "edit",
        confidence: 0.7,
        anchor: funcMatch[3], // Function name as anchor
      };
    }

    // Pattern: Python function/method
    const pythonFuncRegex = /^(async\s+)?def\s+(\w+)/;
    const pyFuncMatch = trimmed.match(pythonFuncRegex);
    if (pyFuncMatch && lineCount < 30) {
      return {
        intent: "edit",
        confidence: 0.7,
        anchor: pyFuncMatch[2],
      };
    }

    // Pattern: Class method (inside a class, small)
    const methodRegex = /^\s*(public|private|protected|static|async)?\s*(function|def|fn|func)?\s*(\w+)\s*\(/m;
    const methodMatch = trimmed.match(methodRegex);
    if (methodMatch && lineCount < 40 && !trimmed.includes("class ")) {
      return {
        intent: "edit",
        confidence: 0.6,
        anchor: methodMatch[3],
      };
    }

    // Pattern: Short code that's not a complete file
    if (lineCount < 20 && !this.looksLikeCompleteFile(trimmed)) {
      return {
        intent: "edit",
        confidence: 0.5,
      };
    }

    return {
      intent: "edit",
      confidence: 0,
    };
  }

  /**
   * Check if code looks like a complete file (vs a snippet).
   */
  private looksLikeCompleteFile(code: string): boolean {
    const hasShebang = code.startsWith("#!");
    const hasImportsAtTop = /^(import\s|from\s|require\(|use\s|using\s|package\s)/.test(code);
    const hasMainOrEntry = /(if\s+__name__\s*==\s*['"]__main__|fn\s+main\s*\(|func\s+main\s*\(|int\s+main\s*\()/.test(code);
    const hasExports = /(export\s+(default\s+)?|module\.exports)/.test(code);

    // If it has multiple indicators, likely a complete file
    let indicators = 0;
    if (hasShebang) indicators++;
    if (hasImportsAtTop) indicators++;
    if (hasMainOrEntry) indicators++;
    if (hasExports) indicators++;

    return indicators >= 2;
  }

  /**
   * Detect project type from workspace files.
   */
  public detectProjectType(): ProjectType {
    if (!this.workspaceRoot) {
      return "unknown";
    }

    try {
      if (fs.existsSync(path.join(this.workspaceRoot, "package.json"))) {
        return "node";
      }
      if (
        fs.existsSync(path.join(this.workspaceRoot, "pyproject.toml")) ||
        fs.existsSync(path.join(this.workspaceRoot, "requirements.txt")) ||
        fs.existsSync(path.join(this.workspaceRoot, "setup.py"))
      ) {
        return "python";
      }
      if (fs.existsSync(path.join(this.workspaceRoot, "Cargo.toml"))) {
        return "rust";
      }
      if (fs.existsSync(path.join(this.workspaceRoot, "go.mod"))) {
        return "go";
      }
    } catch {
      // Ignore file system errors
    }

    return "unknown";
  }

  /**
   * Get line count from code string.
   */
  private getLineCount(code: string): number {
    return code.split("\n").length;
  }
}

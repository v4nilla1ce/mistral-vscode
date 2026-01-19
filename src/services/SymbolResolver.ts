/**
 * Symbol Resolver Service
 *
 * Handles LSP symbol lookups for smart code anchoring.
 * Uses VS Code's document symbol provider to find functions,
 * classes, and other code elements.
 */

import * as vscode from "vscode";

/**
 * Result of resolving an anchor to a position.
 */
export interface ResolvedPosition {
  position: vscode.Position;
  range?: vscode.Range;
  method: "exact_symbol" | "fuzzy_symbol" | "text_search" | "cursor_fallback";
  symbolName?: string;
}

/**
 * SymbolResolver finds code locations using LSP symbols and text search.
 */
export class SymbolResolver {
  /**
   * Resolve an anchor string to a position in the document.
   * Uses a fallback chain: exact symbol → fuzzy symbol → text search → cursor.
   */
  public async resolveAnchor(
    document: vscode.TextDocument,
    anchor: string | undefined,
    cursorPosition: vscode.Position
  ): Promise<ResolvedPosition> {
    if (!anchor) {
      return {
        position: cursorPosition,
        method: "cursor_fallback",
      };
    }

    // Special case: "imports" anchor - find import section
    if (anchor.toLowerCase() === "imports") {
      const importPosition = this.findImportSection(document);
      if (importPosition) {
        return {
          position: importPosition,
          method: "text_search",
        };
      }
    }

    // Try LSP symbol matching
    const symbols = await this.getDocumentSymbols(document);
    if (symbols && symbols.length > 0) {
      // Try exact match first
      const exactMatch = this.findSymbol(symbols, anchor, "exact");
      if (exactMatch) {
        return {
          position: exactMatch.range.start,
          range: exactMatch.range,
          method: "exact_symbol",
          symbolName: exactMatch.name,
        };
      }

      // Try fuzzy match
      const fuzzyMatch = this.findSymbol(symbols, anchor, "fuzzy");
      if (fuzzyMatch) {
        return {
          position: fuzzyMatch.range.start,
          range: fuzzyMatch.range,
          method: "fuzzy_symbol",
          symbolName: fuzzyMatch.name,
        };
      }
    }

    // Try text search
    const textPosition = this.findTextMatch(document, anchor);
    if (textPosition) {
      return {
        position: textPosition,
        method: "text_search",
      };
    }

    // Fallback to cursor position
    return {
      position: cursorPosition,
      method: "cursor_fallback",
    };
  }

  /**
   * Get document symbols using VS Code's LSP.
   */
  private async getDocumentSymbols(
    document: vscode.TextDocument
  ): Promise<vscode.DocumentSymbol[] | undefined> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        "vscode.executeDocumentSymbolProvider",
        document.uri
      );
      return symbols;
    } catch {
      return undefined;
    }
  }

  /**
   * Find a symbol by name using exact or fuzzy matching.
   */
  private findSymbol(
    symbols: vscode.DocumentSymbol[],
    name: string,
    mode: "exact" | "fuzzy"
  ): vscode.DocumentSymbol | undefined {
    const normalizedName = name.toLowerCase();

    for (const symbol of symbols) {
      const symbolName = symbol.name.toLowerCase();

      if (mode === "exact") {
        if (symbolName === normalizedName) {
          return symbol;
        }
      } else {
        // Fuzzy match: contains, starts with, or Levenshtein distance
        if (
          symbolName.includes(normalizedName) ||
          normalizedName.includes(symbolName) ||
          this.levenshteinDistance(symbolName, normalizedName) <= 3
        ) {
          return symbol;
        }
      }

      // Recursively search children
      if (symbol.children && symbol.children.length > 0) {
        const childMatch = this.findSymbol(symbol.children, name, mode);
        if (childMatch) {
          return childMatch;
        }
      }
    }

    return undefined;
  }

  /**
   * Find the import section in a document.
   */
  private findImportSection(document: vscode.TextDocument): vscode.Position | undefined {
    const text = document.getText();
    const lines = text.split("\n");

    let lastImportLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments at the top
      if (i < 10 && (line === "" || line.startsWith("//") || line.startsWith("#") || line.startsWith("/*") || line.startsWith("*"))) {
        continue;
      }

      // Check for import patterns
      const isImport =
        line.startsWith("import ") ||
        line.startsWith("from ") ||
        line.match(/^const\s+\w+\s*=\s*require\(/) ||
        line.startsWith("use ") ||
        line.startsWith("using ");

      if (isImport) {
        lastImportLine = i;
      } else if (lastImportLine >= 0 && line !== "") {
        // We've passed the import section
        break;
      }
    }

    if (lastImportLine >= 0) {
      // Return position at end of last import line
      return new vscode.Position(lastImportLine + 1, 0);
    }

    // No imports found, return start of file (after any shebang/comments)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line !== "" && !line.startsWith("#!") && !line.startsWith("//") && !line.startsWith("/*")) {
        return new vscode.Position(i, 0);
      }
    }

    return new vscode.Position(0, 0);
  }

  /**
   * Find text match in document.
   */
  private findTextMatch(
    document: vscode.TextDocument,
    searchText: string
  ): vscode.Position | undefined {
    const text = document.getText();
    const normalizedSearch = searchText.toLowerCase();

    // Try to find exact match first
    let index = text.toLowerCase().indexOf(normalizedSearch);
    if (index >= 0) {
      return document.positionAt(index);
    }

    // Try to find function/method definition
    const funcPatterns = [
      new RegExp(`function\\s+${this.escapeRegex(searchText)}\\s*\\(`, "i"),
      new RegExp(`def\\s+${this.escapeRegex(searchText)}\\s*\\(`, "i"),
      new RegExp(`(const|let|var)\\s+${this.escapeRegex(searchText)}\\s*=`, "i"),
      new RegExp(`class\\s+${this.escapeRegex(searchText)}`, "i"),
      new RegExp(`fn\\s+${this.escapeRegex(searchText)}\\s*\\(`, "i"),
      new RegExp(`func\\s+${this.escapeRegex(searchText)}\\s*\\(`, "i"),
    ];

    for (const pattern of funcPatterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        return document.positionAt(match.index);
      }
    }

    return undefined;
  }

  /**
   * Calculate Levenshtein distance between two strings.
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Escape special regex characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Find all symbols matching a pattern (for replace operations).
   */
  public async findAllMatchingSymbols(
    document: vscode.TextDocument,
    pattern: string
  ): Promise<vscode.DocumentSymbol[]> {
    const symbols = await this.getDocumentSymbols(document);
    if (!symbols) {
      return [];
    }

    const matches: vscode.DocumentSymbol[] = [];
    const normalizedPattern = pattern.toLowerCase();

    const searchSymbols = (syms: vscode.DocumentSymbol[]) => {
      for (const symbol of syms) {
        if (symbol.name.toLowerCase().includes(normalizedPattern)) {
          matches.push(symbol);
        }
        if (symbol.children) {
          searchSymbols(symbol.children);
        }
      }
    };

    searchSymbols(symbols);
    return matches;
  }
}

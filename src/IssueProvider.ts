import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { IssueItem } from "./IssueItem";

export class IssueProvider implements vscode.TreeDataProvider<IssueItem> {
  constructor(private workspaceRoot: string) {}

  private _onDidChangeTreeData: vscode.EventEmitter<
    IssueItem | undefined | void
  > = new vscode.EventEmitter<IssueItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IssueItem): Promise<IssueItem[]> {
    const folderPath =
      element?.resourceUri.fsPath ?? path.join(this.workspaceRoot, "issues");

    if (!fs.existsSync(folderPath)) {
      return [];
    }

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    const items: IssueItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      const uri = vscode.Uri.file(fullPath);

      if (entry.isDirectory()) {
        const folderPriority = this.computeFolderPriority(fullPath);
        items.push(
          new IssueItem(
            entry.name,
            uri,
            vscode.TreeItemCollapsibleState.Collapsed,
            folderPriority
          )
        );
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== ".template"
      ) {
        const content = fs.readFileSync(fullPath, "utf8");
        const parsed = matter(content);
        const priority = parsed.data.priority ?? 999;
        const title = parsed.data.title ?? entry.name;

        items.push(
          new IssueItem(
            title,
            uri,
            vscode.TreeItemCollapsibleState.None,
            priority
          )
        );
      }
    }

    return items.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  }

  private computeFolderPriority(folderPath: string): number {
    let minPriority = 999;

    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        const childPrio = this.computeFolderPriority(fullPath);
        minPriority = Math.min(minPriority, childPrio);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== ".template"
      ) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const parsed = matter(content);
          const prio = parsed.data.priority ?? 999;
          minPriority = Math.min(minPriority, prio);
        } catch {
          // ignore malformed files
        }
      }
    }

    return minPriority;
  }
}

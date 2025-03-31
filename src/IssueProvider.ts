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
        items.push(
          new IssueItem(
            entry.name,
            uri,
            vscode.TreeItemCollapsibleState.Collapsed
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

    // Sort: folders first, then files by priority
    return items.sort((a, b) => {
      if (a.collapsibleState !== b.collapsibleState) {
        return b.collapsibleState - a.collapsibleState; // folders first
      }
      return (a.priority ?? 999) - (b.priority ?? 999);
    });
  }
}

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { IssueItem } from "./IssueItem";

export class IssueProvider implements vscode.TreeDataProvider<IssueItem> {
  constructor(private workspaceRoot: string) {}

  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | void> = new vscode.EventEmitter<IssueItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IssueItem): Promise<IssueItem[]> {
    const root = element?.resourceUri.fsPath ?? path.join(this.workspaceRoot, "issues");

    return await this.buildIssueTree(root);
  }

  private async buildIssueTree(folderPath: string): Promise<IssueItem[]> {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    const folders: IssueItem[] = [];
    const files: IssueItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);
      const uri = vscode.Uri.file(fullPath);

      if (entry.isDirectory()) {
        const children = await this.buildIssueTree(fullPath);

        if (children.length > 0) {
          // priority of the folder is the highest priority of its children
          const folderPriority = Math.min(...children.map((c) => c.priority));
          const folderItem = new IssueItem(entry.name, uri, vscode.TreeItemCollapsibleState.Collapsed, folderPriority);
          folderItem.children = children;
          folders.push(folderItem);
        }
      } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== ".template") {
        const content = fs.readFileSync(fullPath, "utf8");
        const parsed = matter(content);
        const priority = parsed.data.priority ?? 999;
        const title = parsed.data.title ?? entry.name;

        const fileItem = new IssueItem(title, uri, vscode.TreeItemCollapsibleState.None, priority);
        files.push(fileItem);
      }
    }

    const sorted = [...folders, ...files].sort((a, b) => a.priority - b.priority);
    return sorted;
  }
}

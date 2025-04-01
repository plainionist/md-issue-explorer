import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { IssueItem } from "./IssueItem";

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
  constructor(private issuesRoot: string) {}

  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | void> = new vscode.EventEmitter<IssueItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: IssueItem): Promise<IssueItem[]> {
    const root = element?.resourceUri.fsPath ?? this.issuesRoot;

    return await this.buildTree(root);
  }

  private async buildTree(folderPath: string): Promise<IssueItem[]> {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    const issues: IssueItem[] = [];

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        const children = await this.buildTree(fullPath);

        if (children.length > 0) {
          issues.push(this.createFolderItem(children, entry.name, fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== ".template") {
        const fileItem = this.createFileItem(fullPath, entry.name);
        issues.push(fileItem);
      }
    }

    return issues.sort((a, b) => a.priority - b.priority);
  }

  private createFolderItem(children: IssueItem[], name: string, fullPath: string) {
    // priority of the folder is the highest priority of its children
    const priority = Math.min(...children.map((c) => c.priority));

    const folderItem = new IssueItem(name, vscode.Uri.file(fullPath), vscode.TreeItemCollapsibleState.Collapsed, priority);
    folderItem.children = children;
    folderItem.contextValue = "folder";

    return folderItem;
  }

  private createFileItem(fullPath: string, name: string) {
    const content = fs.readFileSync(fullPath, "utf8");
    const parsed = matter(content);
    const priority = parsed.data.priority ?? 999;
    const title = parsed.data.title ?? name;

    return new IssueItem(title, vscode.Uri.file(fullPath), vscode.TreeItemCollapsibleState.None, priority);
  }
}

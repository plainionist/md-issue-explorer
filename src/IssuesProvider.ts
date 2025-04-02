import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
  constructor(private issuesFolder: string) {}

  private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | void> = new vscode.EventEmitter<IssueItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: IssueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<IssueItem[]> {
    const files = fs.readdirSync(this.issuesFolder).filter((f) => f.endsWith(".md"));

    const items: IssueItem[] = [];

    for (const file of files) {
      const fullPath = path.join(this.issuesFolder, file);
      const content = fs.readFileSync(fullPath, "utf8");
      const parsed = matter(content);
      const priority = parsed.data.priority ?? 999;
      const title = parsed.data.title ?? file;

      items.push(new IssueItem(title, priority, vscode.Uri.file(fullPath)));
    }

    return items.sort((a, b) => a.priority - b.priority);
  }
}

export class IssueItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly priority: number, public readonly resourceUri: vscode.Uri) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `Priority: ${priority}`;
    this.command = {
      command: "vscode.open",
      title: "Open Issue",
      arguments: [this.resourceUri],
    };
  }
}

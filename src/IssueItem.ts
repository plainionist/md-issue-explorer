import * as vscode from "vscode";

export class IssueItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly targetUri: vscode.Uri,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly priority: number,
    status?: string
  ) {
    super(label, collapsibleState);

    const statusIcon = this.getStatusIcon(status);
    this.tooltip = `Priority: ${this.priority}`;
    this.iconPath = statusIcon;

    this.command = {
      command: "vscode.open",
      title: "Open Issue",
      arguments: [this.targetUri],
    };
  }

  children?: IssueItem[];

  private getStatusIcon(status: string | undefined): vscode.ThemeIcon | vscode.Uri {
    if (status === "green" || status === "open" || status === "ready") {
      return new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.green"));
    }

    if (status === "blocked" || status === "red") {
      return new vscode.ThemeIcon("circle-filled", new vscode.ThemeColor("charts.red"));
    }

    return new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("foreground"));
  }
}

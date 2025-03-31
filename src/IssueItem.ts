import * as vscode from "vscode";

export class IssueItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly resourceUri: vscode.Uri,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly priority: number
  ) {
    super(label, collapsibleState);
    this.tooltip = `Priority: ${this.priority}`;

    this.command = {
      command: "vscode.open",
      title: "Open Issue",
      arguments: [this.resourceUri],
    };
  }

  children?: IssueItem[];
}

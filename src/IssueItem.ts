import * as vscode from 'vscode';


export class IssueItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly resourceUri: vscode.Uri,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly priority?: number // only set for files
  ) {
    super(label, collapsibleState);
    this.tooltip = this.priority !== undefined ? `Priority: ${this.priority}` : this.label;

    if (this.priority !== undefined) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Issue',
        arguments: [this.resourceUri]
      };
    }
  }
}

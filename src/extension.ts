import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { IssuesProvider } from "./IssuesProvider";

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!rootPath) {
    return;
  }

  const issuesFolder = path.join(rootPath, "issues");
  if (!fs.existsSync(issuesFolder)) {
    return [];
  }

  const provider = new IssuesProvider(issuesFolder);

  vscode.window.registerTreeDataProvider("issueExplorer", provider);

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.newIssue", async () => {
      const name = await vscode.window.showInputBox({ prompt: "Enter issue name" });

      if (!name) {
        return;
      }

      const filePath = path.join(issuesFolder, name.endsWith(".md") ? name : `${name}.md`);
      fs.writeFileSync(filePath, `---\ntitle: ${name}\npriority: \n---\n\n`);

      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand("issueExplorer.deleteIssue", async (item: { resourceUri: vscode.Uri }) => {
      const confirmed = await vscode.window.showWarningMessage(`Delete "${item.resourceUri.path}"?`, { modal: true }, "Yes");

      if (confirmed === "Yes") {
        fs.unlinkSync(item.resourceUri.fsPath);
      }
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher(`${issuesFolder}/*.md`);

  watcher.onDidChange(() => provider.refresh());
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());

  context.subscriptions.push(watcher);
}

export function deactivate() {}

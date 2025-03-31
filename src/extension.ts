import * as vscode from "vscode";
import { IssueProvider } from "./IssueProvider";
import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const issueProvider = new IssueProvider(rootPath ?? "");

  vscode.window.registerTreeDataProvider("issueExplorer", issueProvider);

  vscode.commands.registerCommand("issueExplorer.refresh", () =>
    issueProvider.refresh()
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.newIssue", async () => {
      if (!rootPath) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return;
      }

      const issueFolder = path.join(rootPath, "issues");
      const templatePath = path.join(issueFolder, ".template");
      const templateContent = fs.existsSync(templatePath)
        ? fs.readFileSync(templatePath, "utf8")
        : "---\ntitle: \npriority: \n---\n\n";

      const name = await vscode.window.showInputBox({
        prompt: "Enter issue name",
      });

      if (!name) {
        return;
      }

      const filePath = path.join(
        issueFolder,
        name.endsWith(".md") ? name : `${name}.md`
      );

      fs.writeFileSync(filePath, templateContent);

      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand(
      "issueExplorer.deleteIssue",
      async (item: { resourceUri: vscode.Uri }) => {
        const confirmed = await vscode.window.showWarningMessage(
          `Delete issue "${item.resourceUri.path}"?`,
          { modal: true },
          "Yes"
        );

        if (confirmed === "Yes") {
          fs.unlinkSync(item.resourceUri.fsPath);
        }
      }
    )
  );

  if (rootPath) {
    const issueFolder = path.join(rootPath, "issues");
    const issueWatcher = vscode.workspace.createFileSystemWatcher(
      `${issueFolder}/*.md`
    );

    issueWatcher.onDidChange(() => issueProvider.refresh());
    issueWatcher.onDidCreate(() => issueProvider.refresh());
    issueWatcher.onDidDelete(() => issueProvider.refresh());
    
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.uri.fsPath.startsWith(`${rootPath}/issues/`) && doc.uri.fsPath.endsWith('.md')) {
        issueProvider.refresh();
      }
    });
    
    context.subscriptions.push(issueWatcher);
  }
}

export function deactivate() {}

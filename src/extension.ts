import * as vscode from "vscode";
import { IssueProvider } from "./IssueProvider";
import * as fs from "fs";
import * as path from "path";

async function createNewIssue(rootPath: string | undefined) {
  if (!rootPath) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const issueFolder = path.join(rootPath, "issues");
  const templatePath = path.join(issueFolder, ".template");
  const templateContent = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : "---\ntitle: \npriority: \n---\n\n";

  const name = await vscode.window.showInputBox({ prompt: "Enter issue name" });
  if (!name) {
    return;
  }

  const filePath = path.join(issueFolder, name.endsWith(".md") ? name : `${name}.md`);

  fs.writeFileSync(filePath, templateContent);

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

async function deleteIssue(item: { resourceUri: vscode.Uri }) {
  const confirmed = await vscode.window.showWarningMessage(`Delete issue "${item.resourceUri.path}"?`, { modal: true }, "Yes");

  if (confirmed === "Yes") {
    fs.unlinkSync(item.resourceUri.fsPath);
  }
}

function registerFileWatcher(rootPath: string | undefined, issueProvider: IssueProvider, context: vscode.ExtensionContext) {
  if (!rootPath) {
    return;
  }

  const issueFolder = path.join(rootPath, "issues");
  const issueWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(issueFolder, "**/*.md"));

  issueWatcher.onDidChange(() => issueProvider.refresh());
  issueWatcher.onDidCreate(() => issueProvider.refresh());
  issueWatcher.onDidDelete(() => issueProvider.refresh());

  vscode.workspace.onDidSaveTextDocument((doc) => {
    const relativePath = path.relative(issueFolder, doc.uri.fsPath);

    if (
      !relativePath.startsWith("..") && // doc is inside the issues folder
      relativePath.endsWith(".md") &&
      path.basename(doc.uri.fsPath) !== ".template"
    ) {
      issueProvider.refresh();
    }
  });

  context.subscriptions.push(issueWatcher);
}

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const issueProvider = new IssueProvider(rootPath ?? "");

  vscode.window.registerTreeDataProvider("issueExplorer", issueProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.refresh", () => issueProvider.refresh()),
    vscode.commands.registerCommand("issueExplorer.newIssue", () => createNewIssue(rootPath)),
    vscode.commands.registerCommand("issueExplorer.deleteIssue", deleteIssue)
  );

  registerFileWatcher(rootPath, issueProvider, context);
}

export function deactivate() {}

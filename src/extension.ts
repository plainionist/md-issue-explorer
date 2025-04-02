import * as vscode from "vscode";
import { IssuesProvider } from "./IssuesProvider";
import * as path from "path";
import { IssueItem } from "./IssueItem";
import { IssuesStore } from "./IssuesStore";

async function createNewIssue(store: IssuesStore, folder?: string | undefined) {
  const name = await vscode.window.showInputBox({ prompt: "Enter issue name" });
  if (!name) {
    return;
  }

  const filePath = store.create(folder, name);

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

async function deleteIssue(store: IssuesStore, item: IssueItem) {
  const label = path.basename(item.resourceUri.fsPath);
  const confirmed = await vscode.window.showWarningMessage(`Delete "${label}"? This cannot be undone.`, { modal: true }, "Yes");

  if (confirmed !== "Yes") {
    return;
  }

  store.delete(item.resourceUri.fsPath);
}

function registerFileWatcher(store: IssuesStore, issuesProvider: IssuesProvider, context: vscode.ExtensionContext) {
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(store.location, "**"));

  watcher.onDidChange(() => issuesProvider.refresh());
  watcher.onDidCreate(() => issuesProvider.refresh());
  watcher.onDidDelete(() => issuesProvider.refresh());

  context.subscriptions.push(watcher);
}

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!rootPath) {
    return;
  }

  const store = new IssuesStore(rootPath);
  const issuesProvider = new IssuesProvider(store);

  vscode.window.registerTreeDataProvider("issueExplorer", issuesProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.refresh", () => issuesProvider.refresh()),

    vscode.commands.registerCommand("issueExplorer.newIssueInFolder", async (target: IssueItem) => {
      await createNewIssue(store, target.resourceUri!.fsPath);
    }),

    vscode.commands.registerCommand("issueExplorer.newIssue", async () => {
      await createNewIssue(store);
    }),

    vscode.commands.registerCommand("issueExplorer.deleteIssue", (target: IssueItem) => deleteIssue(store, target))
  );

  registerFileWatcher(store, issuesProvider, context);
}

export function deactivate() {}

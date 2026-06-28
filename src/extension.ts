import * as vscode from "vscode";
import { IssuesProvider } from "./IssuesProvider";
import * as path from "path";
import { execFile } from "node:child_process";
import { IssueItem } from "./IssueItem";
import { IssuesStore } from "./IssuesStore";

function runGit(rootPath: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile("git", ["-C", rootPath, ...args], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }

      resolve(stdout.trim());
    });
  });
}

function hasStagedIssueChanges(rootPath: string, issuesPathspec: string) {
  return new Promise<boolean>((resolve, reject) => {
    execFile("git", ["-C", rootPath, "diff", "--cached", "--quiet", "--exit-code", "--", issuesPathspec], (error) => {
      if (!error) {
        resolve(false);
        return;
      }

      const exitCode = typeof error.code === "number" ? error.code : undefined;

      if (exitCode === 1) {
        resolve(true);
        return;
      }

      reject(new Error(error.message));
    });
  });
}

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
  const label = path.basename(item.targetUri.fsPath);
  const confirmed = await vscode.window.showWarningMessage(`Delete "${label}"? This cannot be undone.`, { modal: true }, "Yes");

  if (confirmed !== "Yes") {
    return;
  }

  store.delete(item.targetUri.fsPath);
}

function registerFileWatcher(store: IssuesStore, issuesProvider: IssuesProvider, context: vscode.ExtensionContext) {
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(store.location, "**"));

  watcher.onDidChange(() => issuesProvider.refresh());
  watcher.onDidCreate(() => issuesProvider.refresh());
  watcher.onDidDelete(() => issuesProvider.refresh());

  context.subscriptions.push(watcher);
}

async function commitIssues(rootPath: string, store: IssuesStore) {
  const issuesPathspec = path.relative(rootPath, store.location).split(path.sep).join("/");

  try {
    await runGit(rootPath, ["add", "-A", "--", issuesPathspec]);

    if (!(await hasStagedIssueChanges(rootPath, issuesPathspec))) {
      void vscode.window.showInformationMessage("No changes under issues to commit.");
      return;
    }

    await runGit(rootPath, ["commit", "-m", "backlog", "--", issuesPathspec]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Issue commit failed: ${message}`);
  }
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
      await createNewIssue(store, target.targetUri.fsPath);
    }),

    vscode.commands.registerCommand("issueExplorer.newIssue", async () => {
      await createNewIssue(store);
    }),

    vscode.commands.registerCommand("issueExplorer.deleteIssue", (target: IssueItem) => deleteIssue(store, target)),

    vscode.commands.registerCommand("issueExplorer.commitIssues", async () => {
      await commitIssues(rootPath, store);
    })
  );

  registerFileWatcher(store, issuesProvider, context);
}

export function deactivate() {}

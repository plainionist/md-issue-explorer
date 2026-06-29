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

export async function hasIssueChanges(rootPath: string, issuesPathspec: string) {
  const status = await runGit(rootPath, ["status", "--porcelain", "--untracked-files=all", "--", issuesPathspec]);

  return status.length > 0;
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

export function toGitPathspec(rootPath: string, issuesLocation: string) {
  const relativePath = path.relative(rootPath, issuesLocation).split(path.sep).join("/");

  return relativePath || ".";
}

async function commitIssues(rootPath: string, store: IssuesStore) {
  try {
    const gitRoot = await runGit(rootPath, ["rev-parse", "--show-toplevel"]);
    const issuesTarget = path.resolve(store.location);

    if (!(await hasIssueChanges(gitRoot, issuesTarget))) {
      void vscode.window.showInformationMessage(`No changes under ${store.location} to commit.`);
      return;
    }

    await runGit(gitRoot, ["add", "-A", "--", issuesTarget]);

    await runGit(gitRoot, ["commit", "-m", "backlog", "--", issuesTarget]);
    await vscode.commands.executeCommand("git.refresh");
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

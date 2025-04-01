import * as vscode from "vscode";
import { IssuesProvider } from "./IssuesProvider";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { IssueItem } from "./IssueItem";

async function createNewIssue(issuesFolder: string | undefined) {
  if (!issuesFolder) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const name = await vscode.window.showInputBox({ prompt: "Enter issue name" });
  if (!name) {
    return;
  }

  const templatePath = path.join(issuesFolder, ".template");
  const defaultTemplate = "---\ntitle: \npriority: 9999\n---\n\n";
  const templateContent = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : defaultTemplate;

  const parsed = matter(templateContent);
  parsed.data.title = name;

  const filePath = path.join(issuesFolder, name.endsWith(".md") ? name : `${name}.md`);
  const issueContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, issueContent);

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

async function deleteIssue(issuesProvider: IssuesProvider, item: IssueItem) {
  const label = path.basename(item.resourceUri.fsPath);
  const confirmed = await vscode.window.showWarningMessage(`Delete "${label}"? This cannot be undone.`, { modal: true }, "Yes");

  if (confirmed !== "Yes") {
    return;
  }
  const targetPath = item.resourceUri.fsPath;
  const stats = fs.statSync(targetPath);

  if (stats.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }

  issuesProvider.refresh();
}

function registerFileWatcher(issuesFolder: string | undefined, issuesProvider: IssuesProvider, context: vscode.ExtensionContext) {
  if (!issuesFolder) {
    return;
  }

  const issueWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(issuesFolder, "**/*.md"));

  issueWatcher.onDidChange(() => issuesProvider.refresh());
  issueWatcher.onDidCreate(() => issuesProvider.refresh());
  issueWatcher.onDidDelete(() => issuesProvider.refresh());

  vscode.workspace.onDidSaveTextDocument((doc) => {
    const relativePath = path.relative(issuesFolder, doc.uri.fsPath);

    if (
      !relativePath.startsWith("..") && // doc is inside the issues folder
      relativePath.endsWith(".md") &&
      path.basename(doc.uri.fsPath) !== ".template"
    ) {
      issuesProvider.refresh();
    }
  });

  context.subscriptions.push(issueWatcher);
}

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const issuesFolder = rootPath ? path.join(rootPath, "issues") : "";
  const issuesProvider = new IssuesProvider(issuesFolder);

  vscode.window.registerTreeDataProvider("issueExplorer", issuesProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.refresh", () => issuesProvider.refresh()),

    vscode.commands.registerCommand("issueExplorer.newIssueInFolder", async (target: IssueItem) => {
      await createNewIssue(target.resourceUri!.fsPath);
    }),

    vscode.commands.registerCommand("issueExplorer.newIssue", async () => {
      await createNewIssue(issuesFolder);
    }),

    vscode.commands.registerCommand("issueExplorer.deleteIssue", (target: IssueItem) => deleteIssue(issuesProvider, target))
  );

  registerFileWatcher(issuesFolder, issuesProvider, context);
}

export function deactivate() {}

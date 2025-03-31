import * as vscode from "vscode";
import { IssueProvider } from "./IssueProvider";
import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { IssueItem } from "./IssueItem";

async function createNewIssue(issuesFolder: string | undefined) {
  if (!issuesFolder) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const templatePath = path.join(issuesFolder, ".template");
  const defaultTemplate = "---\ntitle: \npriority: \n---\n\n";
  const templateContent = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : defaultTemplate;

  const name = await vscode.window.showInputBox({ prompt: "Enter issue name" });
  if (!name) {
    return;
  }

  const parsed = matter(templateContent);
  parsed.data.title = name;

  const filePath = path.join(issuesFolder, name.endsWith(".md") ? name : `${name}.md`);
  const issueContent = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, issueContent);

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);
}

async function deleteIssue(issueProvider: IssueProvider, item: IssueItem) {
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

  issueProvider.refresh();
}

function registerFileWatcher(issuesFolder: string | undefined, issueProvider: IssueProvider, context: vscode.ExtensionContext) {
  if (!issuesFolder) {
    return;
  }

  const issueWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(issuesFolder, "**/*.md"));

  issueWatcher.onDidChange(() => issueProvider.refresh());
  issueWatcher.onDidCreate(() => issueProvider.refresh());
  issueWatcher.onDidDelete(() => issueProvider.refresh());

  vscode.workspace.onDidSaveTextDocument((doc) => {
    const relativePath = path.relative(issuesFolder, doc.uri.fsPath);

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
  const issueFolder = rootPath ? path.join(rootPath, "issues") : "";
  const issueProvider = new IssueProvider(issueFolder);

  vscode.window.registerTreeDataProvider("issueExplorer", issueProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("issueExplorer.refresh", () => issueProvider.refresh()),

    vscode.commands.registerCommand("issueExplorer.newIssue", async (target?: IssueItem) => {
      const folderPath = target?.contextValue === "folder" ? target.resourceUri.fsPath : path.join(rootPath ?? "", "issues");
      await createNewIssue(folderPath);
    }),

    vscode.commands.registerCommand("issueExplorer.deleteIssue", (target: IssueItem) => deleteIssue(issueProvider, target))
  );

  registerFileWatcher(issueFolder, issueProvider, context);
}

export function deactivate() {}

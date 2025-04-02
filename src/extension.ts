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
}

export function deactivate() {}

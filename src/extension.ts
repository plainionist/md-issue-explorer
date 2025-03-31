import * as vscode from 'vscode';
import { IssueProvider } from './IssueProvider';

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const issueProvider = new IssueProvider(rootPath ?? '');

  vscode.window.registerTreeDataProvider('issueExplorer', issueProvider);

  vscode.commands.registerCommand('issueExplorer.refresh', () => issueProvider.refresh());
}

export function deactivate() {}

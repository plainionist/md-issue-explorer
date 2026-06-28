import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

type IssueHeader = {
  title: string;
  priority: number;
  status?: string;
};

export class IssuesStore {
  constructor(workspaceRoot: string) {
    this.location = this.resolveLocation(workspaceRoot);
  }

  public readonly location: string;

  private resolveLocation(workspaceRoot: string) {
    // Support opening VS Code directly on an issues folder.
    if (path.basename(workspaceRoot).toLowerCase() === "issues") {
      return workspaceRoot;
    }

    const candidatePaths = [path.join("docs", "issues"), path.join("doc", "issues"), "issues"];

    for (const candidatePath of candidatePaths) {
      const fullPath = path.join(workspaceRoot, candidatePath);

      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return path.join(workspaceRoot, "issues");
  }

  public create(folder: string | undefined, name: string) {
    const templatePath = path.join(this.location, ".template");
    const defaultTemplate = "---\ntitle: \npriority: 9999\n---\n\n";
    const templateContent = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : defaultTemplate;

    const parsed = matter(templateContent);
    parsed.data.title = name;

    const filePath = path.join(folder ?? this.location, name.endsWith(".md") ? name : `${name}.md`);
    const issueContent = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, issueContent);

    return filePath;
  }

  public delete(filePath: string) {
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }

  public read(filePath: string): IssueHeader {
    const content = fs.readFileSync(filePath, "utf8");
    const doc = matter(content);
    const status = typeof doc.data.status === "string" ? doc.data.status.trim().toLowerCase() : undefined;
    
    return {
      title: doc.data.title,
      priority: doc.data.priority ?? 9999,
      status,
    };
  }

  public contains(fsPath: string) {
    const relativePath = path.relative(this.location, fsPath);

    return !relativePath.startsWith("..") && relativePath.endsWith(".md") && path.basename(fsPath) !== ".template";
  }
}

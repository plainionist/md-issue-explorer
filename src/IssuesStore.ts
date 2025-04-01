import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";

type IssueHeader = {
  title: string;
  priority: number;
};

export class IssuesStore {
  constructor(workspaceRoot: string) {
    this.location = path.join(workspaceRoot, "issues");
  }

  public readonly location: string;

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

  public delete(fsPath: string) {
    const stats = fs.statSync(fsPath);

    if (stats.isDirectory()) {
      fs.rmSync(fsPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fsPath);
    }
  }

  public read(fsPath: string): IssueHeader {
    const content = fs.readFileSync(fsPath, "utf8");
    const doc = matter(content);
    
    return {
      title: doc.data.title,
      priority: doc.data.priority ?? 9999,
    };
  }

  public contains(fsPath: string) {
    const relativePath = path.relative(this.location, fsPath);

    return !relativePath.startsWith("..") && relativePath.endsWith(".md") && path.basename(fsPath) !== ".template";
  }
}

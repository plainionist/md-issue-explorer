import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "node:child_process";
import { IssuesStore } from "../IssuesStore";
import { hasIssueChanges, toGitPathspec } from "../extension";

suite("Store", () => {
  let tmpRoot: string;
  let store: IssuesStore;

  setup(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "issues-test-"));
    store = new IssuesStore(tmpRoot);
    fs.mkdirSync(store.location, { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  test("Create new issue", () => {
    const filePath = store.create(undefined, "New Issue 17");
    
    assert.ok(fs.existsSync(filePath));
    assert.ok(filePath.endsWith(".md"));

    const content = fs.readFileSync(filePath, "utf8");

    assert.ok(content.includes("title: New Issue 17"));
    assert.ok(content.includes("priority: 9999")); // default priority
  });

  test("Use existing template", () => {
    const template = "---\ntitle: \npriority: 42\n---\n\nFrom Template";
    fs.writeFileSync(path.join(store.location, ".template"), template);

    const filePath = store.create(undefined, "Templated");

    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("priority: 42"));
    assert.ok(content.includes("From Template"));
  });

  test("Create issue in subfolder", () => {
    const subfolder = path.join(store.location, "Sub");
    fs.mkdirSync(subfolder);

    const filePath = store.create(subfolder, "SubIssue");

    assert.ok(fs.existsSync(filePath));
    assert.ok(filePath.startsWith(subfolder));
  });

  test("Delete an issue", () => {
    const filePath = store.create(undefined, "ToDelete");
    assert.ok(fs.existsSync(filePath));

    store.delete(filePath);

    assert.ok(!fs.existsSync(filePath));
  });

  test("Delete folder recursively", () => {
    const subfolder = path.join(store.location, "ToDeleteFolder");
    fs.mkdirSync(subfolder);
    const filePath = store.create(subfolder, "Inside");
    assert.ok(fs.existsSync(filePath));

    store.delete(subfolder);
    
    assert.ok(!fs.existsSync(subfolder));
  });

  test("Read issue header", () => {
    const filePath = store.create(undefined, "MyReadTest");
    const header = store.read(filePath);

    assert.strictEqual(header.title, "MyReadTest");
    assert.strictEqual(header.priority, 9999);
  });

  test("Contains returns true for valid issue", () => {
    const filePath = store.create(undefined, "Known");

    assert.ok(store.contains(filePath));
  });

  test("Contains returns false for .template", () => {
    const templatePath = path.join(store.location, ".template");
    fs.writeFileSync(templatePath, "---\ntitle: Template\npriority: 1\n---");

    assert.strictEqual(store.contains(templatePath), false);
  });

  test("Contains returns false for non-md files", () => {
    const other = path.join(store.location, "note.txt");
    fs.writeFileSync(other, "some content");

    assert.strictEqual(store.contains(other), false);
  });

  test("Contains returns false for file outside issues folder", () => {
    const outside = path.join(tmpRoot, "outside.md");
    fs.writeFileSync(outside, "---\ntitle: Outside\npriority: 1\n---");
    
    assert.strictEqual(store.contains(outside), false);
  });

  test("Resolves docs/issues over top-level issues", () => {
    const topLevelIssues = path.join(tmpRoot, "issues");
    const docsIssues = path.join(tmpRoot, "docs", "issues");
    fs.mkdirSync(topLevelIssues, { recursive: true });
    fs.mkdirSync(docsIssues, { recursive: true });

    const docsStore = new IssuesStore(tmpRoot);

    assert.strictEqual(docsStore.location, docsIssues);
  });

  test("Preserves actual casing for docs/Issues", () => {
    const docsIssues = path.join(tmpRoot, "docs", "Issues");
    fs.mkdirSync(docsIssues, { recursive: true });

    const docsStore = new IssuesStore(tmpRoot);

    assert.strictEqual(docsStore.location, fs.realpathSync.native(docsIssues));
  });

  test("Uses workspace root when workspace itself is an issues folder", () => {
    const issuesRoot = path.join(tmpRoot, "docs", "issues");
    fs.mkdirSync(issuesRoot, { recursive: true });

    const issuesRootStore = new IssuesStore(issuesRoot);

    assert.strictEqual(issuesRootStore.location, issuesRoot);
  });

  test("Git pathspec is dot when issues folder equals workspace root", () => {
    const issuesRoot = path.join(tmpRoot, "docs", "issues");

    assert.strictEqual(toGitPathspec(issuesRoot, issuesRoot), ".");
  });
});

suite("Commit change detection", () => {
  let tmpRoot: string;
  let issuesRoot: string;

  const git = (...args: string[]) => execFileSync("git", ["-C", tmpRoot, ...args], { encoding: "utf8" }).trim();

  setup(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "issues-git-test-"));
    issuesRoot = path.join(tmpRoot, "issues");
    fs.mkdirSync(issuesRoot, { recursive: true });

    git("init");
    git("config", "user.name", "Test User");
    git("config", "user.email", "test@example.com");
  });

  teardown(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // Best-effort cleanup: Windows can briefly lock files in temp git repos during test shutdown.
    }
  });

  function commitIssue(name: string, content = "---\ntitle: Test\npriority: 1\n---\n") {
    const issuePath = path.join(issuesRoot, name);
    fs.writeFileSync(issuePath, content);
    git("add", "-A", "--", "issues");
    git("commit", "-m", "seed", "--", "issues");
    return issuePath;
  }

  test("Detects untracked files under issues", async () => {
    fs.writeFileSync(path.join(issuesRoot, "new.md"), "---\ntitle: New\npriority: 1\n---\n");

    assert.strictEqual(await hasIssueChanges(tmpRoot, issuesRoot), true);
  });

  test("Detects modified tracked files under issues", async () => {
    const issuePath = commitIssue("tracked.md");
    fs.writeFileSync(issuePath, "---\ntitle: Changed\npriority: 1\n---\n");

    assert.strictEqual(await hasIssueChanges(tmpRoot, issuesRoot), true);
  });

  test("Detects deleted tracked files under issues", async () => {
    const issuePath = commitIssue("gone.md");
    fs.unlinkSync(issuePath);

    assert.strictEqual(await hasIssueChanges(tmpRoot, issuesRoot), true);
  });

  test("Ignores changes outside issues", async () => {
    fs.writeFileSync(path.join(tmpRoot, "outside.md"), "outside");

    assert.strictEqual(await hasIssueChanges(tmpRoot, issuesRoot), false);
  });
});

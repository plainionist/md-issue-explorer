import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { IssuesStore } from "../IssuesStore";

suite("Store", () => {
  let tmpRoot: string;
  let store: IssuesStore;

  setup(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "issues-test-"));
    store = new IssuesStore(tmpRoot);
    fs.mkdirSync(store.location, { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
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
});

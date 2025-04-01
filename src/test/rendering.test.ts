import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { IssuesProvider } from '../IssuesProvider';

suite('Issue Explorer - Tree Rendering', () => {
  const issuesPath = path.join(path.resolve(__dirname, './test-data'), 'issues');

  setup(() => {
    fs.rmSync(issuesPath, { recursive: true, force: true });
    fs.mkdirSync(issuesPath, { recursive: true });
  });

  test('Single MD file, frontmatter title used as label in tree', async () => {
    const fileContent = `---\ntitle: My Frontmatter Title\npriority: 1\n---\n\nSome content.`;
    const filePath = path.join(issuesPath, 'my-issue.md');
    fs.writeFileSync(filePath, fileContent);

    const provider = new IssuesProvider(issuesPath);
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, 'My Frontmatter Title');
  });

  test('Two MD files are sorted by priority', async () => {
    fs.writeFileSync(path.join(issuesPath, 'a.md'), `---\ntitle: A\npriority: 5\n---`);
    fs.writeFileSync(path.join(issuesPath, 'b.md'), `---\ntitle: B\npriority: 1\n---`);

    const provider = new IssuesProvider(issuesPath);
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].label, 'B');
    assert.strictEqual(items[1].label, 'A');
  });

  test('Folder is included and its priority reflects the highest child priority', async () => {
    const folder = path.join(issuesPath, 'Release 1');
    fs.writeFileSync(path.join(issuesPath, 'a.md'), `---\ntitle: A\npriority: 5\n---`);
    fs.writeFileSync(path.join(issuesPath, 'b.md'), `---\ntitle: B\npriority: 1\n---`);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'x.md'), `---\ntitle: X\npriority: 3\n---`);
    fs.writeFileSync(path.join(folder, 'y.md'), `---\ntitle: Y\npriority: 2\n---`);

    const provider = new IssuesProvider(issuesPath);
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[1].label, 'Release 1');
    assert.strictEqual(items[1].priority, 2);

    const children = await provider.getChildren(items[1]);
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0].label, 'Y');
    assert.strictEqual(children[1].label, 'X');
  });

  test('.template file is not shown in the tree', async () => {
    fs.writeFileSync(path.join(issuesPath, '.template'), `---\ntitle: Template\npriority: 0\n---`);
    fs.writeFileSync(path.join(issuesPath, 'real.md'), `---\ntitle: Real\npriority: 1\n---`);

    const provider = new IssuesProvider(issuesPath);
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, 'Real');
  });

  test('Non-markdown files are ignored', async () => {
    fs.writeFileSync(path.join(issuesPath, 'real.md'), `---\ntitle: Real\npriority: 1\n---`);
    fs.writeFileSync(path.join(issuesPath, 'notes.txt'), `This should be ignored`);

    const provider = new IssuesProvider(issuesPath);
    const items = await provider.getChildren();

    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].label, 'Real');
  });
});

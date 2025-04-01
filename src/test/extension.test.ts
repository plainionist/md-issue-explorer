import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { IssuesProvider } from '../IssuesProvider';

suite('Issue Explorer - Tree Rendering', () => {
  const testRoot = path.resolve(__dirname, './test-data');
  const issuesPath = path.join(testRoot, 'issues');

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
});

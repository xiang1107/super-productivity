import {
  extractTaskExportImages,
  rewriteTaskExportImages,
} from './task-export-markdown.util';

describe('task export Markdown images', () => {
  const url = 'indexeddb://clipboard-images/example';
  const image = `![screenshot](${url})`;
  const replacements = new Map([[url, 'images/image-1.png']]);
  const rewritten = '![screenshot](images/image-1.png)';

  it('parses parentheses and angle-bracket destinations with titles', () => {
    const markdown =
      '![a](file:///tmp/screenshot(1).png)\n![b](<file:///tmp/a b.png> "caption")';
    expect(extractTaskExportImages(markdown).map((ref) => ref.url)).toEqual([
      'file:///tmp/screenshot(1).png',
      'file:///tmp/a b.png',
    ]);
    expect(
      rewriteTaskExportImages(
        markdown,
        new Map([
          ['file:///tmp/screenshot(1).png', 'images/a.png'],
          ['file:///tmp/a b.png', 'images/b.png'],
        ]),
      ),
    ).toBe('![a](images/a.png)\n![b](images/b.png "caption")');
  });

  it('rewrites reference images without changing ordinary links using the same definition', () => {
    const markdown = `![screenshot][img]\n\n[ordinary link][img]\n\n[img]: ${url} "caption"`;
    expect(extractTaskExportImages(markdown)).toEqual([{ url }]);
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `![screenshot](images/image-1.png "caption")\n\n[ordinary link][img]\n\n[img]: ${url} "caption"`,
    );
  });

  it('leaves inline and fenced code examples untouched', () => {
    const examples = `\`${image}\`\n\n\`\`\`md\n${image}\n\`\`\`\n\n`;
    expect(extractTaskExportImages(examples)).toEqual([]);
    expect(rewriteTaskExportImages(examples + image, replacements)).toBe(
      examples + rewritten,
    );
  });

  it('preserves code inside blockquotes and images inside nested lists', () => {
    const markdown = `> \`\`\`md\n> ${image}\n> \`\`\`\n>\n> ${image}\n\n- Parent\n  - ${image}`;
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `> \`\`\`md\n> ${image}\n> \`\`\`\n>\n> ${rewritten}\n\n- Parent\n  - ${rewritten}`,
    );
  });

  it('preserves escaped examples and unrelated remote images', () => {
    const markdown = `\\${image}\n\n${image}\n\n![remote](https://example.test/a.png)`;
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `\\${image}\n\n${rewritten}\n\n![remote](https://example.test/a.png)`,
    );
  });

  it('preserves CRLFs, image alt text and repeated occurrences', () => {
    const markdown = `# Notes\r\n\r\n**${image}**\r\n\r\n${image}\r\n`;
    expect(extractTaskExportImages(markdown)).toEqual([{ url }]);
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `# Notes\r\n\r\n**${rewritten}**\r\n\r\n${rewritten}\r\n`,
    );
  });

  it('does not replace text in a preceding link destination', () => {
    const markdown = `[text](https://example.test/${image})\n\n${image}`;
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `[text](https://example.test/${image})\n\n${rewritten}`,
    );
  });
  it('retains escaped brackets and nested markup in image labels', () => {
    const label = String.raw`![alt\]text [nested]]`;
    const markdown = `${label}(${url} "caption")`;
    expect(rewriteTaskExportImages(markdown, replacements)).toBe(
      `${label}(images/image-1.png "caption")`,
    );
  });
});

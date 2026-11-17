import { lexer, type Token, type Tokens } from 'marked';

export interface TaskExportImageRef {
  url: string;
}

const childrenOf = (token: Token): Token[] => {
  if (token.type === 'image') {
    return [];
  }
  if (token.type === 'list') {
    return (token as Tokens.List).items;
  }
  if (token.type === 'table') {
    const table = token as Tokens.Table;
    return [...table.header, ...table.rows.flat()].flatMap((cell) => cell.tokens);
  }
  return 'tokens' in token ? (token.tokens ?? []) : [];
};

export const extractTaskExportImages = (markdown: string): TaskExportImageRef[] => {
  const urls = new Set<string>();
  const visit = (tokens: Token[]): void => {
    for (const token of tokens) {
      if (token.type === 'image') {
        urls.add((token as Tokens.Image).href);
      } else {
        visit(childrenOf(token));
      }
    }
  };
  visit(lexer(markdown));
  return [...urls].map((url) => ({ url }));
};

/** Finds a parsed token in the original source. marked removes list/blockquote
 * prefixes and normalizes CRLFs; matching lines retains their source positions. */
const findSourceRange = (
  markdown: string,
  raw: string,
  cursor: number,
  limit: number,
): { start: number; end: number } | undefined => {
  let start = -1;
  let end = cursor;
  for (const line of raw.split('\n')) {
    if (!line) {
      continue;
    }
    const offset = markdown.indexOf(line, end);
    if (offset === -1 || offset + line.length > limit) {
      return undefined;
    }
    start = start === -1 ? offset : start;
    end = offset + line.length;
  }
  return start === -1 ? undefined : { start, end };
};

// marked's image.text unescapes brackets. Keep the original label so rewriting
// the destination cannot turn a valid alt label into broken Markdown.
const imageLabel = (raw: string): string => {
  let depth = 0;
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === '\\') {
      i++;
    } else if (raw[i] === '[') {
      depth++;
    } else if (raw[i] === ']' && --depth === 0) {
      return raw.slice(0, i + 1);
    }
  }
  return raw;
};

export const rewriteTaskExportImages = (
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string => {
  let cursor = 0;
  const edits: { start: number; end: number; text: string }[] = [];
  const visit = (tokens: Token[], limit: number): void => {
    for (const token of tokens) {
      const range = findSourceRange(markdown, token.raw, cursor, limit);
      if (!range) {
        continue;
      }
      cursor = range.start;
      if (token.type === 'image') {
        const image = token as Tokens.Image;
        const replacement = replacements.get(image.href);
        if (replacement) {
          const title = image.title
            ? ` "${image.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
            : '';
          edits.push({
            ...range,
            text: `${imageLabel(image.raw)}(${replacement}${title})`,
          });
        }
      } else {
        visit(childrenOf(token), range.end);
      }
      // Consume the complete container (including link destinations, code and
      // escapes), so an identical image example cannot capture a later edit.
      cursor = range.end;
    }
  };
  visit(lexer(markdown), markdown.length);
  for (const edit of edits.reverse()) {
    markdown = markdown.slice(0, edit.start) + edit.text + markdown.slice(edit.end);
  }
  return markdown;
};

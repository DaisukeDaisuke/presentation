import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const errors = [];
const fail = message => errors.push(message);
const decoder = new TextDecoder('utf-8', { fatal: true });
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const files = (await readdir(root, { recursive: true })).filter(name => /\.(html|css|js|svg)$/.test(name));
const documents = new Map();
for (const file of files) {
  const bytes = await readFile(path.join(root, file));
  let source;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) throw new Error('UTF-16LE is not supported');
    source = decoder.decode(bytes);
  } catch (error) { fail(`${file}: must be UTF-8 (${error.message})`); continue; }
  if (!file.endsWith('.html')) continue;
  const nodes = [];
  const ids = new Map();
  const stack = [];
  const tokens = source.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi);
  for (const token of tokens) {
    if (!token[1]) continue;
    const tag = token[1].toLowerCase();
    if (token[0].startsWith('</')) {
      const parent = stack.pop();
      if (parent?.tag !== tag) fail(`${file}: mismatched closing tag ${tag}`);
      continue;
    }
    const attrs = Object.fromEntries([...token[0].slice(tag.length + 1, -1).matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '']));
    const node = { tag, attrs, parent: stack.at(-1), children: [] };
    node.parent?.children.push(node);
    nodes.push(node);
    if (attrs.id) {
      if (ids.has(attrs.id)) fail(`${file}: duplicate id ${attrs.id}`);
      ids.set(attrs.id, node);
    }
    if (!voidTags.has(tag) && !token[0].endsWith('/>')) stack.push(node);
  }
  if (stack.length) fail(`${file}: unclosed tags ${stack.map(n => n.tag).join(', ')}`);
  const slides = nodes.filter(n => n.tag === 'deck-slide');
  const decks = nodes.filter(n => n.tag === 'presentation-deck');
  if (decks.length > 1) fail(`${file}: only one deck per document is supported`);
  for (const slide of slides) {
    if (!slide.attrs.id || slide.attrs.id === 'none') fail(`${file}: slide requires a unique id other than "none"`);
    if (!['deck-slide', 'presentation-deck'].includes(slide.parent?.tag)) fail(`${file}: ${slide.attrs.id} must be a direct child of a deck or slide`);
    const bodies = slide.children.filter(n => n.attrs.class?.split(/\s+/).includes('slide-body'));
    if (bodies.length !== 1) fail(`${file}: ${slide.attrs.id} must have exactly one direct .slide-body`);
    for (const direction of ['left','right','up','down']) {
      const target = slide.attrs[direction];
      if (target !== undefined && target !== 'none' && ids.get(target)?.tag !== 'deck-slide') fail(`${file}: invalid ${direction}="${target}" on ${slide.attrs.id}`);
    }
  }
  for (const node of nodes.filter(n => n.tag === 'deck-command')) {
    if (!['left','right','up','down','next','previous','goto','home','end','overview','close','fullscreen'].includes(node.attrs.command)) fail(`${file}: unknown command ${node.attrs.command}`);
    if (node.attrs.command === 'goto' && ids.get(node.attrs.to)?.tag !== 'deck-slide') fail(`${file}: invalid goto target ${node.attrs.to}`);
    if (!node.children.some(n => n.tag === 'button' && n.attrs.type === 'button')) fail(`${file}: deck-command requires a button with type="button"`);
  }
  for (const node of nodes.filter(n => n.tag === 'deck-fragment')) {
    if (node.attrs.step !== undefined && !/^[1-9]\d*$/.test(node.attrs.step)) fail(`${file}: fragment step must be a positive integer`);
    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor.tag === 'deck-fragment') fail(`${file}: fragments must not be nested`);
    }
  }
  documents.set(file, { source, nodes, ids, slides });
}
for (const [file, { nodes, ids }] of documents) {
  for (const node of nodes) {
    for (const key of ['href','src']) {
      const value = node.attrs[key];
      if (!value || /^(?:[a-z]+:|\/\/)/i.test(value)) continue;
      if (value.startsWith('/')) { fail(`${file}: use a relative URL for project Pages: ${value}`); continue; }
      const [filename, hash] = value.split('#');
      if (!filename && hash && !ids.has(decodeURIComponent(hash))) fail(`${file}: missing anchor ${value}`);
      if (filename) {
        const localName = filename.split('?')[0];
        const resolved = path.resolve(root, path.dirname(file), localName, localName.endsWith('/') ? 'index.html' : '');
        if (!resolved.startsWith(root + path.sep)) { fail(`${file}: reference outside dist: ${value}`); continue; }
        try { await access(resolved); } catch { fail(`${file}: missing local file ${value}`); }
        const target = documents.get(path.relative(root, resolved));
        if (hash && target && !target.ids.has(decodeURIComponent(hash))) fail(`${file}: missing destination anchor ${value}`);
      }
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated UTF-8 in ${files.length} files; ${documents.size} HTML documents; ${[...documents.values()].reduce((n, d) => n + d.slides.length, 0)} slides. IDs, structure, commands, and local links are valid.`);
}

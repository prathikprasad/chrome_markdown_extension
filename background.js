async function save(tab) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: pageToMarkdown,
  });
  const name = (result.title || 'page').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) + '.md';
  await chrome.downloads.download({
    url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(result.md),
    filename: name,
    saveAs: true, // shows a Save dialog, like Ctrl+P
  });
}

chrome.commands.onCommand.addListener((cmd, tab) => cmd === 'save-markdown' && save(tab));
chrome.action.onClicked.addListener(save);

// Runs inside the page. Must be self-contained (no outer references).
function pageToMarkdown() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'IFRAME', 'NAV', 'FOOTER', 'FORM', 'BUTTON', 'TEMPLATE']);
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };

  const inline = (node) => [...node.childNodes].map(conv).join('');

  function list(el, depth) {
    const ordered = el.tagName === 'OL';
    return [...el.children].filter((c) => c.tagName === 'LI').map((li, i) => {
      const pad = '  '.repeat(depth);
      const body = [...li.childNodes].map((c) =>
        c.tagName === 'UL' || c.tagName === 'OL' ? '\n' + list(c, depth + 1) : conv(c)
      ).join('').trim();
      return pad + (ordered ? `${i + 1}. ` : '- ') + body;
    }).join('\n');
  }

  function table(el) {
    const rows = [...el.querySelectorAll('tr')].map((tr) =>
      [...tr.children].map((td) => inline(td).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim())
    );
    if (!rows.length) return '';
    const n = Math.max(...rows.map((r) => r.length));
    const line = (r) => '| ' + Array.from({ length: n }, (_, i) => r[i] || '').join(' | ') + ' |';
    return '\n\n' + [line(rows[0]), line(Array(n).fill('---')), ...rows.slice(1).map(line)].join('\n') + '\n\n';
  }

  function conv(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE || SKIP.has(node.tagName)) return '';
    if (!node.checkVisibility() || node.getAttribute('aria-hidden') === 'true') return '';
    const t = node.tagName;
    switch (t) {
      case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
        return `\n\n${'#'.repeat(+t[1])} ${inline(node).trim()}\n\n`;
      case 'P': case 'DIV': case 'SECTION': case 'ARTICLE': case 'MAIN': case 'HEADER': case 'ASIDE': case 'FIGURE':
        return `\n\n${inline(node).trim()}\n\n`;
      case 'BR': return '  \n';
      case 'HR': return '\n\n---\n\n';
      case 'STRONG': case 'B': { const s = inline(node).trim(); return s ? `**${s}**` : ''; }
      case 'EM': case 'I': { const s = inline(node).trim(); return s ? `*${s}*` : ''; }
      case 'DEL': case 'S': return `~~${inline(node)}~~`;
      case 'CODE': return '`' + node.textContent + '`';
      case 'PRE': {
        const lang = (node.querySelector('code')?.className.match(/language-(\S+)/) || [])[1] || '';
        return `\n\n\`\`\`${lang}\n${node.textContent.replace(/\n$/, '')}\n\`\`\`\n\n`;
      }
      case 'A': {
        const text = inline(node).trim();
        const href = node.getAttribute('href');
        return href && text && !href.startsWith('javascript:') ? `[${text}](${abs(href)})` : text;
      }
      case 'IMG': {
        const src = node.getAttribute('src');
        return src ? `![${node.alt || ''}](${abs(src)})` : '';
      }
      case 'UL': case 'OL': return `\n\n${list(node, 0)}\n\n`;
      case 'BLOCKQUOTE':
        return '\n\n' + inline(node).trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
      case 'TABLE': return table(node);
      default: return inline(node);
    }
  }

  // Largest <article>/<main>; if it holds under half the page's text it's a teaser/card, so use the whole body.
  // ponytail: text-length heuristic. Swap in Readability.js if you want smarter extraction.
  const len = (el) => el.innerText.length;
  const best = [...document.querySelectorAll('article, main, [role="main"]')].sort((a, b) => len(b) - len(a))[0];
  const root = best && len(best) > len(document.body) * 0.5 ? best : document.body;
  const body = conv(root)
    .replace(/[ \t]+\n/g, (m) => (m.startsWith('  ') ? '  \n' : '\n'))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const md = `# ${document.title}\n\nSource: ${location.href}\n\n${body}\n`;
  return { title: document.title, md };
}

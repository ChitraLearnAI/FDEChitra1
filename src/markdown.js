// Small, safe Markdown renderer for bot replies: escapes all HTML first,
// then supports code blocks, inline code, headings, bold/italic, links and lists.

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderMarkdown(src) {
  const parts = escape(src).split(/```/);
  let html = '';

  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      // Fenced code block: drop the language tag on the first line.
      const code = part.replace(/^[\w+-]*\n/, '');
      html += `<pre><code>${code.replace(/\n$/, '')}</code></pre>`;
      return;
    }

    let list = null;
    let para = [];
    const flushPara = () => {
      if (para.length) html += `<p>${inline(para.join('<br>'))}</p>`;
      para = [];
    };
    const flushList = () => {
      if (list) html += `</${list}>`;
      list = null;
    };

    for (const line of part.split('\n')) {
      const heading = line.match(/^#{1,6}\s+(.*)/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);

      if (heading) {
        flushPara();
        flushList();
        html += `<h4>${inline(heading[1])}</h4>`;
      } else if (bullet || numbered) {
        flushPara();
        const type = bullet ? 'ul' : 'ol';
        if (list !== type) {
          flushList();
          html += `<${type}>`;
          list = type;
        }
        html += `<li>${inline((bullet || numbered)[1])}</li>`;
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  });

  return html;
}

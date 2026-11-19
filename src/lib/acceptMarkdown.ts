/** Prefer Markdown only when it is explicitly requested and at least as acceptable as HTML. */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranges = accept.split(',').map((part) => {
    const [type, ...parameters] = part.trim().toLowerCase().split(';');
    const qParameter = parameters.map((p) => p.trim()).find((p) => p.startsWith('q='));
    const value = qParameter?.slice(2);
    const quality = value === undefined ? 1 : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    return { type: type.trim(), quality };
  });
  const quality = (type: string): number => {
    for (const range of [type, 'text/*', '*/*']) {
      const matches = ranges.filter((item) => item.type === range);
      if (matches.length) return Math.max(...matches.map((item) => item.quality));
    }
    return 0;
  };
  const markdown = ranges.some((item) => item.type === 'text/markdown') ? quality('text/markdown') : 0;
  return markdown > 0 && markdown >= quality('text/html');
}

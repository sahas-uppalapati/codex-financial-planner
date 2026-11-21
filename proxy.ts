import { next, rewrite } from '@vercel/functions';
import { prefersMarkdown } from './src/lib/acceptMarkdown.js';

export default function proxy(request: Request) {
  const headers = new Headers(request.headers);
  // Never trust the caller's copy of this internal routing signal.
  headers.delete('x-careerworth-markdown');
  if ((request.method === 'GET' || request.method === 'HEAD') && prefersMarkdown(headers.get('accept'))) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return rewrite(new URL('/home.md', url), {
        request: { headers },
        headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' },
      });
    }
    headers.set('x-careerworth-markdown', '1');
  }
  return next({ request: { headers } });
}

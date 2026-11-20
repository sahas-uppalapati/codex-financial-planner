import { next } from '@vercel/functions';
import { prefersMarkdown } from './src/lib/acceptMarkdown.js';

export default function proxy(request: Request) {
  const headers = new Headers(request.headers);
  // Never trust the caller's copy of this internal routing signal.
  headers.delete('x-careerworth-markdown');
  if (prefersMarkdown(request.headers.get('accept'))) headers.set('x-careerworth-markdown', '1');
  return next({ request: { headers } });
}

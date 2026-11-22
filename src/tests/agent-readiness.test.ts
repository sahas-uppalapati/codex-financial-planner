import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import proxy from '../../proxy';
import { prefersMarkdown } from '../lib/acceptMarkdown';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('public agent resources', () => {
  it('provides meaningful initial HTML and valid application metadata', () => {
    const html = read('index.html');
    const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? '';
    expect(html).toContain('<div id="root"></div>');
    expect(fallback.replace(/<[^>]*>/g, '').trim().length).toBeGreaterThan(500);
    expect(fallback).toContain('<h1>');
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(JSON.parse(json)).toMatchObject({ '@type': 'WebApplication', name: 'CareerWorth' });
  });

  it('honors explicit media preferences and quality weights', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
    expect(prefersMarkdown('text/html')).toBe(false);
    expect(prefersMarkdown('*/*')).toBe(false);
    expect(prefersMarkdown('text/markdown;q=0, text/html')).toBe(false);
    expect(prefersMarkdown('text/markdown;q=0.4, text/html;q=0.9')).toBe(false);
    expect(prefersMarkdown('text/markdown;q=0.9, text/html;q=0.4')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=1, text/*;q=0.5')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0, text/*;q=1')).toBe(false);
  });

  it('rewrites the homepage only when the request prefers Markdown', () => {
    const url = 'https://careerworth.vercel.app/';
    const markdown = proxy(new Request(url, { headers: { Accept: 'text/markdown' } }));
    const html = proxy(new Request(url, { headers: { Accept: 'text/html' } }));
    expect(markdown.headers.get('x-middleware-rewrite')).toBe(new URL('/home.md', url).href);
    expect(markdown.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(html.headers.get('x-middleware-next')).toBe('1');
  });

  it('serves existing files before the Markdown fallback for missing paths', () => {
    const { routes } = JSON.parse(read('vercel.json'));
    expect(routes[0]).toMatchObject({ src: '/.*', headers: { Vary: 'Accept' }, continue: true });
    expect(routes[1]).toEqual({ handle: 'filesystem' });
    expect(routes[2]).toMatchObject({ dest: '/404.md', status: 404, headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' } });
    for (const path of ['public/home.md', 'public/404.md', 'public/about.html', 'public/privacy.html', 'public/llms.txt']) {
      expect(read(path).length).toBeGreaterThan(100);
    }
    expect(read('public/llms.txt')).toContain('## When to use CareerWorth');
  });
});

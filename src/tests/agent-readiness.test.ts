import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('public agent resources', () => {
  it('provides meaningful initial HTML and valid application metadata', () => {
    const html = read('index.html');
    const root = html.match(/<div id="root">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(root.replace(/<[^>]*>/g, '').trim().length).toBeGreaterThan(500);
    expect(root).toContain('<h1>');
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(JSON.parse(json)).toMatchObject({ '@type': 'WebApplication', name: 'CareerWorth' });
  });

  it('configures distinct markdown responses for the homepage and missing paths', () => {
    const { routes } = JSON.parse(read('vercel.json'));
    expect(routes[0]).toMatchObject({ src: '/.*', headers: { Vary: 'Accept' }, continue: true });
    expect(routes[1]).toMatchObject({ src: '/', dest: '/home.md', headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' } });
    expect(routes[2]).toEqual({ handle: 'filesystem' });
    expect(routes[3]).toMatchObject({ dest: '/404.md', status: 404, headers: { 'Content-Type': 'text/markdown; charset=utf-8', Vary: 'Accept' } });
    for (const path of ['public/home.md', 'public/404.md', 'public/about.html', 'public/privacy.html', 'public/llms.txt']) {
      expect(read(path).length).toBeGreaterThan(100);
    }
    expect(read('public/llms.txt')).toContain('## When to use CareerWorth');
  });
});

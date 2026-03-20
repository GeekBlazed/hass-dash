import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  markdownToHtml,
  renderNotificationContentHtml,
  sanitizeHtml,
} from './notificationContentRenderer';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('markdownToHtml', () => {
  it('converts bold markdown to <strong>', () => {
    expect(markdownToHtml('**bold**')).toBe('<strong>bold</strong>');
  });

  it('converts italic markdown to <em>', () => {
    expect(markdownToHtml('*italic*')).toBe('<em>italic</em>');
  });

  it('converts inline code to <code>', () => {
    expect(markdownToHtml('`code`')).toBe('<code>code</code>');
  });

  it('converts newlines to <br/>', () => {
    expect(markdownToHtml('line1\nline2')).toBe('line1<br/>line2');
  });

  it('escapes HTML in the input before converting', () => {
    expect(markdownToHtml('<b>not bold</b>')).toBe('&lt;b&gt;not bold&lt;/b&gt;');
  });
});

describe('sanitizeHtml', () => {
  it('falls back to escaping when DOMParser is undefined', () => {
    const original = globalThis.DOMParser;
    // @ts-expect-error intentionally removing DOMParser
    delete globalThis.DOMParser;

    try {
      expect(sanitizeHtml('<b>text</b>')).toBe('&lt;b&gt;text&lt;/b&gt;');
    } finally {
      globalThis.DOMParser = original;
    }
  });

  it('strips script tags', () => {
    const result = sanitizeHtml('<p>safe</p><script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('safe');
  });

  it('strips on* event attributes', () => {
    const result = sanitizeHtml('<img src="/img.png" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('strips javascript: href values', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('allows safe https:// hrefs', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('href="https://example.com"');
  });

  it('allows data:image/ src values', () => {
    const result = sanitizeHtml('<img src="data:image/png;base64,abc">');
    expect(result).toContain('src="data:image/png;base64,abc"');
  });
});

describe('renderNotificationContentHtml', () => {
  it('renders html format with sanitization', () => {
    const result = renderNotificationContentHtml({
      body: '<b>Hello</b><script>bad()</script>',
      format: 'html',
    });
    expect(result).toContain('<b>Hello</b>');
    expect(result).not.toContain('<script>');
  });

  it('renders markdown format', () => {
    const result = renderNotificationContentHtml({
      body: '**bold** text',
      format: 'markdown',
    });
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders plain text format with newlines as <br/>', () => {
    const result = renderNotificationContentHtml({
      body: 'line1\nline2',
      format: 'text',
    });
    expect(result).toMatch(/line1<br\/?>line2/);
  });

  it('renders plain text by default when format is not set', () => {
    const result = renderNotificationContentHtml({ body: 'hello\nworld' });
    expect(result).toMatch(/hello<br\/?>world/);
  });

  it('escapes HTML in plain text body', () => {
    const result = renderNotificationContentHtml({
      body: '<b>not bold</b>',
      format: 'text',
    });
    expect(result).not.toContain('<b>');
  });
});

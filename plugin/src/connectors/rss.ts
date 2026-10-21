// Minimal RSS reader: enough for job feeds (items with simple, possibly CDATA, fields).
import { decodeEntities } from './html.ts';

export type FeedItem = Record<string, string>;

export function parseRssItems(xml: string): FeedItem[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) =>
    readFields(match[1] ?? ''),
  );
}

function readFields(itemXml: string): FeedItem {
  const fields: FeedItem = {};
  for (const match of itemXml.matchAll(/<([a-z][\w:.-]*)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const name = (match[1] ?? '').toLowerCase();
    const raw = match[2] ?? '';
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
    fields[name] = decodeEntities(cdata ? (cdata[1] ?? '') : raw).trim();
  }
  return fields;
}

// Plain text from a .docx (a zip holding word/document.xml), so Claude can read Word CVs.
// Hand-written zip reading because the plugin has no dependencies (spec D14).
import { inflateRawSync } from 'node:zlib';
import { decodeEntities } from '../connectors/html.ts';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

export function docxText(file: Buffer): string {
  const xml = zipEntry(file, 'word/document.xml');
  if (xml === undefined) throw new Error('Not a Word document (no word/document.xml inside)');
  return xmlToText(xml.toString('utf8'));
}

function xmlToText(xml: string): string {
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>|<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function zipEntry(zip: Buffer, name: string): Buffer | undefined {
  const eocd = findEndOfCentralDirectory(zip);
  if (eocd === -1) return undefined;
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count && zip.readUInt32LE(offset) === CENTRAL_SIGNATURE; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const entryName = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (entryName === name) return readLocal(zip, localOffset, compressedSize, method);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return undefined;
}

function readLocal(zip: Buffer, offset: number, size: number, method: number): Buffer | undefined {
  if (zip.readUInt32LE(offset) !== LOCAL_SIGNATURE) return undefined;
  const start = offset + 30 + zip.readUInt16LE(offset + 26) + zip.readUInt16LE(offset + 28);
  const data = zip.subarray(start, start + size);
  if (method === 0) return data;
  return method === 8 ? inflateRawSync(data) : undefined;
}

function findEndOfCentralDirectory(zip: Buffer): number {
  // The record sits at the end, after an optional comment of up to 64 KB.
  const lowest = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= lowest; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

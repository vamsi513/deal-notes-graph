import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isFactField, type FactField } from '../extraction/types';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(here, '../../data');
export const NOTES_DIR = join(DATA_DIR, 'notes');
export const KEY_PATH = join(DATA_DIR, 'key.json');

export type NoteSource = 'EMAIL' | 'MEETING';

export interface NoteRecord {
  id: string;
  source: NoteSource;
  subject: string;
  receivedAt: string;
  body: string;
}

export interface KeyFact {
  field: FactField;
  value: string;
  sourceSentenceIndex: number;
}

export interface KeyEntry {
  noteId: string;
  tricky: string | null;
  facts: KeyFact[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function parseNote(payload: unknown, origin = 'note'): NoteRecord {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`${origin} is not an object`);
  }
  const record = payload as Record<string, unknown>;
  const { id, source, subject, receivedAt, body } = record;
  if (typeof id !== 'string' || id === '') throw new Error(`${origin} has no id`);
  if (source !== 'EMAIL' && source !== 'MEETING') {
    throw new Error(`${id} has an unknown source`);
  }
  if (typeof subject !== 'string') throw new Error(`${id} has no subject`);
  if (typeof receivedAt !== 'string' || Number.isNaN(Date.parse(receivedAt))) {
    throw new Error(`${id} has an invalid receivedAt`);
  }
  if (typeof body !== 'string' || body.trim() === '') throw new Error(`${id} has an empty body`);
  return { id, source, subject, receivedAt, body };
}

export function loadNotes(directory = NOTES_DIR): NoteRecord[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => parseNote(readJson(join(directory, name)), name));
}

export function parseKey(payload: unknown): Record<string, KeyEntry> {
  if (typeof payload !== 'object' || payload === null) throw new Error('key is not an object');
  const out: Record<string, KeyEntry> = {};
  for (const [noteId, raw] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof raw !== 'object' || raw === null) throw new Error(`${noteId} key entry is invalid`);
    const entry = raw as Record<string, unknown>;
    const facts = entry.facts;
    if (!Array.isArray(facts)) throw new Error(`${noteId} key entry has no facts array`);
    const parsed: KeyFact[] = facts.map((item, position) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`${noteId} fact ${position} is invalid`);
      }
      const fact = item as Record<string, unknown>;
      const { field, value, sourceSentenceIndex } = fact;
      if (typeof field !== 'string' || !isFactField(field)) {
        throw new Error(`${noteId} fact ${position} has an unknown field`);
      }
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${noteId} fact ${position} has an empty value`);
      }
      if (typeof sourceSentenceIndex !== 'number' || !Number.isInteger(sourceSentenceIndex)) {
        throw new Error(`${noteId} fact ${position} has a non integer sentence index`);
      }
      if (sourceSentenceIndex < 0) {
        throw new Error(`${noteId} fact ${position} has a negative sentence index`);
      }
      return { field, value, sourceSentenceIndex };
    });
    const tricky = entry.tricky;
    out[noteId] = {
      noteId,
      tricky: typeof tricky === 'string' ? tricky : null,
      facts: parsed,
    };
  }
  return out;
}

export function loadKey(path = KEY_PATH): Record<string, KeyEntry> {
  return parseKey(readJson(path));
}

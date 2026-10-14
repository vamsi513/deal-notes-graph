import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseKey, parseNote, type KeyEntry, type NoteRecord } from './datasets';

const here = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = resolve(here, '../../data');
export const NOTES_DIR = join(DATA_DIR, 'notes');
export const KEY_PATH = join(DATA_DIR, 'key.json');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Read the notes by listing data/notes/. Only scripts and tests use this: the app reads the
 * static manifest instead, so nothing in a request touches the filesystem. The test that
 * compares the two is what keeps the manifest honest.
 */
export function loadNotesFromDirectory(directory = NOTES_DIR): NoteRecord[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => parseNote(readJson(join(directory, name)), name));
}

/** Read the key from disk. Used by the same drift test. */
export function loadKeyFromFile(path = KEY_PATH): Record<string, KeyEntry> {
  return parseKey(readJson(path));
}

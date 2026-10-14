import { describe, expect, it } from 'vitest';

import { loadKey, loadNotes, parseKey, parseNote } from '../src/data/datasets';
import { loadKeyFromFile, loadNotesFromDirectory } from '../src/data/fromDisk';
import { splitSentences } from '../src/extraction/sentences';
import { FACT_FIELDS } from '../src/extraction/types';

const notes = loadNotes();
const key = loadKey();

describe('the authored dataset', () => {
  it('holds 30 notes and 30 key entries', () => {
    expect(notes).toHaveLength(30);
    expect(Object.keys(key)).toHaveLength(30);
  });

  it('keeps every note between three and ten sentences', () => {
    for (const note of notes) {
      const count = splitSentences(note.body).length;
      expect(count, note.id).toBeGreaterThanOrEqual(3);
      expect(count, note.id).toBeLessThanOrEqual(10);
    }
  });

  it('points every key fact at a sentence that exists', () => {
    for (const note of notes) {
      const sentences = splitSentences(note.body);
      for (const fact of key[note.id]?.facts ?? []) {
        expect(fact.sourceSentenceIndex, `${note.id} ${fact.field}`).toBeLessThan(sentences.length);
      }
    }
  });

  it('uses only known fact fields', () => {
    for (const entry of Object.values(key)) {
      for (const fact of entry.facts) expect(FACT_FIELDS).toContain(fact.field);
    }
  });

  it('marks roughly a quarter of the notes as tricky, covering all four cases', () => {
    const tricky = Object.values(key).filter((entry) => entry.tricky !== null);
    expect(tricky.length).toBeGreaterThanOrEqual(7);
    expect(tricky.length).toBeLessThanOrEqual(10);
    expect(new Set(tricky.map((entry) => entry.tricky))).toEqual(
      new Set(['amount change', 'stage reversed', 'next step negated', 'two contacts']),
    );
  });

  it('contains no digit sequence that could read as a phone number', () => {
    const pattern = /(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/;
    for (const note of notes) {
      expect(pattern.test(note.body), note.id).toBe(false);
    }
  });

  it('uses only reserved example domains in any email address', () => {
    for (const note of notes) {
      for (const match of note.body.matchAll(/[a-z0-9._-]+@([a-z0-9.-]+)/gi)) {
        expect(match[1], note.id).toMatch(/\.example$/);
      }
    }
  });
});

describe('the static manifest', () => {
  it('matches the contents of data/notes exactly', () => {
    expect(loadNotes()).toEqual(loadNotesFromDirectory());
  });

  it('matches data/key.json exactly', () => {
    expect(loadKey()).toEqual(loadKeyFromFile());
  });
});

describe('loader validation', () => {
  it('rejects a note with an unknown source', () => {
    expect(() =>
      parseNote({ id: 'x', source: 'FAX', subject: 's', receivedAt: '2026-01-01', body: 'b' }),
    ).toThrow(/unknown source/);
  });

  it('rejects a note with an empty body', () => {
    expect(() =>
      parseNote({ id: 'x', source: 'EMAIL', subject: 's', receivedAt: '2026-01-01', body: '  ' }),
    ).toThrow(/empty body/);
  });

  it('rejects a note with an unparseable date', () => {
    expect(() =>
      parseNote({ id: 'x', source: 'EMAIL', subject: 's', receivedAt: 'never', body: 'b' }),
    ).toThrow(/receivedAt/);
  });

  it('rejects a key fact with an unknown field', () => {
    expect(() =>
      parseKey({ n01: { facts: [{ field: 'MOOD', value: 'good', sourceSentenceIndex: 0 }] } }),
    ).toThrow(/unknown field/);
  });

  it('rejects a key fact with a negative sentence index', () => {
    expect(() =>
      parseKey({
        n01: { facts: [{ field: 'STAGE', value: 'DISCOVERY', sourceSentenceIndex: -1 }] },
      }),
    ).toThrow(/negative sentence index/);
  });
});

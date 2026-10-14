import { loadNotes } from '../src/data/datasets';
import { buildIngestPayload } from '../src/db/memory';
import { PostgresRepository } from '../src/db/postgres';

/**
 * Create the tables and load the 30 authored notes, running the deterministic extractor over
 * each one. Safe to run again: every write is an upsert.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set, so there is no database to seed');
  }
  const repository = PostgresRepository.fromUrl(url);
  try {
    await repository.migrate();
    const notes = loadNotes();
    for (const record of notes) {
      await repository.ingest(await buildIngestPayload(record));
    }
    console.log(
      JSON.stringify({
        message: 'seeded',
        notes: notes.length,
        storedNotes: await repository.countNotes(),
        deals: (await repository.listDeals(null)).length,
      }),
    );
  } finally {
    await repository.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

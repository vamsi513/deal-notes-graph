# deal-notes-graph

A small web app that reads synthetic customer emails and meeting notes, pulls out structured CRM
facts, and shows every fact next to the sentence it came from. It is a prototype and a
reliability study, **not a production CRM**. Nothing here has been used with real customer data,
there is no multi tenancy, no authentication and no access control, and it should not be pointed
at a real pipeline.

The question it exists to answer is a narrow one: if a tool is going to put a deal stage or a
dollar figure into a record, can it show you the exact sentence that figure came from, and can
you measure how often it is right? So every extracted fact carries a sentence index and a
verbatim quote, a grounding check rejects any fact whose quote is not actually in the note, and
an evaluation script scores the extractor against an answer key written by hand.

## Stack

| Piece      | Choice                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------- |
| Front end  | Next.js 16 App Router, React 19, TypeScript strict                                           |
| API        | Apollo Server 5 over GraphQL, on Node.js                                                     |
| Database   | PostgreSQL 18                                                                                |
| Extraction | One module, a pluggable extractor interface, a deterministic rule based extractor by default |
| Tests      | Vitest, 136 tests, no network and no API key                                                 |
| Local run  | Docker Compose for PostgreSQL and the API                                                    |

## How to run

A clean clone needs nothing but Node 22.12 or newer:

```bash
npm install && npm test
```

For the web app, which falls back to an in memory store when no database is configured:

```bash
npm run dev
```

Then open http://localhost:3000 for the note list, a note for the fact by fact view, and
http://localhost:3000/deals for the board.

For the full stack with PostgreSQL and the standalone GraphQL API, one command:

```bash
docker compose up
```

The API creates its tables and loads the 30 authored notes on first start. GraphQL is at
http://localhost:4000/graphql, with http://localhost:4000/health and
http://localhost:4000/metrics beside it. To point the web app at that API rather than its own
in process one, set `GRAPHQL_URL=http://localhost:4000/graphql` before `npm run dev`.

Other scripts: `npm run evaluate` scores the extractor and writes
[results/RESULTS.md](results/RESULTS.md), `npm run seed` loads the notes into a database given a
`DATABASE_URL`, `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm run build`.

### Where the data lives

With `DATABASE_URL` set, everything reads and writes PostgreSQL. Without it, the app seeds an in
memory repository from `data/` at startup. That is why a clean clone runs and why the test suite
needs no database. Both paths go through the same `Repository` interface and the same resolvers.

## GraphQL

The schema covers `Contact`, `Company`, `Deal`, `Note` and `Fact`, with queries `notes`,
`note(id)`, `facts(noteId)` and `deals(stage)`, and a mutation that stores a note and runs
extraction over it.

Every fact carries `sourceSentenceIndex`, the `sourceSentence` itself and the `quotedText` it was
read from, so a client can show the evidence without a second round trip:

```graphql
{
  note(id: "n01") {
    subject
    sentences
    facts {
      field
      value
      sourceSentenceIndex
      sourceSentence
      quotedText
      grounded
      groundingReason
    }
  }
}
```

Deals by stage, resolved through to the company and its contacts:

```graphql
{
  deals(stage: CLOSED_WON) {
    id
    stage
    amount {
      cents
      currency
      formatted
    }
    company {
      name
      contacts {
        name
      }
    }
  }
}
```

Ingesting a note runs the extractor and returns what it found:

```graphql
mutation {
  ingestNote(
    input: {
      source: EMAIL
      subject: "Kestrel quote"
      body: "Call with Petra Walsh at Kestrel Works went well. They are in negotiation at $44,000. We will send the redline on Monday."
    }
  ) {
    note {
      id
    }
    facts {
      field
      value
      sourceSentenceIndex
    }
    ungroundedCount
    extractionMs
    extractor
  }
}
```

### DataLoader

Every read a resolver can be asked for repeatedly goes through a DataLoader, created fresh per
request in `src/graphql/loaders.ts`, and every repository read takes a list of ids rather than
one. The PostgreSQL implementation turns each batch into a single `= ANY($1)` query. So a query
that walks 30 notes to their facts issues one facts read, not 30, and a query that walks every
deal to its company and that company's contacts issues one read per level. The list query also
primes the note loader with the rows it already has, so nothing it returned is fetched again.

This is not a claim, it is a test. `tests/dataloader.test.ts` counts how many times each batch
read is called and asserts the count is exactly one, using a repository that records its own
calls.

## Extraction

`src/extraction/` holds one module behind a small interface:

```ts
interface Extractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
```

**The rule based extractor is the default.** It needs no API key, it is what the tests, the
continuous integration workflow and the measured results all use, and it never touches a
network. It works on five fields:

- **contact**: a two word capitalised name that sits next to a cue word such as "with", "from",
  "confirmed" or "replied", plus names recovered from a work email address. A name that ends in
  a company suffix is excluded, so "Harbor Lane Logistics" never becomes a person.
- **company**: a capitalised name ending in one of a list of company suffixes.
- **stage**: a keyword map onto the seven stages. An explicit statement such as "they are in
  discovery" beats an incidental mention such as "send the revised quote", and among matches of
  the same kind the last one wins, which is what makes a reversal come out right.
- **amount**: currency patterns including `$32,000`, `$12.5k` and `27,500 USD`, normalised to a
  canonical `32000.00 USD`. The last amount that is not negated wins, which is what makes a
  changed figure come out right.
- **next step**: the clause after a cue such as "we will", "next steps" or "follow up".

Negation is scoped to the clause. A negated modal such as "will not" negates its whole clause; a
plain "no" negates only what follows it. A comma between two digits is a thousands separator, not
a clause boundary, so `$40,000` stays whole.

**The model based extractor is optional and off.** It is selected only when
`DEAL_NOTES_LLM_EXTRACTOR` is exactly `on`, it is not in the default path, and it throws before
opening a socket unless its URL, model and key are all set in the environment. No credential is
stored in this repository, the key never reaches the prompt, and the logger redacts any field
whose name looks like a credential. **It was not run, and it is not part of any number in this
README.** If you switch it on, the numbers below no longer describe what you are running.

### Grounding check

Borrowed in spirit from a note grounding study I wrote earlier, reimplemented here for CRM
fields rather than clinical sentences. For each fact: the sentence index must be inside the note,
the quoted text must appear verbatim in that sentence, an amount must reparse from its quote to
the same canonical value, and a stage must be the stage its quote actually names. A fact that
fails is still shown in the interface, flagged, with the reason, and it is never promoted into a
deal. The note page renders ungrounded facts in red beside an unhighlighted sentence.

## The answer key and how it was authored

The 30 notes in `data/notes/` and the key in `data/key.json` are entirely synthetic and
**written by hand by me. None of it was produced by a model.** Every person and company is
invented, every email address uses the reserved `.example` domain, and there are no phone
numbers, identifiers or real records anywhere. A test asserts all three of those properties.

How I authored it:

- 30 notes of 3 to 6 sentences each, split between emails and meeting notes, in the clipped way
  sales notes actually get written.
- For every note I then recorded, by hand, the facts a careful reader would take from it and the
  sentence index each one is stated in. That record is `data/key.json`, and it holds 143 facts.
- 9 of the 30 notes carry a deliberately tricky case, chosen so the easy version of each rule
  would get them wrong: an amount that changes part way through the note (2), a stage that is
  reversed (2), a next step that is negated (2), and two contacts in one note (3).

I wrote the rules before measuring, and **I deliberately did not patch the lexicon after seeing
the failures below**, so these numbers are not tuned against the key they are scored on. The two
misses are left in and written up.

## Measured results

Copied from [results/RESULTS.md](results/RESULTS.md), which `npm run evaluate` regenerates and
continuous integration checks is still current. The deterministic extractor over all 30 notes,
scored against the key.

| Field          | Precision | Recall | F1    | Correct | Wrong | Missed |
| -------------- | --------- | ------ | ----- | ------- | ----- | ------ |
| contact        | 1.000     | 0.970  | 0.985 | 32      | 0     | 1      |
| company        | 1.000     | 1.000  | 1.000 | 30      | 0     | 0      |
| stage          | 0.967     | 0.967  | 0.967 | 29      | 1     | 1      |
| amount         | 1.000     | 1.000  | 1.000 | 22      | 0     | 0      |
| next step      | 1.000     | 1.000  | 1.000 | 28      | 0     | 0      |
| **all fields** | 0.993     | 0.986  | 0.989 | 141     | 1     | 2      |

143 facts in the key, 142 produced, 0 rejected by the grounding check. Of the 113 value matched
facts it got right, 113 also cite the same sentence the key records.

Contact, company, stage and amount are scored on the canonical value. A next step is scored on
whether the extractor picked the sentence that states it: grading a free text span against one
particular phrasing would measure wording rather than extraction, so that is stated here rather
than hidden in an average.

All three failures, in full:

| Kind   | Note | Field   | Detail                     |
| ------ | ---- | ------- | -------------------------- |
| missed | n09  | contact | Javier Sotelo (sentence 0) |
| wrong  | n20  | stage   | DISCOVERY (sentence 3)     |
| missed | n20  | stage   | PROSPECT (sentence 0)      |

## Observability

Every request is logged as one JSON object per line carrying a request id, which is taken from an
inbound `x-request-id` header when there is one and generated otherwise, and returned on the
response. The same id appears on the request line and on the work done inside it, so an ingest
can be traced to the request that caused it:

```json
{"level":"info","message":"note ingested","requestId":"be4be6a2","timestamp":"2026-10-14T16:17:31.003Z","noteId":"compose-check","extractor":"rule-based","factCount":5,"ungroundedCount":0,"extractionMs":0.239}
{"level":"info","message":"request complete","requestId":"be4be6a2","timestamp":"2026-10-14T16:17:31.003Z","route":"POST /graphql","status":200,"durationMs":8.999}
```

`GET /metrics` on the API, or `/api/metrics` on the web app, returns counts and extraction
latency:

```json
{
  "uptimeSeconds": 12,
  "requests": { "GET /health": 1, "GET /metrics": 1, "POST /graphql": 3 },
  "graphqlOperations": { "deals": 1, "ingestNote": 1, "note": 1, "noteCount": 1 },
  "errors": 0,
  "extraction": {
    "count": 1,
    "totalMs": 0.239,
    "meanMs": 0.239,
    "p50Ms": 0.239,
    "p95Ms": 0.239,
    "maxMs": 0.239
  }
}
```

How to read it: `requests` counts by method and path, `graphqlOperations` counts by resolver
entry point so you can see which query is being used, `errors` counts requests that threw, and
`extraction` summarises how long extraction took in milliseconds over the last thousand runs.
Everything is in process and resets when the process restarts; there is no metrics backend and
no aggregation across replicas.

## Deploying

The web app and the GraphQL route are one Next.js application, so it deploys to Vercel as is,
with `DATABASE_URL` pointing at a PostgreSQL instance. Every page and route is dynamic, so a
build needs no database. **It has not been deployed.** Docker Compose exists for local use, not
as a production topology.

## Limitations

- **The data is synthetic and I wrote it.** Real sales notes are longer, messier, full of
  forwarded threads and half sentences, and the people in them do not introduce themselves in
  the cue patterns these rules look for. An author who writes both the notes and the rules will
  write notes the rules handle well, however carefully they try not to.
- **30 notes and 143 facts is a small sample.** One contact is worth 0.03 of contact recall on
  its own. These figures carry wide uncertainty and should not be read as a general accuracy
  estimate for anything.
- **The rule based extractor misses paraphrase.** It matches surface patterns, so a note that
  says "they want to see numbers before committing" states a stage no rule will find, and a
  company written without a recognisable suffix is not detected at all. The two failures below
  are the mild version of this; the severe version is a note phrased unlike any of my 30.
- **The missed contact (n09).** "Javier Sotelo emailed about the renewal." The name is followed
  by "emailed", which is in the list of cue words that may precede a name but not in the list
  that may follow one. A one word omission in a hand written lexicon, left in place on purpose
  rather than patched after seeing the score.
- **The wrong stage (n20).** The note opens "Delphine Aubert from Bellmont Ventures is a new
  prospect" and closes "We will set up a discovery call next week". The rule treats "is a new
  prospect" as incidental because of the word "new" sitting between the cue and the keyword, then
  takes "discovery call" as the later mention. The right answer is prospect. Fixing this properly
  means parsing the sentence, not lengthening a cue list.
- **A next step is scored on its sentence, not its wording.** That is a real weakening of the
  next step column and it is why that column is 1.000. It says the extractor found the right
  sentence every time, not that the phrase it pulled out is the phrase you would have written.
- **One deal per note.** Deals are derived per note rather than tracked over time, so the board
  shows the state each note implies on its own. A real pipeline would merge notes per company
  and keep history.
- **No authentication, no access control, no multi tenancy, no rate limiting.** The API is open
  and the data is public sample data. It is not a product.
- **Not a production CRM.** No claim is made about scale, users, throughput or fitness for any
  real use. The metrics are in process counters from a single machine, not evidence about load.

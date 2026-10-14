import { MAX_BODY_BYTES, MAX_QUERY_DEPTH, MAX_SELECTIONS } from '@/src/graphql/limits';
import { typeDefs } from '@/src/graphql/schema';
import { QueryPanel, type Example } from './QueryPanel';

export const dynamic = 'force-dynamic';

const EXAMPLES: Example[] = [
  {
    name: 'A note and its facts',
    description:
      'Every fact carries the sentence it was read from and the span it was quoted from, so a client can show the evidence without a second request.',
    query: `query Note($id: ID!) {
  note(id: $id) {
    subject
    sentences
    facts {
      field
      value
      sourceSentenceIndex
      sourceSentence
      quotedText
      grounded
    }
  }
}`,
    variables: `{ "id": "n01" }`,
  },
  {
    name: 'Deals by stage',
    description:
      'Walks each deal through to its company and that company’s contacts. Every level is one batched read, not one read per row.',
    query: `{
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
}`,
  },
  {
    name: 'A tricky note',
    description:
      'n07 states one figure and then changes it. The extractor takes the later one, and the quoted span shows which sentence it came from.',
    query: `{
  note(id: "n07") {
    subject
    sentences
    facts {
      field
      value
      sourceSentenceIndex
      quotedText
    }
  }
}`,
  },
  {
    name: 'Ingest a note',
    description:
      'Runs extraction over text you supply and returns what it found. In this demo nothing is stored: the result is returned to you and dropped.',
    query: `mutation Ingest($input: IngestNoteInput!) {
  ingestNote(input: $input) {
    facts {
      field
      value
      sourceSentenceIndex
      quotedText
      grounded
    }
    ungroundedCount
    extractionMs
    extractor
  }
}`,
    variables: `{
  "input": {
    "source": "EMAIL",
    "subject": "Your own note",
    "body": "Call with Petra Walsh at Kestrel Works went well. They are in negotiation at $44,000. We will send the redline on Monday."
  }
}`,
  },
  {
    name: 'Rejected: too deep',
    description: `Nesting past ${MAX_QUERY_DEPTH} levels is refused by a validation rule, because the endpoint is public.`,
    query: `{
  deals {
    company {
      deals {
        company {
          deals {
            company {
              deals {
                company {
                  name
                }
              }
            }
          }
        }
      }
    }
  }
}`,
  },
];

export default function PlaygroundPage() {
  return (
    <>
      <h2>The schema is real</h2>
      <p className="notice">
        This panel posts to the same <code>/api/graphql</code> endpoint the pages use. Because it is
        a public endpoint it has ceilings: queries may nest {MAX_QUERY_DEPTH} levels, select{' '}
        {MAX_SELECTIONS} fields and carry {MAX_BODY_BYTES / 1024} KB of body, and anything past that
        is refused. Nothing you type is stored and no note text is written to a log.
      </p>

      <QueryPanel examples={EXAMPLES} />

      <h3>Schema</h3>
      <p className="meta">The full SDL this endpoint serves.</p>
      <pre className="result sdl">{typeDefs.trim()}</pre>
    </>
  );
}

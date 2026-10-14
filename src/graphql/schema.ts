export const typeDefs = /* GraphQL */ `
  "Where a note came from."
  enum NoteSource {
    EMAIL
    MEETING
  }

  enum DealStage {
    PROSPECT
    DISCOVERY
    QUALIFIED
    PROPOSAL
    NEGOTIATION
    CLOSED_WON
    CLOSED_LOST
  }

  enum FactField {
    CONTACT
    COMPANY
    STAGE
    AMOUNT
    NEXT_STEP
  }

  type Money {
    cents: Int!
    currency: String!
    "Rendered for display, for example 32,000.00 USD."
    formatted: String!
  }

  type Company {
    id: ID!
    name: String!
    contacts: [Contact!]!
    deals: [Deal!]!
  }

  type Contact {
    id: ID!
    name: String!
    email: String
    company: Company
  }

  type Deal {
    id: ID!
    stage: DealStage!
    amount: Money
    nextStep: String
    company: Company
    note: Note
  }

  "One extracted fact, always carrying the sentence it was read from."
  type Fact {
    id: ID!
    noteId: ID!
    field: FactField!
    value: String!
    sourceSentenceIndex: Int!
    "The source sentence itself, so a reader can check the fact without a second query."
    sourceSentence: String!
    "The span of the source sentence the value was read from, quoted verbatim."
    quotedText: String!
    "False when the quoted text is not actually in the note, or when a value and its quote disagree."
    grounded: Boolean!
    groundingReason: String!
  }

  type Note {
    id: ID!
    source: NoteSource!
    subject: String!
    receivedAt: String!
    body: String!
    sentences: [String!]!
    facts: [Fact!]!
    deal: Deal
    ungroundedFactCount: Int!
  }

  input IngestNoteInput {
    "Optional. One is generated when it is left out."
    id: ID
    source: NoteSource!
    subject: String!
    body: String!
    receivedAt: String
  }

  type IngestNoteResult {
    note: Note!
    facts: [Fact!]!
    ungroundedCount: Int!
    "Wall clock milliseconds the extraction took, also recorded by the metrics endpoint."
    extractionMs: Float!
    "Which extractor ran. The deterministic one unless the optional extractor was switched on."
    extractor: String!
  }

  type Query {
    notes(limit: Int = 30, offset: Int = 0): [Note!]!
    note(id: ID!): Note
    facts(noteId: ID!): [Fact!]!
    deals(stage: DealStage): [Deal!]!
    noteCount: Int!
  }

  type Mutation {
    "Store a note and run extraction over it."
    ingestNote(input: IngestNoteInput!): IngestNoteResult!
  }
`;

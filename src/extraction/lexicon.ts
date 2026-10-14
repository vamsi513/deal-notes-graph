import type { DealStage } from './types';

/** Stage cues, most specific first. Within a sentence the last match wins. */
export const STAGE_PATTERNS: ReadonlyArray<{ stage: DealStage; pattern: RegExp }> = [
  {
    stage: 'CLOSED_WON',
    pattern:
      /\b(closed won|signed the contract|contract is signed|signed and returned|we won it|deal is won)\b/gi,
  },
  {
    stage: 'CLOSED_LOST',
    pattern:
      /\b(closed lost|we lost it|deal is lost|went with another vendor|chose another vendor)\b/gi,
  },
  { stage: 'NEGOTIATION', pattern: /\b(negotiation|negotiating|redlines|contract review)\b/gi },
  { stage: 'PROPOSAL', pattern: /\b(proposal|quote|pricing sheet|statement of work)\b/gi },
  { stage: 'QUALIFIED', pattern: /\b(qualified|qualification)\b/gi },
  { stage: 'DISCOVERY', pattern: /\b(discovery)\b/gi },
  { stage: 'PROSPECT', pattern: /\b(prospect|prospecting|first touch|cold outreach)\b/gi },
];

/** Suffixes that mark the end of a company name. */
export const COMPANY_SUFFIXES = [
  'Analytics',
  'Collective',
  'Dynamics',
  'Energy',
  'Foods',
  'Freight',
  'Group',
  'Health',
  'Holdings',
  'Industries',
  'Instruments',
  'Labs',
  'Logistics',
  'Media',
  'Mills',
  'Networks',
  'Partners',
  'Robotics',
  'Studios',
  'Supply',
  'Systems',
  'Technologies',
  'Ventures',
  'Works',
] as const;

/** Words that may look like a surname but never start or end a person name here. */
export const NAME_STOPWORDS = new Set(
  [
    ...COMPANY_SUFFIXES,
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    'Discovery',
    'Proposal',
    'Negotiation',
    'Qualified',
    'Prospect',
    'Closed',
    'Next',
    'Thanks',
    'Regards',
    'Hi',
    'Hello',
    'Dear',
    'We',
    'They',
    'Our',
    'The',
    'This',
    'That',
    'There',
    'It',
    'He',
    'She',
    'I',
    'You',
    'Their',
    'His',
    'Her',
    'After',
    'Before',
    'During',
    'Once',
    'When',
    'While',
    'Subject',
    'Meeting',
    'Notes',
    'Call',
    'Email',
    'Action',
    'Legal',
    'Finance',
    'Procurement',
    'Security',
  ].map((word) => word),
);

/** A person name is accepted when one of these sits immediately before it. */
export const CONTACT_LEAD_CUES =
  /\b(?:from|with|to|met|spoke|call|email|emailed|reply|replied|thanks|regards|cc|contact|introduced|intro|looped|per|asked|told|and)\s+(?:in\s+|by\s+)?$/i;

/** Or when one of these sits immediately after it. */
export const CONTACT_TRAIL_CUES =
  /^\s*(?:at|from|said|says|asked|confirmed|wants|wanted|will|is|was|mentioned|replied|forwarded|owns|runs|leads|handles|joined|and|,)\b/i;

/** Cues that introduce a next step. */
export const NEXT_STEP_CUES =
  /\b(next steps?|action item|we will|i will|we'll|i'll|plan to|planning to|going to|scheduled to|schedule|send over|send|follow up|circle back|set up|book)\b/i;

/** A negated modal anywhere in the clause negates the whole clause. */
export const NEGATED_MODALS =
  /\b(will not|won't|would not|wouldn't|do not|don't|does not|doesn't|did not|didn't|cannot|can't|is not|isn't|are not|aren't|was not|wasn't|no longer|not going to|not yet)\b/i;

/** A plain negation token negates only what follows it in the clause. */
export const NEGATION_TOKENS =
  /\b(no|not|none|never|nothing|neither|nor|without|hold off|holding off|on hold|paused)\b/gi;

/**
 * A stage mention that sits right after one of these is an explicit statement of the stage,
 * as in "they are in discovery" or "we moved back to discovery". A mention without one is
 * incidental, as in "send the revised quote", and only used when nothing explicit is found.
 */
export const STAGE_STATEMENT_CUES =
  /\b(?:in|into|at|to|is|are|now|stage|entering|entered|reached|moved|back)\s+(?:the\s+|a\s+|an\s+)?$/i;

export const REVERSAL_CUES =
  /\b(back to|back into|reverted to|returned to|moved back|dropped back|rolled back)\b/i;

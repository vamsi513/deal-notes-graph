# Measured results

Produced by `npm run evaluate`. The deterministic rule based extractor was run over all 30 notes in `data/notes/` and scored against the hand authored key in `data/key.json`. The optional model extractor was not run and is not part of these numbers.

## Dataset

| Quantity | Count |
| --- | --- |
| notes | 30 |
| facts in the key | 143 |
| notes with a tricky case | 9 |
| facts the extractor produced | 142 |
| facts the grounding check rejected | 0 |

## Per field results

Contact, company, stage and amount are scored on the canonical value. A next step is scored on whether the extractor picked the sentence that states it, because grading a free text span against one phrasing would measure wording rather than extraction.

| Field | Precision | Recall | F1 | Correct | Wrong | Missed |
| --- | --- | --- | --- | --- | --- | --- |
| contact | 1.000 | 0.970 | 0.985 | 32 | 0 | 1 |
| company | 1.000 | 1.000 | 1.000 | 30 | 0 | 0 |
| stage | 0.967 | 0.967 | 0.967 | 29 | 1 | 1 |
| amount | 1.000 | 1.000 | 1.000 | 22 | 0 | 0 |
| next step | 1.000 | 1.000 | 1.000 | 28 | 0 | 0 |
| **all fields** | 0.993 | 0.986 | 0.989 | 141 | 1 | 2 |

## Source sentence

Of the 113 value matched facts the extractor got right, 113 also cite the same sentence the key records, a rate of 1.000.

## Every failure

| Kind | Note | Field | Detail |
| --- | --- | --- | --- |
| missed | n09 | contact | Javier Sotelo (sentence 0) |
| wrong | n20 | stage | DISCOVERY (sentence 3) |
| missed | n20 | stage | PROSPECT (sentence 0) |

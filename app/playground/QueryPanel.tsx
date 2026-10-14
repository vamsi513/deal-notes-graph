'use client';

import { useState } from 'react';

export interface Example {
  name: string;
  description: string;
  query: string;
  variables?: string;
}

/**
 * A small panel that posts to the real endpoint and prints what comes back.
 *
 * It is deliberately plain: no external script, no embedded third party sandbox, nothing
 * loaded from a CDN. Whatever a visitor types goes to /api/graphql and the answer is rendered
 * here. Nothing is stored and nothing is logged.
 */
export function QueryPanel({ examples }: { examples: Example[] }) {
  const first = examples[0];
  const [text, setText] = useState(first?.query ?? '');
  const [variables, setVariables] = useState(first?.variables ?? '');
  const [result, setResult] = useState('Press Run to send this query to the endpoint.');
  const [running, setRunning] = useState(false);

  async function run(): Promise<void> {
    setRunning(true);
    setResult('Running…');
    try {
      const parsedVariables: unknown = variables.trim() === '' ? {} : JSON.parse(variables);
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: text, variables: parsedVariables }),
      });
      const payload: unknown = await response.json();
      setResult(`HTTP ${response.status}\n\n${JSON.stringify(payload, null, 2)}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'the request failed');
    } finally {
      setRunning(false);
    }
  }

  function load(example: Example): void {
    setText(example.query);
    setVariables(example.variables ?? '');
    setResult(`Loaded "${example.name}". Press Run to send it.`);
  }

  return (
    <div className="panel">
      <div className="examples">
        {examples.map((example) => (
          <button key={example.name} type="button" onClick={() => load(example)}>
            {example.name}
          </button>
        ))}
      </div>
      <p className="meta">
        {examples.find((example) => example.query === text)?.description ?? ''}
      </p>

      <label htmlFor="query">Query</label>
      <textarea
        id="query"
        value={text}
        rows={12}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
      />

      <label htmlFor="variables">Variables, as JSON</label>
      <textarea
        id="variables"
        value={variables}
        rows={3}
        spellCheck={false}
        onChange={(event) => setVariables(event.target.value)}
      />

      <div className="actions">
        <button type="button" className="primary" onClick={() => void run()} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </button>
        <span className="meta">
          Posts to <code>/api/graphql</code>. Nothing you type is stored.
        </span>
      </div>

      <label htmlFor="result">Response</label>
      <pre id="result" className="result" aria-live="polite">
        {result}
      </pre>
    </div>
  );
}

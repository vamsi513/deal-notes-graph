/** Dates are rendered in a fixed locale so the server and the browser agree. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function sourceLabel(source: string): string {
  return source === 'EMAIL' ? 'Email' : 'Meeting note';
}

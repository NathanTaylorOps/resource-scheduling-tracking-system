import { NextResponse } from 'next/server';
import { RequestError } from './validate';

/**
 * The one place a route's thrown error becomes an HTTP response. A
 * RequestError (validation, not-found, conflict — see lib/validate.ts)
 * carries a message written for the person at the form and the status it
 * belongs with. Anything else is a bug or an infrastructure failure: it's
 * logged with its full detail on the server and answered with a generic
 * message, so a Prisma or filesystem error never reaches a browser.
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof RequestError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('Unhandled API error:', err);
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
}

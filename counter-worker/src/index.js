// Visitor counter for derekbartlett.com — a Cloudflare Worker backed by one
// Durable Object that stores a single number. No cookies, no IPs, no visitor
// data: POST /count adds one and returns the total, GET /count just reads it.
import { DurableObject } from 'cloudflare:workers';

// Page loads from these origins add to the count
const ALLOWED_ORIGINS = [
  'https://derekbartlett.com',
  'https://www.derekbartlett.com',
];
// Local previews may read the count but never add to it
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export class Counter extends DurableObject {
  // Durable Objects run one request at a time, so read-then-write is safe
  async hit(increment) {
    let count = (await this.ctx.storage.get('count')) || 0;
    if (increment) {
      count++;
      await this.ctx.storage.put('count', count);
    }
    return count;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const headers = {
      'Access-Control-Allow-Origin': allowed || LOCAL_ORIGIN.test(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname !== '/count') return new Response('Not found', { status: 404, headers });
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers });
    }

    // Only page loads from the real site count; anything else just reads
    const increment = request.method === 'POST' && allowed;
    const stub = env.COUNTER.get(env.COUNTER.idFromName('derekbartlett.com'));
    const count = await stub.hit(increment);
    return Response.json({ count }, { headers });
  },
};

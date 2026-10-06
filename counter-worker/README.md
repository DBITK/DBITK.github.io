# Visitor counter

The "You are visitor #000050!" odometer on derekbartlett.com. It's a Cloudflare
Worker with one Durable Object holding one number. It stores no cookies, no IP
addresses, and no visitor data.

- `POST /count` adds one (only for requests from derekbartlett.com) and returns
  `{ "count": n }`.
- `GET /count` returns the current total without adding.

## Deploy

```bash
cd counter-worker
npx wrangler login     # opens a browser to approve access to your Cloudflare account
npx wrangler deploy    # prints the Worker URL: https://derekbartlett-visitor-counter.derekbartlett.workers.dev
```

Put that URL plus `/count` into `COUNTER_URL` in `index.html`, then commit and push.

## Notes

- The page counts once per browser tab (`sessionStorage`), so refreshes don't add up.
- Local previews (localhost) only read the count; they never add to it.
- To stop your own visits counting, open `https://derekbartlett.com/?nocount` once in
  each browser you use. That sets `localStorage['visitorCounterSkip']`.
- Set or reset the total from the Cloudflare dashboard, or by redeploying with a
  migration. It's one key, `count`, in the Durable Object's storage.

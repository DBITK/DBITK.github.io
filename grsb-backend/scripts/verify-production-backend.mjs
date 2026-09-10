const baseUrl = (process.env.GRSB_SITE_URL || '').replace(/\/+$/, '');
const token = process.env.GRSB_ADMIN_TOKEN || '';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!baseUrl) fail('Set GRSB_SITE_URL to the deployed site URL.');
if (!token) fail('Set GRSB_ADMIN_TOKEN to the admin save token.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Accept': 'application/json'
    }
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${path} returned non-JSON response with status ${res.status}.`);
  }
  return { res, body };
}

async function putSite(site) {
  return requestJson('/api/content/site', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(site)
  });
}

const { res: healthRes, body: health } = await requestJson('/api/health');
assert(healthRes.ok, `/api/health returned ${healthRes.status}.`);
assert(health.ok === true, '/api/health did not report ok: true.');
assert(health.adminApiEnabled === true, '/api/health says admin API is not enabled.');
assert(health.persistence && health.persistence !== 'static', '/api/health says persistence is still static.');

const { res: siteRes, body: originalSite } = await requestJson('/api/content/site');
assert(siteRes.ok, `/api/content/site returned ${siteRes.status}.`);
assert(originalSite.announcement && originalSite.announcement.eyebrow, 'site.json is missing announcement.eyebrow.');

const originalEyebrow = originalSite.announcement.eyebrow;
const marker = `[backend-check ${new Date().toISOString()}]`;
const testSite = structuredClone(originalSite);
testSite.announcement.eyebrow = `${originalEyebrow} ${marker}`;

let restoreNeeded = false;

try {
  const { res: putRes, body: putBody } = await putSite(testSite);
  assert(putRes.ok, `PUT /api/content/site returned ${putRes.status}: ${putBody.error || 'unknown error'}`);
  restoreNeeded = true;

  const { res: verifyRes, body: verifySite } = await requestJson('/api/content/site');
  assert(verifyRes.ok, `Verification GET returned ${verifyRes.status}.`);
  assert(
    verifySite.announcement && verifySite.announcement.eyebrow === testSite.announcement.eyebrow,
    'Saved value was not returned by a follow-up GET.'
  );

  const { res: restoreRes, body: restoreBody } = await putSite(originalSite);
  restoreNeeded = false;
  assert(restoreRes.ok, `Restore PUT returned ${restoreRes.status}: ${restoreBody.error || 'unknown error'}`);

  const { body: restoredSite } = await requestJson('/api/content/site');
  assert(
    restoredSite.announcement && restoredSite.announcement.eyebrow === originalEyebrow,
    'Original value was not restored.'
  );

  console.log(`Production backend verified for ${baseUrl}.`);
  console.log(`Persistence: ${health.persistence}; backend: ${health.backend || 'unknown'}.`);
} catch (err) {
  if (restoreNeeded) {
    try {
      await putSite(originalSite);
      console.error('Restored original site.json after verification failure.');
    } catch (restoreErr) {
      console.error(`Restore failed: ${restoreErr.message}`);
    }
  }
  throw err;
}

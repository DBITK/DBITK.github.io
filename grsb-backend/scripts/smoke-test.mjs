import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const port = 8094;
const token = 'smoke-test-token';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyStaticWorker() {
  await import(`../build-static.mjs?smoke=${Date.now()}`);
  const mod = await import(`../dist/server/index.js?smoke=${Date.now()}`);
  const checks = [
    ['/', 'Website Remodel Proposal'],
    ['/proposal.html', 'Functional remodel scope'],
    ['/admin/editor.html', 'Checking backend save support'],
    ['/admin/editor.js', 'Save API is not available'],
    ['/content/site.json', 'ticketUrl']
  ];

  for (const [route, expected] of checks) {
    const res = await mod.default.fetch(new Request(`https://example.test${route}`));
    const body = await res.text();
    assert(res.status === 200, `Expected 200 for ${route}, got ${res.status}`);
    assert(body.includes(expected), `Missing "${expected}" in ${route}`);
  }

  const api = await mod.default.fetch(new Request('https://example.test/api/content/site'));
  assert(api.status === 404, `Static proposal should not expose write API, got ${api.status}`);

  await verifyWorkerGithubBackend(mod.default);
}

function encodeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function decodeBase64(value) {
  return Buffer.from(value, 'base64').toString('utf8');
}

async function verifyWorkerGithubBackend(worker) {
  const originalFetch = globalThis.fetch;
  const env = {
    GRSB_ADMIN_TOKEN: token,
    GRSB_GITHUB_TOKEN: 'github-test-token',
    GRSB_GITHUB_REPO: 'example/grsb-site',
    GRSB_GITHUB_BRANCH: 'main',
    GRSB_GITHUB_CONTENT_PREFIX: '/content/'
  };
  const originalSite = JSON.parse(await readFile(path.join(root, 'content', 'site.json'), 'utf8'));
  const githubRecord = {
    sha: 'site-sha',
    content: encodeBase64(JSON.stringify(originalSite, null, 2) + '\n')
  };
  let putPayload = null;

  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert(parsed.hostname === 'api.github.com', 'Worker backend should call the GitHub API');
    assert(parsed.pathname === '/repos/example/grsb-site/contents/content/site.json', `Unexpected GitHub path: ${parsed.pathname}`);
    assert(options.headers.Authorization === 'Bearer github-test-token', 'GitHub token header was not sent');

    if ((options.method || 'GET') === 'GET') {
      return new Response(JSON.stringify(githubRecord), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (options.method === 'PUT') {
      putPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({ content: { path: 'content/site.json' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  };

  try {
    const health = await worker.fetch(new Request('https://example.test/api/health'), env);
    const healthJson = await health.json();
    assert(healthJson.persistence === 'github', 'Worker health should report GitHub persistence when configured');
    assert(healthJson.adminApiEnabled === true, 'Worker health should report admin API enabled when token is configured');

    const getRes = await worker.fetch(new Request('https://example.test/api/content/site'), env);
    const getJson = await getRes.json();
    assert(getJson.announcement.title === originalSite.announcement.title, 'Worker GitHub GET returned unexpected content');

    const unauthorized = await worker.fetch(new Request('https://example.test/api/content/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(originalSite)
    }), env);
    assert(unauthorized.status === 401, `Worker unauthorized PUT should be 401, got ${unauthorized.status}`);

    const updated = structuredClone(originalSite);
    updated.announcement.title = 'Worker GitHub Saved Title';
    const saved = await worker.fetch(new Request('https://example.test/api/content/site', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updated)
    }), env);
    assert(saved.status === 200, `Worker authorized PUT should be 200, got ${saved.status}`);
    assert(putPayload.sha === 'site-sha', 'Worker GitHub PUT should include current SHA');
    assert(putPayload.branch === 'main', 'Worker GitHub PUT should target configured branch');
    assert(decodeBase64(putPayload.content).includes('Worker GitHub Saved Title'), 'Worker GitHub PUT encoded the wrong content');
  } finally {
    globalThis.fetch = originalFetch;
  }

  await verifyWorkerGithubErrors(worker, env, originalSite);
}

async function verifyWorkerGithubErrors(worker, env, originalSite) {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    const missing = await worker.fetch(new Request('https://example.test/api/content/site'), env);
    const missingBody = await missing.json();
    assert(missing.status === 502, `Worker GitHub 404 should return 502, got ${missing.status}`);
    assert(missingBody.error.includes('GRSB_GITHUB_REPO'), 'GitHub 404 should explain repo/branch/prefix configuration');

    let count = 0;
    globalThis.fetch = async () => {
      count += 1;
      if (count === 1) {
        return new Response(JSON.stringify({ sha: 'stale-sha', content: encodeBase64(JSON.stringify(originalSite)) }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ message: 'sha does not match' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    };
    const conflict = await worker.fetch(new Request('https://example.test/api/content/site', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(originalSite)
    }), env);
    const conflictBody = await conflict.json();
    assert(conflict.status === 502, `Worker GitHub conflict should return 502, got ${conflict.status}`);
    assert(conflictBody.error.includes('Reload the editor'), 'GitHub conflict should ask the user to reload');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function waitForBackend() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Backend did not become ready');
}

async function verifyNodeBackend() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'grsb-smoke-'));
  let child;
  try {
    const contentDir = path.join(tempDir, 'content');
    await mkdir(contentDir, { recursive: true });
    child = spawn(process.execPath, ['server/node-server.mjs'], {
      cwd: root,
      stdio: 'ignore',
      env: {
        ...process.env,
        PORT: String(port),
        GRSB_ADMIN_TOKEN: token,
        GRSB_CONTENT_DIR: contentDir,
        GRSB_PUBLIC_DIR: root
      }
    });

    await waitForBackend();

    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    const healthJson = await health.json();
    assert(healthJson.ok === true, 'Health endpoint did not report ok');
    assert(healthJson.adminApiEnabled === true, 'Admin API should be enabled during smoke test');
    assert(healthJson.contentRoot === contentDir, 'Health endpoint should report the configured content root');

    const siteRes = await fetch(`http://127.0.0.1:${port}/api/content/site`);
    const site = await siteRes.json();
    site.announcement.title = 'Smoke Test Saved Title';

    const unauthorized = await fetch(`http://127.0.0.1:${port}/api/content/site`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(site)
    });
    assert(unauthorized.status === 401, `Unauthorized PUT should be 401, got ${unauthorized.status}`);

    const saved = await fetch(`http://127.0.0.1:${port}/api/content/site`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(site)
    });
    assert(saved.status === 200, `Authorized PUT should be 200, got ${saved.status}`);

    const written = await readFile(path.join(contentDir, 'site.json'), 'utf8');
    assert(written.includes('Smoke Test Saved Title'), 'Saved content was not written to disk');
  } finally {
    if (child && !child.killed) child.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

await verifyStaticWorker();
await verifyNodeBackend();
console.log('Smoke tests passed.');

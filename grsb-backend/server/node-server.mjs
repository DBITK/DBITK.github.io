import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicRoot = path.resolve(process.env.GRSB_PUBLIC_DIR || root);
const contentRoot = path.resolve(process.env.GRSB_CONTENT_DIR || path.join(root, 'content'));
const seedContentRoot = path.join(root, 'content');
const token = process.env.GRSB_ADMIN_TOKEN || '';
const port = Number(process.env.PORT || 8080);
const githubApiBase = 'https://api.github.com';
const editableFiles = new Map([
  ['site', 'site.json'],
  ['concerts', 'concerts.json'],
  ['audio', 'audio.json']
]);
const startedAt = new Date().toISOString();

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.yml': 'text/yaml; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': type.includes('json') || type.includes('html') ? 'no-cache' : 'public, max-age=3600'
  });
  res.end(body);
}

function contentPath(name) {
  const file = editableFiles.get(name);
  if (!file) return null;
  return path.join(contentRoot, file);
}

function githubConfig() {
  const repo = process.env.GRSB_GITHUB_REPO;
  const githubToken = process.env.GRSB_GITHUB_TOKEN;
  if (!repo || !githubToken) return null;
  return {
    repo,
    token: githubToken,
    branch: process.env.GRSB_GITHUB_BRANCH || 'main',
    prefix: (process.env.GRSB_GITHUB_CONTENT_PREFIX || 'content').split('/').filter(Boolean).join('/'),
    committerName: process.env.GRSB_GITHUB_COMMITTER_NAME || 'GRSB Website Editor',
    committerEmail: process.env.GRSB_GITHUB_COMMITTER_EMAIL || 'grsymphonicband@gmail.com'
  };
}

function githubPath(config, name) {
  const file = editableFiles.get(name);
  if (!file) return null;
  return `${config.prefix ? `${config.prefix}/` : ''}${file}`;
}

function githubHeaders(config) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.token}`,
    'User-Agent': 'grsb-website-editor'
  };
}

async function githubError(res, action) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body && body.message ? ` ${body.message}` : '';
  } catch {}
  if (res.status === 401 || res.status === 403) return `GitHub ${action} failed. Check GRSB_GITHUB_TOKEN permissions.${detail}`;
  if (res.status === 404) return `GitHub ${action} failed. Check GRSB_GITHUB_REPO, GRSB_GITHUB_BRANCH, and GRSB_GITHUB_CONTENT_PREFIX.${detail}`;
  if (res.status === 409 || res.status === 422) return `GitHub ${action} failed because the file changed. Reload the editor and try again.${detail}`;
  return `GitHub ${action} failed with status ${res.status}.${detail}`;
}

async function readGithubContent(config, name) {
  const filePath = githubPath(config, name);
  if (!filePath) return null;
  const url = `${githubApiBase}/repos/${config.repo}/contents/${encodeURIComponent(filePath).replaceAll('%2F', '/')}?ref=${encodeURIComponent(config.branch)}`;
  const res = await fetch(url, { headers: githubHeaders(config) });
  if (!res.ok) throw new Error(await githubError(res, 'read'));
  return res.json();
}

function decodeGithubContent(record) {
  return Buffer.from((record.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
}

function encodeGithubContent(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function ensureEditableContent() {
  await mkdir(contentRoot, { recursive: true });
  for (const file of editableFiles.values()) {
    const target = path.join(contentRoot, file);
    if (await fileExists(target)) continue;
    await copyFile(path.join(seedContentRoot, file), target);
  }
}

function authorized(req) {
  if (!token) return false;
  return req.headers.authorization === `Bearer ${token}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function validateContent(name, data) {
  if (name === 'site') {
    if (!data || !data.announcement || !data.donation) throw new Error('site.json needs announcement and donation sections.');
    if (!data.announcement.title || !data.donation.title) throw new Error('Announcement and donation sections need titles.');
  }

  if (name === 'concerts') {
    if (!data || !Array.isArray(data.concerts)) throw new Error('concerts.json needs a concerts array.');
    data.concerts.forEach((concert) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(concert.date || '')) throw new Error('Each concert needs a YYYY-MM-DD date.');
      if (!concert.title) throw new Error('Each concert needs a title.');
    });
  }

  if (name === 'audio') {
    if (!data || !Array.isArray(data.tracks)) throw new Error('audio.json needs a tracks array.');
    data.tracks.forEach((track) => {
      if (!track.title) throw new Error('Each track needs a title.');
      if (!track.file && !track.remote) throw new Error('Each track needs a local path or remote URL.');
    });
  }
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    const config = githubConfig();
    send(res, 200, JSON.stringify({
      ok: true,
      startedAt,
      backend: 'node',
      persistence: config ? 'github' : 'disk',
      adminApiEnabled: Boolean(token),
      contentRoot: config ? null : contentRoot,
      githubRepo: config ? config.repo : null,
      githubBranch: config ? config.branch : null,
      githubContentPrefix: config ? config.prefix : null,
      contentFiles: Array.from(editableFiles.values())
    }), 'application/json; charset=utf-8');
    return true;
  }

  const match = url.pathname.match(/^\/api\/content\/(site|concerts|audio)$/);
  if (!match) return false;

  const name = match[1];
  const filePath = contentPath(name);
  const config = githubConfig();
  if (!filePath) {
    send(res, 404, JSON.stringify({ error: 'Unknown content file' }), 'application/json; charset=utf-8');
    return true;
  }

  try {
    if (req.method === 'GET') {
      if (config) {
        const record = await readGithubContent(config, name);
        send(res, 200, decodeGithubContent(record), 'application/json; charset=utf-8');
        return true;
      }

      send(res, 200, await readFile(filePath, 'utf8'), 'application/json; charset=utf-8');
      return true;
    }

    if (req.method === 'PUT') {
      if (!authorized(req)) {
        send(res, 401, JSON.stringify({ error: 'Unauthorized' }), 'application/json; charset=utf-8');
        return true;
      }

      const parsed = JSON.parse(await readBody(req));
      validateContent(name, parsed);

      if (config) {
        const file = githubPath(config, name);
        const current = await readGithubContent(config, name);
        const body = JSON.stringify({
          message: `Update ${file} from website editor`,
          content: encodeGithubContent(JSON.stringify(parsed, null, 2) + '\n'),
          sha: current.sha,
          branch: config.branch,
          committer: { name: config.committerName, email: config.committerEmail }
        });
        const githubUrl = `${githubApiBase}/repos/${config.repo}/contents/${encodeURIComponent(file).replaceAll('%2F', '/')}`;
        const githubRes = await fetch(githubUrl, {
          method: 'PUT',
          headers: { ...githubHeaders(config), 'Content-Type': 'application/json' },
          body
        });
        if (!githubRes.ok) throw new Error(await githubError(githubRes, 'save'));
        send(res, 200, JSON.stringify({ ok: true, file, backend: 'github' }), 'application/json; charset=utf-8');
        return true;
      }

      await mkdir(contentRoot, { recursive: true });
      await writeFile(filePath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
      send(res, 200, JSON.stringify({ ok: true, file: `content/${editableFiles.get(name)}` }), 'application/json; charset=utf-8');
      return true;
    }

    send(res, 405, JSON.stringify({ error: 'Method not allowed' }), 'application/json; charset=utf-8');
    return true;
  } catch (err) {
    send(res, 400, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8');
    return true;
  }
}

function resolveStatic(url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (!path.extname(pathname)) pathname += '.html';

  const filePath = path.resolve(publicRoot, '.' + pathname);
  if (!filePath.startsWith(publicRoot)) return null;
  return filePath;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (await handleApi(req, res, url)) return;

  try {
    const filePath = resolveStatic(url);
    if (!filePath) {
      send(res, 403, 'Forbidden');
      return;
    }

    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Not found');

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, await readFile(filePath), types[ext] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found');
  }
});

await ensureEditableContent();

server.listen(port, '0.0.0.0', () => {
  console.log(`GRSB proposal site listening on http://127.0.0.1:${port}`);
  const config = githubConfig();
  console.log(config ? `Editable content repository: ${config.repo}/${config.prefix}` : `Editable content directory: ${contentRoot}`);
  console.log(token ? 'Admin API enabled.' : 'Admin API disabled until GRSB_ADMIN_TOKEN is set.');
});

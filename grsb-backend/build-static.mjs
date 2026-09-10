import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const entries = [
  '.openai',
  'admin',
  'assets/fonts',
  'assets/uploads',
  'assets/img/barry2025.jpg',
  'assets/img/donate-qr.png',
  'assets/img/facebookGRSBgroup.jpg',
  'assets/img/grsblogo.png',
  'backend.html',
  'content',
  'about.html',
  'auditions.html',
  'concerts.html',
  'conductor.html',
  'contact.html',
  'index.html',
  'main.js',
  'proposal.html',
  'styles.css',
  'support.html',
  'youth-soloist.html'
];

const contentTypes = {
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

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!existsSync(source)) continue;
  await cp(source, path.join(dist, entry), { recursive: true });
}

await mkdir(path.join(dist, 'server'), { recursive: true });
await writeFile(path.join(dist, 'server', 'index.js'), await buildWorker());

console.log(`Static site copied to ${path.relative(root, dist) || dist}`);

async function listFiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'server') continue;
      found.push(...await listFiles(fullPath));
    } else {
      found.push(fullPath);
    }
  }
  return found;
}

async function buildWorker() {
  const files = await listFiles(dist);
  const records = [];
  for (const file of files) {
    const rel = '/' + path.relative(dist, file).replaceAll(path.sep, '/');
    if (rel.startsWith('/preview-homepage')) continue;
    const ext = path.extname(file).toLowerCase();
    const bytes = await readFile(file);
    records.push([rel, [contentTypes[ext] || 'application/octet-stream', bytes.toString('base64')]]);
  }

  return `const assets = new Map(${JSON.stringify(records)});\n\n` +
`const editableFiles = new Map([\n` +
`  ['site', 'site.json'],\n` +
`  ['concerts', 'concerts.json'],\n` +
`  ['audio', 'audio.json']\n` +
`]);\n\n` +
`function normalizePath(request) {\n` +
`  const url = new URL(request.url);\n` +
`  let pathname = decodeURIComponent(url.pathname);\n` +
`  if (pathname.endsWith('/')) pathname += 'index.html';\n` +
`  if (!pathname.includes('.')) pathname += '.html';\n` +
`  return pathname;\n` +
`}\n\n` +
`function decodeBase64(value) {\n` +
`  const raw = atob(value);\n` +
`  const bytes = new Uint8Array(raw.length);\n` +
`  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);\n` +
`  return bytes;\n` +
`}\n\n` +
`function encodeBase64(value) {\n` +
`  const bytes = new TextEncoder().encode(value);\n` +
`  let raw = '';\n` +
`  for (let i = 0; i < bytes.length; i += 8192) {\n` +
`    raw += String.fromCharCode(...bytes.slice(i, i + 8192));\n` +
`  }\n` +
`  return btoa(raw);\n` +
`}\n\n` +
`function decodeJsonAsset(pathname) {\n` +
`  const asset = assets.get(pathname);\n` +
`  if (!asset) return null;\n` +
`  return new TextDecoder().decode(decodeBase64(asset[1]));\n` +
`}\n\n` +
`function jsonResponse(body, status = 200) {\n` +
`  return new Response(JSON.stringify(body), {\n` +
`    status,\n` +
`    headers: {\n` +
`      'Content-Type': 'application/json; charset=utf-8',\n` +
`      'Cache-Control': 'no-cache'\n` +
`    }\n` +
`  });\n` +
`}\n\n` +
`function githubConfig(env) {\n` +
`  const repo = env && env.GRSB_GITHUB_REPO;\n` +
`  const token = env && env.GRSB_GITHUB_TOKEN;\n` +
`  if (!repo || !token) return null;\n` +
`  return {\n` +
`    repo,\n` +
`    token,\n` +
`    branch: (env && env.GRSB_GITHUB_BRANCH) || 'main',\n` +
`    prefix: ((env && env.GRSB_GITHUB_CONTENT_PREFIX) || 'content').split('/').filter(Boolean).join('/'),\n` +
`    committerName: (env && env.GRSB_GITHUB_COMMITTER_NAME) || 'GRSB Website Editor',\n` +
`    committerEmail: (env && env.GRSB_GITHUB_COMMITTER_EMAIL) || 'grsymphonicband@gmail.com'\n` +
`  };\n` +
`}\n\n` +
`function githubPath(config, name) {\n` +
`  const file = editableFiles.get(name);\n` +
`  if (!file) return null;\n` +
`  return (config.prefix ? config.prefix + '/' : '') + file;\n` +
`}\n\n` +
`function githubHeaders(config) {\n` +
`  return {\n` +
`    'Accept': 'application/vnd.github+json',\n` +
`    'Authorization': 'Bearer ' + config.token,\n` +
`    'User-Agent': 'grsb-website-editor'\n` +
`  };\n` +
`}\n\n` +
`async function githubError(res, action) {\n` +
`  let detail = '';\n` +
`  try {\n` +
`    const body = await res.json();\n` +
`    detail = body && body.message ? ' ' + body.message : '';\n` +
`  } catch {}\n` +
`  if (res.status === 401 || res.status === 403) return 'GitHub ' + action + ' failed. Check GRSB_GITHUB_TOKEN permissions.' + detail;\n` +
`  if (res.status === 404) return 'GitHub ' + action + ' failed. Check GRSB_GITHUB_REPO, GRSB_GITHUB_BRANCH, and GRSB_GITHUB_CONTENT_PREFIX.' + detail;\n` +
`  if (res.status === 409 || res.status === 422) return 'GitHub ' + action + ' failed because the file changed. Reload the editor and try again.' + detail;\n` +
`  return 'GitHub ' + action + ' failed with status ' + res.status + '.' + detail;\n` +
`}\n\n` +
`function validateContent(name, data) {\n` +
`  if (name === 'site') {\n` +
`    if (!data || !data.announcement || !data.donation) throw new Error('site.json needs announcement and donation sections.');\n` +
`    if (!data.announcement.title || !data.donation.title) throw new Error('Announcement and donation sections need titles.');\n` +
`  }\n` +
`  if (name === 'concerts') {\n` +
`    if (!data || !Array.isArray(data.concerts)) throw new Error('concerts.json needs a concerts array.');\n` +
`    data.concerts.forEach((concert) => {\n` +
`      if (!/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(concert.date || '')) throw new Error('Each concert needs a YYYY-MM-DD date.');\n` +
`      if (!concert.title) throw new Error('Each concert needs a title.');\n` +
`    });\n` +
`  }\n` +
`  if (name === 'audio') {\n` +
`    if (!data || !Array.isArray(data.tracks)) throw new Error('audio.json needs a tracks array.');\n` +
`    data.tracks.forEach((track) => {\n` +
`      if (!track.title) throw new Error('Each track needs a title.');\n` +
`      if (!track.file && !track.remote) throw new Error('Each track needs a local path or remote URL.');\n` +
`    });\n` +
`  }\n` +
`}\n\n` +
`async function readGithubContent(config, name) {\n` +
`  const filePath = githubPath(config, name);\n` +
`  if (!filePath) return null;\n` +
`  const url = 'https://api.github.com/repos/' + config.repo + '/contents/' + encodeURIComponent(filePath).replaceAll('%2F', '/') + '?ref=' + encodeURIComponent(config.branch);\n` +
`  const res = await fetch(url, { headers: githubHeaders(config) });\n` +
`  if (!res.ok) throw new Error(await githubError(res, 'read'));\n` +
`  return res.json();\n` +
`}\n\n` +
`async function handleGithubContentApi(request, env, pathname) {\n` +
`  if (pathname === '/api/health') {\n` +
`    const config = githubConfig(env);\n` +
`    return jsonResponse({\n` +
`      ok: true,\n` +
`      backend: 'worker',\n` +
`      persistence: config ? 'github' : 'static',\n` +
`      adminApiEnabled: Boolean(config && env && env.GRSB_ADMIN_TOKEN),\n` +
`      contentFiles: Array.from(editableFiles.values())\n` +
`    });\n` +
`  }\n` +
`  const match = pathname.match(/^\\/api\\/content\\/(site|concerts|audio)$/);\n` +
`  if (!match) return null;\n` +
`  const config = githubConfig(env);\n` +
`  if (!config) return null;\n` +
`  const name = match[1];\n` +
`  const filePath = githubPath(config, name);\n` +
`  if (request.method === 'GET') {\n` +
`    try {\n` +
`      const record = await readGithubContent(config, name);\n` +
`      const content = record.content ? new TextDecoder().decode(decodeBase64(record.content.replace(/\\\\n/g, ''))) : decodeJsonAsset('/' + filePath);\n` +
`      return new Response(content, {\n` +
`        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' }\n` +
`      });\n` +
`    } catch (err) {\n` +
`      return jsonResponse({ error: err.message }, 502);\n` +
`    }\n` +
`  }\n` +
`  if (request.method === 'PUT') {\n` +
`    if (!env || !env.GRSB_ADMIN_TOKEN || request.headers.get('Authorization') !== 'Bearer ' + env.GRSB_ADMIN_TOKEN) {\n` +
`      return jsonResponse({ error: 'Unauthorized' }, 401);\n` +
`    }\n` +
`    let parsed;\n` +
`    try {\n` +
`      parsed = await request.json();\n` +
`      validateContent(name, parsed);\n` +
`    } catch (err) {\n` +
`      return jsonResponse({ error: err.message }, 400);\n` +
`    }\n` +
`    let current;\n` +
`    try {\n` +
`      current = await readGithubContent(config, name);\n` +
`    } catch (err) {\n` +
`      return jsonResponse({ error: err.message }, 502);\n` +
`    }\n` +
`    const body = JSON.stringify({\n` +
`      message: 'Update ' + filePath + ' from website editor',\n` +
`      content: encodeBase64(JSON.stringify(parsed, null, 2) + '\\\\n'),\n` +
`      sha: current.sha,\n` +
`      branch: config.branch,\n` +
`      committer: { name: config.committerName, email: config.committerEmail }\n` +
`    });\n` +
`    const url = 'https://api.github.com/repos/' + config.repo + '/contents/' + encodeURIComponent(filePath).replaceAll('%2F', '/');\n` +
`    const res = await fetch(url, { method: 'PUT', headers: { ...githubHeaders(config), 'Content-Type': 'application/json' }, body });\n` +
`    if (!res.ok) return jsonResponse({ error: await githubError(res, 'save') }, 502);\n` +
`    return jsonResponse({ ok: true, file: filePath, backend: 'github' });\n` +
`  }\n` +
`  return jsonResponse({ error: 'Method not allowed' }, 405);\n` +
`}\n\n` +
`export default {\n` +
`  async fetch(request, env = {}) {\n` +
`    const url = new URL(request.url);\n` +
`    const apiResponse = await handleGithubContentApi(request, env, url.pathname);\n` +
`    if (apiResponse) return apiResponse;\n` +
`    const pathname = normalizePath(request);\n` +
`    const asset = assets.get(pathname);\n` +
`    if (!asset) return new Response('Not found', { status: 404 });\n` +
`    const [contentType, body] = asset;\n` +
`    return new Response(decodeBase64(body), {\n` +
`      headers: {\n` +
`        'Content-Type': contentType,\n` +
`        'Cache-Control': contentType.includes('text/html') || contentType.includes('json') ? 'no-cache' : 'public, max-age=3600'\n` +
`      }\n` +
`    });\n` +
`  }\n` +
`};\n`;
}

# CLAUDE.md — DBITK.github.io

Derek Bartlett's portfolio site, served by GitHub Pages at **https://derekbartlett.com**.
This repo also hosts a second, unrelated site for the Grand Rapids Symphonic Band (GRSB)
under `grsb/`, plus the Node backend that edits it.

## Hard rules

- **Never make this repo private.** That deletes the Pages site, and flipping it back
  to public does not restore it. Pages must be re-created
  (`POST /repos/DBITK/DBITK.github.io/pages`, `source[branch]=main`) and HTTPS re-enforced
  on this repo and every project Pages site. Project sites such as
  `derekbartlett.com/golden-path-pipeline/` resolve through this repo's custom domain, so
  they go down too.
- **Keep `CNAME`** (`derekbartlett.com`). It is what lets the custom domain come back
  automatically.
- **No build step for the portfolio.** `index.html` is one hand-written file with inline
  CSS and JS: no frameworks, no CDNs, no trackers, no analytics. Keep it that way.
- **Commit identity:** `DBITK <53228646+DBITK@users.noreply.github.com>`. Never commit as
  the placeholder `Your Name <youremail@example.com>`, because GitHub credits that address
  to a stranger.
- **Pull before editing.** The GRSB editor commits to `main` from Render, so the local
  copy goes stale. Run `git pull --ff-only` first.
- The repo is public, and everything in it, including this file, is publicly readable.
  Never commit secrets: `GRSB_ADMIN_TOKEN` and `GRSB_GITHUB_TOKEN` live only in Render.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole portfolio: a Windows 98-style "Derek OS" desktop (~2,700 lines) |
| `photo.jpg` | Avatar in the welcome dialog and the `og:image` |
| `CNAME` | Custom domain for Pages |
| `_config.yml` | Only excludes `CLAUDE.md` and `counter-worker/` from the published site |
| `counter-worker/` | Cloudflare Worker behind the visitor counter (not served by Pages) |
| `grsb/` | **Published** GRSB static site → `derekbartlett.com/grsb/` (not linked from the portfolio) |
| `grsb-backend/` | Source and Node server for the GRSB site and its content editor, deployed to Render |
| `render.yaml` | Render blueprint for `grsb-backend` |

## Portfolio (`index.html`)

The file is organized by banner comments (`/* ===== SECTION ===== */` in CSS and JS,
`<!-- SECTION -->` in markup). Search for a banner rather than trusting line numbers.

### Load flow

1. **Mobile detection**: width `< 768`, or a touch device under `1024`. It shows
   `#mobile-fallback` (a plain name/role/bio/links card), hides everything else, and sets
   `window.__mobileMode` so the boot never runs. Detection runs once at load, so resizing
   afterwards doesn't switch layouts.
2. **Boot screen** (`#boot`): a fake BIOS plus "PIPELINE: deploy/portfolio" stages, lines
   `bl0`–`bl10` on timed delays, then a random-step progress bar starting at 3s, then
   "READY.", then fade out. The desktop shows about 5s in.
3. **Welcome dialog** (`#win-welcome`): typewriter text in `#welcome-text`, then the hint
   list and the "Let's go →" button. The avatar falls back to "db" initials if
   `photo.jpg` fails to load.
4. `dismissWelcome()` opens the window named in the URL hash, otherwise `about`.

### Deep links

`#about`, `#projects`, `#skills` and `#contact` open that window after the welcome
dialog. `iconOpen()` writes the hash with `history.replaceState` when one of those icons
is double-clicked. Hackman is deliberately not linkable.

### Windows (`.win98-window`, id `win-<name>`)

| id | Title | Contents |
|---|---|---|
| `about` | about.exe | Profile dialog |
| `projects` | projects/ — Windows Explorer | Explorer list; each `.explorer-row` is a project (name, blurb, fake size and date) |
| `skills` | skills.json — [Read Only] | Terminal-style `cat skills.json` with syntax-colored spans (`t-key`, `t-val`, `t-comment`) |
| `contact` | contact.txt — Notepad | Contact links |
| `hackman` | ??? — UNKNOWN PROGRAM | Easter-egg game, see below |

The window manager lives in the `WINDOW MANAGEMENT` JS section:
- **Opening and closing:** `openWindow(id)`, `closeWindow(id)`, `minimizeWindow(id)` and
  `focusWindow(id)`. Open state is kept in `openWindows`, titles and icons in `windowMeta`.
- **Stacking:** `bringToFront` raises the window and marks the other title bars inactive.
- **Mouse:** drag by the title bar. Maximize/restore with the title-bar button or a
  double-click (`toggleMaximize(id)`; the restore geometry is kept in `data-restore`).
  Resize from any edge or corner: JS adds eight `.win-rh` handles to every window and
  uses pointer events. Dragging and resizing are disabled while a window is maximized.
- **Sizing and scaling** (the `WINDOW GEOMETRY` JS section):
  - Window sizes are not in the markup. Default geometry lives in `windowDefaults`,
    designed for a 1440×860 desktop, and is applied on a window's first open
    (`placeDefault`).
  - `uiScale` comes from the viewport in CSS pixels (`min(vw/1440, vh/860)`), so OS
    display scaling is respected. It runs from 0.85 on small laptops through 1.25 at
    1080p and ~1.75 at 1440p, up to 2.4 for 4K at 100%, in 0.05 steps. It scales the
    default sizes, the 280×160 minimum and the 28px taskbar height (`TASKBAR_H`).
  - The CSS `--ui-scale` `zoom`s the whole desktop UI: each window's title bar and body
    (not the window box itself, so drag and resize stay in viewport pixels), the boot
    text, desktop icons, watermark, taskbar, Start menu, context menu, and the welcome
    and shutdown dialogs. `#desktop`'s bottom inset follows the scaled taskbar.
  - `left`/`top` on a zoomed element are multiplied by its zoom, so the context menu
    divides its cursor position by `uiScale`. Do the same for any new zoomed popup.
  - On a browser resize, windows the visitor hasn't touched take the new default size;
    moved or resized windows (`data-user-geom`) are kept but pulled back on screen; a
    maximized window refills the desktop.
  - Measurements made inside a window body are in zoomed (local) CSS pixels.
- **Keyboard:** Esc closes the topmost window and also dismisses the menus and the
  shutdown dialog.

**Adding a window** takes all of the following: the markup `#win-<id>` (with a maximize button), entries in `windowDefaults` and
`windowMeta`, a desktop icon, and items in the Start menu and context menu. If it should
be deep-linkable, also add it to the `linkable` list in `iconOpen()` and to `validIds` in
`dismissWelcome()`.

### Desktop chrome

- **Desktop icons** (`.desktop-icons`): single-click selects (`selectIcon`), double-click
  opens. They are about.exe, projects/, skills.json, contact.txt and ??? (Hackman).
- **Taskbar** (`#taskbar`): Start button, a tab per open window (`addTaskbarTab` and
  related functions), and a tray date/clock (`updateClock`).
- **Start menu** (`#start-menu`, sidebar "Derek OS"): Programs ▶ submenu, Print Resume,
  Screen Saver, CRT Effect toggle, GitHub, LinkedIn, Shut Down.
- **Right-click context menu** (`#ctx-menu`): only appears on the bare desktop, not over
  windows or the taskbar. It opens windows, prints the resume, or opens "View Source"
  (github.com/DBITK).
- **Shut Down** (`#shutdown-dlg` → `shutdownSequence()`): fades to "It is now safe to turn
  off your computer." This is final; a reload restores the site.
- **Starfield** `<canvas id="starfield">` behind everything.
- **3D Pipes** (`PIPES` JS section): a recreation of the Win98 screensaver.
  - `createPipes(canvas, opts)` grows pipes through a 22×14×14 grid, uses a hand-rolled
    perspective projection, and draws cylinders as layered strokes plus ball joints.
  - It's used only as the full-screen screensaver (`#screensaver`). There are no
    background pipes; the desktop background is just the starfield. Pipes grow
    continuously and time-based (`opts.speed` cells/sec), and the screen clears when
    it's full.
  - The screensaver starts after 3 minutes idle (not during boot or while Hackman is
    running), from Start → Screen Saver, or from the right-click menu
    (`startScreensaver()`).
  - Any input wakes it. Window-level capture listeners swallow the waking input so it
    doesn't also trigger something underneath (for example, Esc closing a window).
- **CRT effect** (`#crt`): a deliberately subtle top-layer overlay with no pointer
  events. It draws scanlines, a vignette, a slow rolling band and a faint power-on flash at load.
  - Toggle it from Start → CRT Effect (`toggleCrt()`). The choice is stored in
    `localStorage['crt']` and applied as `body.crt-off`.
  - It's hidden on mobile; reduced motion drops the flash and the roll.
- **Visitor counter** (`VISITOR COUNTER` JS section + `counter-worker/`):
  - A retro odometer in the welcome dialog ("You are the 50th visitor!!!") and a mini
    copy in the taskbar tray (`#tray-visitors`).
  - It's fed by a Cloudflare Worker with one Durable Object holding one number.
    `POST /count` adds one, but only for derekbartlett.com origins; `GET` just reads.
    Localhost may read but never adds. There are no cookies, IPs or visitor data.
  - `COUNTER_URL` in `index.html` points at the deployed Worker. If it's empty or
    unreachable, the counter stays hidden.
  - A browser counts once per tab (`sessionStorage['visitorNumber']`, which also keeps
    "your" number on refresh). `?nocount` opts a browser out permanently
    (`localStorage['visitorCounterSkip']`).
  - Deploy steps are in `counter-worker/README.md`. The folder is excluded from Pages
    in `_config.yml`.
- **Desktop watermark** (`#desktop-label`): name and domain behind the icons and windows.
- **Visual details:** custom SVG cursors (default plus a red "clickable" variant, at the
  top of the CSS), chunky always-visible Win98 scrollbars, and `user-select: none`
  globally.
- **Reduced motion:** a `prefers-reduced-motion` block tones down the animations.

### Print resume (`#resume-print`)

A full résumé that is hidden on screen and becomes the only visible element under
`@media print`. It is triggered by "Print Resume..." in the Start and context menus
(`window.print()`). Treat it as the canonical résumé text: experience, projects, skills
and education.

### Hackman (Easter egg)

A Pac-Man clone ("eat the bytes before the antivirus finds you") on `#hackman-canvas`.
- **Grid:** a 19×15 grid of 20px tiles, `MAZE_TEMPLATE`, where `0`/`3` are dots and power
  pellets.
- **Controls:** arrows or WASD; Enter or a click on the title screen starts the game.
- **HUD:** score, lives and level, with Web Audio beeps (`playBeep`, `playDeath`).
- **Speeds:** `PLAYER_MS_BASE` and `GHOST_MS_BASE`, faster each level. The power-up
  (`POWER_MS`), the mouth and the pellet pulse are time-based, not per frame.
- **Spawns:** `PLAYER_SPAWN`, `GHOST_SPAWNS` (inside the ghost house) and `GHOST_HOME`
  (where eaten ghosts go) all pass through `nearestOpen()`, so nothing can start in a
  wall even if `MAZE_TEMPLATE` changes. After a death, `resetPositions()` puts everyone
  back.
- **Movement:** columns wrap (`wrapCol`), which makes row 10 a side tunnel. A collision
  also counts when the player and a ghost swap tiles in one step.
- **Levels:** `hackmanInit()` starts a new game (score, lives); `hackmanResetBoard()`
  gives a fresh maze but keeps score, lives and level.
- **Win and lose:** eating every dot calls `hackmanWin()`: the maze flashes, a jingle
  plays, then the "ACCESS GRANTED" screen shows Next Level and Play Again. Losing shows
  "VIRUS DETECTED" with Reboot. Both screens show the best score, kept in
  `localStorage['hackmanBest']`, and Enter picks the main action.
- **Lifecycle:** closing the window calls `hackmanStop()`; the title listeners are
  attached on first open.
- **Sizing:** `fitHackmanCanvas()` (run by a ResizeObserver) scales the canvas's
  displayed size to fill the window. The drawing buffer stays 380×300.

### Copy that must stay in sync

The bio, title and contact details are repeated in several places. Update them together:
- `<meta name="description">`, `og:*`, `<title>`
- the welcome dialog text (JS `showWelcome`) and its title bar
- the `about`, `skills`, `projects` and `contact` windows
- `#mobile-fallback`
- `#resume-print`

Contacts in use: `derek@derekbartlett.com`, `github.com/DBITK`, `linkedin.com/in/DBIT`.

## GRSB site (`grsb/` + `grsb-backend/`)

A separate static site for the Grand Rapids Symphonic Band. It has nothing to do with the
portfolio, and the portfolio doesn't link to it.

### How content flows

```
Admin opens  https://grsb-backend-9q1r.onrender.com/admin/editor.html
  → PUT /api/content/{site|concerts|audio}  (Bearer GRSB_ADMIN_TOKEN)
  → server commits via GitHub Contents API to DBITK/DBITK.github.io : main : grsb/content/*.json
    (committer "GRSB Website Editor <grsymphonicband@gmail.com>")
  → GitHub Pages republishes derekbartlett.com/grsb/
  → grsb/main.js fetches content/*.json (cache: no-store) and renders it client-side
```

- **`grsb/content/*.json` is live data written by the editor.** The commits titled
  "Update grsb/content/... from website editor" are the band's edits, not noise. Don't
  rewrite or squash them, and pull before touching these files.
- `grsb-backend/content/*.json` are seed copies and already differ from `grsb/content/`.
  With GitHub persistence configured, the backend reads and writes the repo, not its
  local `content/`.
- **Pages, styles and scripts are kept in two places by hand.** `grsb/` (index, about,
  auditions, concerts, conductor, contact, support, youth-soloist, proposal, `main.js`,
  `styles.css`, fonts, images) is a copy of the same files in `grsb-backend/`. Nothing
  syncs them, so when you change one, mirror it in the other.
- **Pages that exist only in `grsb-backend/`:** `backend.html` (the deployment-plan
  page), `admin/`, `server/`, `scripts/` and the extra hi-res images.
- `grsb/.nojekyll` disables Jekyll for that folder.

### Backend (`grsb-backend/`)

- **`server/node-server.mjs`:** a zero-dependency Node HTTP server. It serves static
  files and the API:
  - `GET /api/health` reports which persistence is in use and whether the admin API is
    enabled.
  - `GET /api/content/<name>` reads a content file.
  - `PUT /api/content/<name>` validates and saves it; it needs a Bearer token.
  - Valid names are `site`, `concerts` and `audio`.
  - Persistence is GitHub when the `GRSB_GITHUB_*` variables are set, otherwise
    `GRSB_CONTENT_DIR`.
- **`admin/editor.html` + `editor.js`:** the no-login editor. It detects the backend
  through `/api/health`, saves with the token typed into the page, and offers JSON
  download as a fallback.
- **`admin/index.html` + `config.yml`:** an alternative Decap CMS setup (git-gateway).
  Not the main path.
- **`build-static.mjs`:** `npm run build` writes `dist/`, including a Worker-style
  `server/index.js` for asset-binding hosts.
- **Scripts:**
  - `npm start` runs the Node server.
  - `npm run dev` runs a static Python server on 8080.
  - `npm test` runs `scripts/smoke-test.mjs` (static routes, plus the GitHub
    read/write/401 paths against a mocked API).
  - `npm run test:production-backend` checks the live backend.
- **Deployment:**
  - `render.yaml` defines the free-plan Render web service (`rootDir: grsb-backend`).
  - The secrets `GRSB_ADMIN_TOKEN` and `GRSB_GITHUB_TOKEN` are set in the Render
    dashboard, not in the repo.
  - `Dockerfile` (node:24-alpine) is an alternative.
  - `.env.example` lists every variable.
- The free Render plan sleeps when idle, so the first editor load can take 30–60s.

## Previewing locally

The vault root's `.claude/launch.json` has a `portfolio-site` config that serves this
folder at `http://localhost:8765/` (`python -m http.server`). Use a viewport of at least
1024px wide to get the desktop layout; narrower viewports trigger the mobile fallback.

## Related

- `golden-path-pipeline` repo → `derekbartlett.com/golden-path-pipeline/`, featured in
  `projects/` and the résumé.

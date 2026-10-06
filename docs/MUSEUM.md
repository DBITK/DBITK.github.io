# Derek's Museum of Technology — design

A 90s CD-ROM-style museum that lives inside the Win98 desktop as **MUSEUM.EXE**.
Visitors click through rooms (Myst / Encarta / Magic School Bus energy); every
room is a hands-on **exhibit** that proves one thing about Derek. It doubles as
a malleable cover letter: a custom link picks which exhibits are open, in what
order, and what the docent says.

## Principles

- **Staged, not live.** Every interaction is a scripted simulation. It works
  offline, gives the same result every time, and calls no AI or other live
  services.
- **Every exhibit is backed by real work.** A real repo and real numbers. No
  hollow showpieces.
- **Recruiter fast lane.** About, contact and the résumé are always one click away.
- **No trackers, no build step.** Hand-written HTML/CSS/JS served by GitHub Pages.

## What an exhibit is

Each exhibit is one room with six parts:

| Part | What it is |
|---|---|
| Room | One of Derek's renders, with clickable hotspots laid over it. |
| Hands-on piece | A staged simulation: buttons, sliders, things that react. |
| Placard | Title, 2–3 sentences of what and why, and "skills on display" tags. |
| Evidence | Repo, live demo, and the résumé line it backs. |
| ELI5 card | The plain-language version, collected in the ELI5 Corner. |
| Soundtrack | Optional per-room track from Derek (planned, not in the MVP). |

Exhibits and room layouts are data in `museum/exhibits.js`; the engine is
`museum/museum.js`.

## Rooms and art

| Room | Render | What's clickable |
|---|---|---|
| Lobby | `mall.jpg`, a vaporwave dead mall | Exhibit storefronts with neon signs (lit only if on the tour); the escalator up to the Front Office; the stairs down to the ELI5 Corner; the fountain; the docent |
| Canary Lab | `spaceship.jpg`, a retro cockpit | CRTs, radar and throttle run the canary analysis; the orange monitor is the placard (mission log); the green terminal plays the ELI5 tape; a floor hatch leads back |
| Front Office | `office.jpg`, an office above the clouds | Desk papers → résumé (print / save as PDF); PC → contact.txt; globe → About; bookshelf → skills.json. These open the real desktop windows. |
| ELI5 Corner | `basement.jpg`, an 80s basement | The TV plays ELI5 "tapes"; the old Mac lists every tape |

- **The stage** is 860×480 (the renders' shape), scaled to fit the window.
  Hotspot boxes are in those stage coordinates.
- **Art pipeline:** originals go in `museum/rooms/originals/` (git-ignored, so they
  stay local). Commit web copies at 1720×960 JPEG, quality ~82, about 250–320 KB each.
- **Every room except the lobby** has a ◄ LOBBY button, so nobody gets lost.

## Navigation

- Clicking MUSEUM.EXE plays a CD-ROM splash, then opens the **lobby**.
- The lobby shows the open exhibits as storefronts, plus the **docent** (pixel
  Derek), who greets the visitor and delivers the custom note on a tour link.
- Hotspots light up on hover, and their label shows in the status bar at the
  bottom (classic CD-ROM). The **Back** hotspot returns to the lobby.
- The stage is a fixed 860×480, scaled to fit the window, so art and hotspots line up at any size.

## Custom tour links

```
https://derekbartlett.com/#tour=<base64url JSON>
{ "to": "Acme", "note": "Start with the Canary Lab…", "ex": ["canary-lab", "eli5"] }
```

- Everything lives in the URL fragment, which the browser never sends to a
  server, so nothing about an application is stored in the repo.
- `ex` sets which exhibit storefronts are lit; unknown ids are ignored. With no
  tour, every exhibit is open and the unbuilt ones show "SOON". The Front Office
  is always open.
- The note is shown as plain text (never HTML) and is capped at 600 characters.
- Building a link: run `museumTourLink({ to, note, ex })` in the browser console
  on the site. A link-builder page is planned.
- Opening a tour link opens the museum straight after the welcome dialog.

## MVP

1. Museum shell: window, splash, lobby, room navigation, docent.
2. **Canary Lab** exhibit (Golden Path): a staged canary analysis with a real
   Mann-Whitney U and Cliff's delta judge.
3. **ELI5 Corner** with the first card.
4. Custom tour links.
5. About (formerly about.exe) and the print résumé refreshed from the master
   résumé. No phone number or employer client names on the public site.

## Next

- Pipeline Factory (CI/CD repo), Listening Booth (Derek's tracks), Robot
  Workshop (AI scripting, staged), Server Room (homelab), Arcade.
- Per-room music with a sound-on switch.
- Link-builder page.

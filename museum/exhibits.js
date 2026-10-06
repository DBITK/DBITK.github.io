/* =============================================================
   MUSEUM EXHIBITS — the content. See docs/MUSEUM.md for what the
   parts of an exhibit mean; the engine that runs them is museum.js.

   Rooms are 860×480 stage coordinates over Derek's renders in
   museum/rooms/ (web copies; full-size originals stay local).
   Hotspot actions:
     { go: 'scene' }        walk to another room
     { sim: 'canary' }      open a staged simulation
     { placard: 'id' }      open an exhibit's placard
     { eli5: 'key' }        play an ELI5 tape
     { eli5Index: true }    list every ELI5 tape
     { window: 'id' }       open a desktop window (About, contact.txt…)
     { resume: true }       show the résumé, with print / save as PDF
     { say: 'text' }        the docent says something (lobby only)
   ============================================================= */
window.MUSEUM_DATA = {
  /* Exhibits open in the lobby when there is no tour link */
  defaultTour: ['canary-lab', 'eli5'],

  exhibits: {
    'canary-lab': {
      title: 'Canary Lab',
      scene: 'canary-lab',
      placard: {
        title: 'The Canary Lab',
        text: [
          'Coal miners carried canaries underground: if the bird got sick, everyone got out. ' +
          'A canary release does the same for software. A new version takes a small slice of ' +
          'real traffic next to the current one, and the numbers decide whether it goes any further.',
          'Golden Path makes that decision automatically. It compares the two with a Mann-Whitney U ' +
          'test and an effect-size gate, then either flips traffic to the new version or destroys ' +
          'the canary before any user is affected.',
        ],
        tags: ['progressive delivery', 'canary analysis', 'statistics', 'Argo Rollouts', 'GitHub Actions'],
      },
      evidence: [
        { label: 'Source code', href: 'https://github.com/DBITK/golden-path-pipeline' },
        { label: 'Full interactive simulator', href: 'https://derekbartlett.com/golden-path-pipeline/' },
      ],
      eli5: 'canary',
    },
    'eli5': { title: 'ELI5 Corner', scene: 'eli5' },
  },

  scenes: {
    /* The mall atrium. Exhibit entrances light up only if the exhibit is
       on the current tour; the Front Office is always open. */
    lobby: {
      title: 'Lobby',
      art: 'museum/rooms/mall.jpg',
      docent: { x: 548, y: 338 },
      entrances: {
        'canary-lab': { x: 103, y: 196, w: 146, h: 82, sign: { x: 176, y: 186, text: 'CANARY LAB' },
                        label: 'Enter the Canary Lab' },
        'eli5':       { x: 355, y: 274, w: 68, h: 92, sign: { x: 388, y: 258, text: 'ELI5 ↓' },
                        label: 'Downstairs to the ELI5 Corner' },
      },
      always: [
        { x: 462, y: 240, w: 82, h: 108, sign: { x: 503, y: 226, text: 'FRONT OFFICE ↑' },
          label: 'Up the escalator to the Front Office (résumé & contact)', action: { go: 'office' } },
        { x: 366, y: 368, w: 166, h: 64, label: 'Toss a coin in the fountain',
          action: { say: 'You toss a coin in the fountain. Wish granted: one (1) interview. That’s how this works, right?' } },
      ],
      soon: [
        { x: 288, y: 200, w: 69, h: 76, sign: { x: 323, y: 196, text: 'SOON' }, title: 'Pipeline Factory' },
        { x: 688, y: 190, w: 70, h: 110, sign: { x: 722, y: 186, text: 'SOON' }, title: 'Listening Booth' },
      ],
    },

    'canary-lab': {
      title: 'Canary Lab',
      art: 'museum/rooms/spaceship.jpg',
      hotspots: [
        { x: 468, y: 282, w: 76, h: 60, label: 'Run the canary analysis', action: { sim: 'canary' } },
        { x: 764, y: 222, w: 82, h: 90, label: 'Canary radar: run the analysis', action: { sim: 'canary' } },
        { x: 212, y: 306, w: 50, h: 40, label: 'Pull the throttle: deploy the canary', action: { sim: 'canary' } },
        { x: 44, y: 88, w: 112, h: 118, label: 'Baseline telemetry: the version in production today', action: { sim: 'canary' } },
        { x: 678, y: 222, w: 80, h: 80, label: 'Mission log (the placard)', action: { placard: 'canary-lab' } },
        { x: 266, y: 228, w: 62, h: 70, label: 'Explain it like I’m 5', action: { eli5: 'canary' } },
        { x: 300, y: 432, w: 174, h: 24, label: 'Floor hatch: back to the lobby', action: { go: 'lobby' } },
      ],
    },

    office: {
      title: 'Front Office',
      art: 'museum/rooms/office.jpg',
      hotspots: [
        { x: 556, y: 328, w: 168, h: 40, label: 'Résumé on the desk (print or save as PDF)', action: { resume: true } },
        { x: 634, y: 256, w: 108, h: 76, label: 'Computer: contact.txt', action: { window: 'contact' } },
        { x: 468, y: 274, w: 58, h: 88, label: 'Globe: About Derek', action: { window: 'about' } },
        { x: 352, y: 290, w: 96, h: 56, label: 'Bookshelf: skills.json', action: { window: 'skills' } },
        { x: 0, y: 250, w: 170, h: 170, label: 'Back to the lobby', action: { go: 'lobby' } },
      ],
    },

    eli5: {
      title: 'ELI5 Corner',
      art: 'museum/rooms/basement.jpg',
      hotspots: [
        { x: 472, y: 240, w: 72, h: 106, label: 'TV: play “What is a canary release?”', action: { eli5: 'canary' } },
        { x: 678, y: 204, w: 158, h: 150, label: 'Old Mac: every ELI5 tape', action: { eli5Index: true } },
        { x: 184, y: 424, w: 120, h: 32, label: 'A VHS tape labeled “next episode” (coming soon)',
          action: { eli5Index: true } },
        { x: 476, y: 118, w: 180, h: 122, label: 'Back upstairs to the lobby', action: { go: 'lobby' } },
      ],
    },
  },

  /* Plain-language explanations ("ELI5 tapes") */
  eli5: {
    canary: {
      title: 'What is a canary release?',
      exhibit: 'canary-lab',
      text: [
        'Imagine you baked a new kind of cookie. Before you give it to the whole class, ' +
        'you let two friends try it while everyone else keeps eating the old cookie.',
        'If your friends love it, everybody gets the new cookie. If they make a yucky face, ' +
        'you throw the new batch away, and nobody else ever had to taste it.',
        'Software teams do the same thing. A few users try the new version first, and ' +
        'computers watch closely to see if anything gets slower or breaks.',
      ],
    },
  },
};

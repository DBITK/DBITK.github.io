/* =============================================================
   MUSEUM EXHIBITS — the content. See docs/MUSEUM.md for what the
   parts of an exhibit mean; the engine that runs them is museum.js.

   Rooms are Derek's renders in museum/rooms/ (web copies; full-size
   originals stay local), with hotspots traced in 860×480 stage coordinates.
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

  /* Music. Encode from the WAV in museum/audio/originals/ (git-ignored):
       ffmpeg -i X.wav -c:a libopus -b:a 128k -vbr on x.ogg
       ffmpeg -i X.wav -c:a aac -b:a 160k -movflags +faststart x.m4a
     loopEnd is the original's exact length (samples ÷ sample rate), so the
     loop never includes encoder padding. A room plays a track by naming it
     in `music`; rooms without one keep the current track going. */
  music: {
    mall: {
      src: ['museum/audio/mall.ogg', 'museum/audio/mall.m4a'],
      loopEnd: 1867765 / 44100,
      volume: 0.55,
    },
    spacechair: {
      src: ['museum/audio/spacechair.ogg', 'museum/audio/spacechair.m4a'],
      loopEnd: 3326400 / 44100,
      volume: 0.55,
    },
  },

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

  /* Rooms. Each hotspot's `poly` is traced around the object in the render
     ([[x, y], ...] in 860×480 stage coordinates = render pixels ÷ 2).
     A plain box ({ x, y, w, h }) also works where no tracing is needed. */
  scenes: {
    /* The mall atrium. Exhibit entrances light up only if the exhibit is
       on the current tour; the Front Office is always open. */
    lobby: {
      title: 'Lobby',
      art: 'museum/rooms/mall.jpg',
      music: 'mall',
      docent: { x: 548, y: 338 },
      entrances: {
        'canary-lab': {
          poly: [[103, 163], [249, 175], [249, 262], [103, 272]],
          sign: { x: 176, y: 186, text: 'CANARY LAB' },
          label: 'Enter the Canary Lab',
        },
        'eli5': {
          poly: [[380, 268], [411, 259], [423, 362], [366, 366]],
          sign: { x: 388, y: 258, text: 'ELI5 ↓' },
          label: 'Downstairs to the ELI5 Corner',
        },
      },
      always: [
        { poly: [[500, 250], [544, 250], [549, 352], [459, 350]],
          sign: { x: 503, y: 226, text: 'FRONT OFFICE ↑' },
          label: 'Up the escalator to the Front Office (résumé & contact)', action: { go: 'office' } },
        { poly: [[368, 410], [395, 386], [433, 380], [440, 350], [465, 348], [473, 380],
                 [508, 386], [543, 410], [530, 440], [450, 448], [373, 438]],
          label: 'Toss a coin in the fountain',
          action: { say: 'You toss a coin in the fountain. Wish granted: one (1) interview. That’s how this works, right?' } },
      ],
      soon: [
        { poly: [[289, 197], [359, 199], [359, 253], [289, 256]],
          sign: { x: 323, y: 196, text: 'SOON' }, title: 'Pipeline Factory' },
        { poly: [[694, 187], [750, 179], [750, 281], [694, 273]],
          sign: { x: 722, y: 186, text: 'SOON' }, title: 'Listening Booth' },
      ],
    },

    'canary-lab': {
      title: 'Canary Lab',
      art: 'museum/rooms/spaceship.jpg',
      music: 'spacechair',
      hotspots: [
        { poly: [[466, 281], [543, 281], [543, 338], [466, 338]],
          label: 'Run the canary analysis', action: { sim: 'canary' } },
        { poly: [[765, 225], [853, 222], [856, 335], [767, 334]],
          label: 'Canary radar: run the analysis', action: { sim: 'canary' } },
        { poly: [[108, 380], [145, 350], [160, 367], [190, 380], [188, 402], [120, 405]],
          label: 'Pull the throttle: deploy the canary', action: { sim: 'canary' } },
        { poly: [[50, 79], [159, 107], [150, 206], [29, 195]],
          label: 'Baseline telemetry: the version in production today', action: { sim: 'canary' } },
        { poly: [[671, 228], [760, 226], [761, 311], [672, 310]],
          label: 'Mission log (the placard)', action: { placard: 'canary-lab' } },
        { poly: [[250, 228], [329, 229], [330, 299], [252, 300]],
          label: 'Explain it like I’m 5', action: { eli5: 'canary' } },
        { poly: [[435, 436], [500, 432], [520, 456], [430, 456]],
          label: 'Floor hatch: back to the lobby', action: { go: 'lobby' } },
      ],
    },

    office: {
      title: 'Front Office',
      art: 'museum/rooms/office.jpg',
      hotspots: [
        { poly: [[553, 352], [570, 349], [650, 333], [722, 342], [660, 366], [651, 370], [632, 384], [555, 375]],
          label: 'Résumé on the desk (print or save as PDF)', action: { resume: true } },
        { poly: [[639, 263], [705, 260], [707, 306], [715, 307], [716, 326], [634, 329], [633, 308], [640, 308]],
          label: 'Computer: contact.txt', action: { window: 'contact' } },
        { poly: [[470, 300], [478, 282], [498, 275], [518, 282], [525, 302], [518, 322], [503, 330],
                 [505, 350], [515, 361], [483, 362], [493, 350], [493, 331], [478, 322]],
          label: 'Globe: About Derek', action: { window: 'about' } },
        { poly: [[353, 300], [447, 285], [449, 332], [356, 350]],
          label: 'Bookshelf: skills.json', action: { window: 'skills' } },
      ],
    },

    eli5: {
      title: 'ELI5 Corner',
      art: 'museum/rooms/basement.jpg',
      hotspots: [
        { poly: [[474, 240], [542, 241], [543, 345], [474, 346]],
          label: 'TV: play “What is a canary release?”', action: { eli5: 'canary' } },
        { poly: [[682, 205], [830, 210], [835, 350], [681, 350]],
          label: 'Old Mac: every ELI5 tape', action: { eli5Index: true } },
        { poly: [[186, 442], [235, 431], [241, 445], [192, 456]],
          label: 'A VHS tape labeled “next episode” (coming soon)', action: { eli5Index: true } },
        { poly: [[548, 120], [652, 85], [652, 280], [550, 295]],
          label: 'Back upstairs to the lobby', action: { go: 'lobby' } },
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

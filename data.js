// data.js — shared mock content for all pages of the UI kit.
// Plain JS (not JSX) so any page can <script src="data.js"> it before Babel.

window.DH_DATA = {
  // --------------------------------------------------------------
  // Brand / global
  // --------------------------------------------------------------
  brand: {
    today_day: 193,
    today_date: '2026-05-13',
    location: 'bangalore',
    booking_url: 'scheduler.zoom.us/sreedeep',
  },

  // --------------------------------------------------------------
  // The Ecosystem — 12 real companies
  // --------------------------------------------------------------
  companies: [
    { name: 'Champions Accelerator',  desc: 'The holding center. 12 ventures, one operating system.',          tag: 'Accelerator' },
    { name: 'Champions Infometrics',  desc: 'Data intelligence for decisions that actually matter.',           tag: 'Data' },
    { name: 'Champions Club',         desc: 'Where founders meet, learn, and stop building alone.',            tag: 'Community' },
    { name: 'Lake B2B',               desc: 'The B2B growth stack. Data, demand, delivery.',                   tag: 'Data & Services' },
    { name: 'SPAN Global Services',   desc: 'Enterprise data and demand generation at scale.',                 tag: 'Data & Services' },
    { name: 'Ampliz',                 desc: 'Healthcare data intelligence. Every hospital, every decision-maker.', tag: 'Healthcare Data' },
    { name: 'IP Momentum',            desc: 'Intellectual property services for companies that build things.', tag: 'IP Services' },
    { name: 'Cirralogix',             desc: 'Cloud infrastructure and DevOps. The pipes under the pipes.',     tag: 'Cloud & DevOps' },
    { name: 'Recruit Champ',          desc: 'AI-powered recruitment. Hire faster, hire smarter.',              tag: 'AI & Recruitment' },
    { name: 'InfraTech',              desc: 'Proptech. Resorts, experiences, real estate with a pulse.',       tag: 'PropTech' },
    { name: 'Champ.fit',              desc: 'Fitness platform. Your body, your data, your plan.',              tag: 'Health & Wellness' },
    { name: 'Health.fit',             desc: 'Health tracking and telemedicine for the next billion.',          tag: 'Health & Wellness' },
  ],

  // --------------------------------------------------------------
  // Journey entries — newest first.
  // arc_color is one of: 'green' (building), 'blue' (thinking), 'gold' (winning).
  // --------------------------------------------------------------
  journey: [
    {
      date: '2026-05-13', day: 193, mood: '🔒',
      shipping_now: 'Shipping the design system for deependhq.com. Gotham Workshop palette locked.',
      yesterday_thread: 'Sales team restructure alignment still settling. Four leads, four brands, one Monday meeting.',
      raw_thought: 'The site is finally becoming real. 193 days of building in public and today the public part gets a home.',
      arcs: ['TheDeepEndHQ'], arc_color: 'green',
    },
    {
      date: '2026-05-12', day: 192, mood: '♟️',
      shipping_now: 'Restructured all 4 sales teams. Phoenix, Assassins, Synergies, Prodigies. Aligned leadership.',
      yesterday_thread: 'Charles Michel OCM partnership docs still in review.',
      raw_thought: 'Four sales teams, four leaders, one operating rhythm. Monday meetings just got interesting.',
      arcs: ['Champions Operations'], arc_color: 'blue',
    },
    {
      date: '2026-05-11', day: 191, mood: '🤖',
      shipping_now: 'ChampOps triage engine running clean. Jules auto-fixed 3 UI issues overnight.',
      yesterday_thread: '',
      raw_thought: 'Zero manual intervention. The feedback widget catches it, the triage engine clusters it, Jules fixes it. This is the loop.',
      arcs: ['ChampOps'], arc_color: 'green',
    },
    {
      date: '2026-05-10', day: 190, mood: '🎯',
      shipping_now: 'Lake B2B growth stack positioning locked. "Enabling Growth" is the promise. The stack is the proof.',
      yesterday_thread: 'SEO team restructure pilot on SGS wrapping up.',
      raw_thought: 'We finally stopped saying "we sell data" and started saying "we are your growth stack." Took 6 months.',
      arcs: ['Lake B2B', 'Content Strategy'], arc_color: 'gold',
    },
    {
      date: '2026-05-09', day: 189, mood: '📡',
      shipping_now: 'AI-era SEO content principles codified. FAQ schema is dead. 3-Question Framework is the replacement.',
      yesterday_thread: 'Preeti and the SEO core team testing headless model on SPAN.',
      raw_thought: 'Optimize for AI recommendation, not just indexing. The game changed and most teams have not noticed.',
      arcs: ['SEO Strategy'], arc_color: 'blue',
    },
    {
      date: '2026-05-08', day: 188, mood: '🤝',
      shipping_now: 'Cirralogix restructuring complete. Yoga, Umasum, Ramya retained. One-year commitments signed.',
      yesterday_thread: 'Ranch productization v1 ICP finalized. Tech/SaaS + K-12.',
      raw_thought: 'Retention conversations are harder than hiring conversations. But keeping the right three people beats replacing six.',
      arcs: ['Cirralogix', 'Champions Operations'], arc_color: 'gold',
    },
    {
      date: '2026-05-07', day: 187, mood: '🚀',
      shipping_now: "Chief's directive: 20 growth marketers, new channels beyond email, $3K/mo budget unlocked.",
      yesterday_thread: '',
      raw_thought: 'When the boss says "move faster," you do not ask twice. AI SDR stack testing just became urgent.',
      arcs: ['Champions Operations', 'Champ IQ'], arc_color: 'blue',
    },
    {
      date: '2026-05-06', day: 186, mood: '🌍',
      shipping_now: 'Charles Michel OCM partnership structure drafted. EU-India 50/50 JV.',
      yesterday_thread: 'Daily social triage system live. 5 PM IST: like, comment, triage DMs, auto-send Zoom links.',
      raw_thought: 'An ex-President of the European Council wants to partner on India market entry. This is not a normal Tuesday.',
      arcs: ['Champions Operations'], arc_color: 'gold',
    },
    {
      date: '2026-05-05', day: 185, mood: '⚡',
      shipping_now: 'Social triage automation deployed. Auto-Zoom-link to prospects who DM. Vault notes at Atlas/Social Triage/.',
      yesterday_thread: 'Ranch hybrid pricing model approved by Sunil.',
      raw_thought: 'Every DM from a prospect now gets a Zoom link within the hour. No human in the loop. Just the bot and the calendar.',
      arcs: ['ChampOps', 'Social Automator'], arc_color: 'green',
    },
    {
      date: '2026-05-04', day: 184, mood: '🏔️',
      shipping_now: 'Champions Ranch productization v1 done. ICP locked: Tech/SaaS + K-12. Diksha as flagship anchor.',
      yesterday_thread: '',
      raw_thought: 'Turning a resort into a product is a strange kind of product management. But the ICP framework works everywhere.',
      arcs: ['InfraTech', 'Champions Operations'], arc_color: 'blue',
    },
  ],

  // --------------------------------------------------------------
  // How I Think — POV takes
  // --------------------------------------------------------------
  takes: [
    {
      title: 'The AI SDR is not a chatbot.',
      hook:  "Everyone's building AI that talks. We're building AI that sells. There's a difference.",
      tag: 'AI & GTM', color: 'blue',
    },
    {
      title: 'Why I run 12 companies from one vault.',
      hook: 'One Obsidian graph. 12 companies. Zero context-switching tax. Here is how.',
      tag: 'Operating', color: 'green',
    },
    {
      title: 'Data is not a product. Growth is.',
      hook: 'Lake B2B does not sell data. It sells pipeline. The data is just the engine.',
      tag: 'Positioning', color: 'gold',
    },
  ],

  // --------------------------------------------------------------
  // Proof — receipts
  // --------------------------------------------------------------
  proof: [
    'Built an AI SDR stack that books meetings while the sales team sleeps. 90-day experiment, live pipeline.',
    'Took Lake B2B from "we sell data" to "we are the B2B growth stack." Category creation, not product marketing.',
  ],

  // --------------------------------------------------------------
  // Weekly narrative — currently in week 28 (day 190–196). Latest shipped narrative is week 27.
  // 193 days / 7 = 27 full weeks shipped.
  // --------------------------------------------------------------
  weekly_narratives_count: 27,
  latest_narrative: {
    week: 27,
    title: 'Week 27. The growth stack stops being a slogan.',
    body: 'Six months of saying "we sell data" turned into one Monday meeting where everyone stopped. Lake B2B does not sell data. It sells pipeline. We sell the whole stack: data, demand, delivery. The repositioning landed in a single conversation with Charles and the Assassins. The hard part was not the language. The hard part was the six months of saying it wrong first.',
    day_range: 'Day 187\u2013193',
    date: '2026-05-13',
    read: '6 min read',
  },

  // --------------------------------------------------------------
  // Live status / ticker — the "top" output strip under the hero
  // --------------------------------------------------------------
  status: {
    location:   'Bangalore, IN',
    time_ist:   '02:14 IST',
    weather:    '24°C · clear',
    last_ship:  'EmDash sync layer · 23 min ago',
    vault_commits: 14,
    listening:  'Bonobo · Migration',
    reading:    'The Power Broker · Caro',
    drinking:   'Bangalore peaberry · pour-over · cup 3',
    state:      'shipping',
    uptime_d:   47,
    coffee:     3,
  },

  // --------------------------------------------------------------
  // Now / Recently / Soon — the disciplined kanban
  // --------------------------------------------------------------
  status_board: {
    now: [
      { text: 'Wiring EmDash content layer into TheDeepEndHQ.',          tag: 'TheDeepEndHQ' },
      { text: 'Onboarding 20 growth marketers across four brands.',      tag: 'Champions Ops' },
      { text: 'ChampGraph schema cleanup for AI SDR v2.',                tag: 'AI SDR' },
      { text: 'Charles Michel OCM partnership · contract red-line.',     tag: 'EU-India JV' },
    ],
    recently: [
      { text: 'Restructured all 4 sales teams. Phoenix, Assassins, Synergies, Prodigies.', tag: 'shipped d192' },
      { text: 'ChampOps triage loop. Zero manual intervention since day 188.',             tag: 'shipped d191' },
      { text: 'Lake B2B growth-stack positioning locked.',                                 tag: 'shipped d190' },
      { text: 'AI-era SEO content principles. 3-Question Framework.',                      tag: 'shipped d189' },
    ],
    soon: [
      { text: 'AI SDR live pipeline test. 90-day clock starts when ChampGraph clears.',    tag: 'next week' },
      { text: 'Champions Ranch v1 launch. Diksha as the flagship anchor.',                 tag: 'd200' },
      { text: 'Bangalore founders dinner. The first one in person.',                       tag: 'May 23' },
      { text: 'Weekly narrative · week 28 · "the four-team monday."',                      tag: 'Sunday' },
    ],
  },

  // --------------------------------------------------------------
  // The stack — colophon
  // --------------------------------------------------------------
  stack: [
    { layer: 'Frontend',  what: 'Next.js 15 · Tailwind v4 · Framer Motion · GSAP · Lucide' },
    { layer: 'Content',   what: 'EmDash on Astro · ChampCMS plugin isolates' },
    { layer: 'Edge',      what: 'Cloudflare Pages · D1 · R2 · KV · Workers' },
    { layer: 'Vault',     what: 'Obsidian · Celsus · 12 companies, one graph' },
    { layer: 'AI',        what: 'Anthropic · Jules · ChampGraph · ChampMail' },
    { layer: 'Type',      what: 'Fraunces · Inter · JetBrains Mono' },
    { layer: 'Color',     what: 'Gotham, Matrix, Arc, Champion gold, Bone' },
    { layer: 'Built at',  what: '02:14 IST · usually · between meetings' },
  ],

  // --------------------------------------------------------------
  // The off-hours — non-work life surface
  // --------------------------------------------------------------
  off_hours: [
    { what: 'Riding',     detail: 'the gray mare. Bangalore Turf Club. Sundays at sunrise.' },
    { what: 'Jiu-jitsu',  detail: 'purple belt. Two mornings a week. Still terrible at takedowns.' },
    { what: 'Gaming',     detail: 'Civ, Crusader Kings, anything 4X. One more turn at 2 AM.' },
    { what: 'Cooking',    detail: 'hunting the perfect sambar. 47 attempts, 0 finals.' },
    { what: 'Reading',    detail: 'Caro, Iyer, Naipaul. Long books for long flights.' },
  ],

  // --------------------------------------------------------------
  // The rolodex — open invitations
  // --------------------------------------------------------------
  rolodex: [
    { who: 'Founders past the hype cycle',           how: 'book a 30-min · no decks' },
    { who: 'Operators running 5+ teams',             how: 'sync notes over coffee' },
    { who: 'AI engineers shipping real agents',      how: 'trade architecture diagrams' },
    { who: 'Horse people in Bangalore',              how: 'find me on a Sunday' },
    { who: 'Anyone with a better sambar recipe',     how: 'come over for dinner' },
  ],

  // --------------------------------------------------------------
  // The dispatch — newsletter teaser
  // --------------------------------------------------------------
  dispatch: {
    cadence:   'Every Sunday · 06:00 IST',
    read_time: '~3 minutes',
    subs:      1247,
    sample: [
      'Week 27 · The growth stack stops being a slogan.',
      'Week 26 · Four teams, four leaders, one Monday.',
      'Week 25 · The day Jules fixed three bugs while I slept.',
    ],
  },

  // --------------------------------------------------------------
  // Lexicon — recurring terms (Field Notes)
  // --------------------------------------------------------------
  lexicon: [
    { term: 'The Chief',         def: 'Dad. Group patriarch. Source of directives and unlocked budgets.' },
    { term: 'The Vault',         def: 'A single Obsidian graph holding all 12 companies. The brain.' },
    { term: 'Ship the loop',     def: 'Build the system that does the task, not the task itself.' },
    { term: 'The Assassins',     def: 'Lake B2B + Ampliz sales team. Run by Charles.' },
    { term: 'Day N',             def: 'Days since the public build started. Day 1 was Nov 1, 2025.' },
    { term: '>_',                def: 'Terminal prompt. The closest thing this site has to a logo.' },
    { term: 'ChampOps',          def: 'Autonomous feedback-to-fix loop. Widget → triage → Jules → deploy.' },
    { term: 'The Growth Stack',  def: 'Lake B2B repositioning. Data + demand + delivery. Not "we sell data."' },
  ],

  // --------------------------------------------------------------
  // Recurring locations (Field Notes)
  // --------------------------------------------------------------
  locations: [
    { name: 'The Workshop',     where: 'Bangalore, IN',         what: 'Home office. Standing desk, two monitors, one cat.' },
    { name: 'Champions Ranch',  where: 'Karnataka countryside', what: 'The product-not-a-resort. Founder retreats start here.' },
    { name: 'The Turf Club',    where: 'Bangalore',             what: 'Sunday mornings. Where the gray mare lives.' },
    { name: 'Atlas',            where: 'inside the vault',      what: 'The MOC. Map of Content. Every project starts and ends here.' },
  ],

  // --------------------------------------------------------------
  // Toolkit
  // --------------------------------------------------------------
  toolkit: [
    { title: 'ChampUTM',          description: 'UTM link builder and tracker. React/Vite. Open source.',                                      url: 'https://github.com/Champ-Deep/ChampUTM', category: 'tool',     featured: true  },
    { title: 'ChampMail',         description: 'Email outreach automation with human-cadence sending and Stalwart SMTP.',                     url: '#',                                       category: 'tool',     featured: true  },
    { title: 'ChampOps',          description: 'Autonomous feedback triage and maintenance loop. Widget to GitHub to Jules to deploy.',       url: '#',                                       category: 'tool',     featured: true  },
    { title: 'ChampGraph',        description: 'Knowledge graph per prospect. Neo4j/FalkorDB. The brain behind the AI SDR.',                  url: '#',                                       category: 'tool',     featured: false },
    { title: 'Social Automator',  description: 'Auto-triage DMs, auto-send Zoom links, daily social hygiene at 5 PM IST.',                    url: '#',                                       category: 'tool',     featured: false },
    { title: 'thedeependhq',      description: 'This site. Next.js 15 + Cloudflare Workers + EmDash CMS.',                                    url: 'https://github.com/Champ-Deep/thedeependhq', category: 'repo',  featured: true  },
    { title: 'ChampCMS (EmDash)', description: 'Full-stack Astro CMS on Cloudflare. D1, R2, passkeys, TipTap, plugin isolates.',              url: 'https://github.com/Champ-Deep/ChampCMS', category: 'repo',     featured: true  },
    { title: 'Morning Routine Orchestrator', description: 'Multi-skill AI chain: vault hygiene, email triage, energy quiz, day planner.',     url: '#',                                       category: 'skill',    featured: true  },
    { title: 'CLF Meeting Prep',  description: 'Champions Leadership Framework. SPIN-driven pitch prep across all 4 brands.',                 url: '#',                                       category: 'skill',    featured: false },
    { title: 'B2B Blog Writer',   description: 'Full-pipeline skill: trending topic to authoritative thought-leadership post.',               url: '#',                                       category: 'skill',    featured: false },
    { title: 'Sprint Mode',       description: 'Autonomous time-boxed task execution. Give it hours, get back results.',                      url: '#',                                       category: 'skill',    featured: true  },
    { title: 'Vault Keeper',      description: 'Unified Obsidian vault maintenance. Wikilinks, orphan elimination, MOC updates.',             url: '#',                                       category: 'skill',    featured: false },
    { title: "The Champion's Promise",       description: "Core operating philosophy. \"Time is the only currency that can't be refilled.\"", url: '#',                                       category: 'resource', featured: true  },
    { title: 'CHAMP Brainstorming Framework', description: 'Customer, Hypothesis, Approach, Market, Pivot. Structured ideation for any concept.', url: '#',                                  category: 'resource', featured: false },
    { title: 'Celsus (Second Brain)', description: 'Obsidian vault as knowledge graph. 12 companies, one vault, zero context-switching.',     url: '#',                                       category: 'resource', featured: true  },
  ],

  // --------------------------------------------------------------
  // Field Notes
  // --------------------------------------------------------------
  characters: [
    { name: 'The Chief',  initials: 'TC', role: 'Dad / Group patriarch',          since: 1,   status: 'active',  blurb: 'Makes directives. Unlocks budgets. Keeps everyone honest.' },
    { name: 'Charles',    initials: 'CH', role: 'Team lead, Assassins',           since: 12,  status: 'active',  blurb: 'Runs the Lake B2B + Ampliz sales engine.' },
    { name: 'Gary',       initials: 'GR', role: 'Head of Sales, SPAN/Phoenix',    since: 30,  status: 'active',  blurb: 'Weekly syncs. Pipeline obsessed.' },
    { name: 'Jules',      initials: 'JU', role: 'AI coding agent',                since: 150, status: 'active',  blurb: 'Picks up GitHub issues automatically. Never complains.' },
    { name: 'Murugan',    initials: 'MU', role: 'Nurturing Specialist, Phoenix',  since: 45,  status: 'active',  blurb: 'The quiet closer.' },
  ],

  plotlines: [
    { title: 'The AI SDR Experiment',         status: 'Rising Action', since: 60,  desc: 'Can an AI stack replace a human SDR? 90-day test on SPAN. Champmail done. ChampGraph is the last blocker.' },
    { title: 'The Growth Stack Pivot',        status: 'Climax',        since: 120, desc: 'Lake B2B stops selling data, starts selling growth. Category creation in progress.' },
    { title: 'Building in Public',            status: 'Rising Action', since: 1,   desc: 'This entire site. The meta-arc.' },
    { title: 'The Restructure',               status: 'Resolution',    since: 170, desc: 'Four sales teams, four leaders, one operating rhythm. Shipped.' },
    { title: 'ChampOps: The Autonomous Loop', status: 'Rising Action', since: 140, desc: 'Feedback widget to triage to Jules to deploy. Zero-human maintenance.' },
  ],

  themes: [
    'Automate the boring, narrate the interesting. The ChampOps philosophy applied to everything.',
    'Category creation beats feature competition. Lake B2B growth stack, not "better data."',
    'Retention beats hiring. Keeping Yoga, Umasum, Ramya beat replacing them 2x over.',
    'The vault is the brain. One Obsidian graph for 12 companies. Structure IS strategy.',
    'Ship the loop, not the feature. ChampOps, social triage, morning routine. Systems, not tasks.',
  ],

  callbacks: [
    { from: 193, to: 1,   text: 'TheDeepEndHQ design',           target: 'the decision to build in public' },
    { from: 190, to: 120, text: 'Growth Stack positioning',      target: 'first "we sell growth, not data" meeting' },
    { from: 188, to: 92,  text: 'Cirralogix retention',          target: 'first restructuring conversation' },
    { from: 191, to: 140, text: 'ChampOps zero-intervention',    target: 'first widget deployment' },
  ],
};

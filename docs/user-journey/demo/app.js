(() => {
  'use strict';

  /* ==========================================================================
     AUTHORED SVG ICON LIBRARY (consistent 1.8px stroke, zero emoji)
     ========================================================================== */
  const ICONS = {
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    orgs: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    events: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    qr: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 18v3"/></svg>',
    certs: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
    manage: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    scan: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
    review: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>',
    metrics: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-6"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chevron: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    chevronDown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    checkCircle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    mail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    key: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5 19 11"/></svg>',
    pin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    flip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    megaphone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    image: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
    form: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    shield: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
  };

  /* Clean deterministic QR SVG (opaque signed token visual, no PII) */
  function renderQrSvg() {
    const pattern = [
      '111111101011001111111',
      '100000100100101000001',
      '101110101101001011101',
      '101110100010101011101',
      '101110101011001011101',
      '100000101100101000001',
      '111111101010101111111',
      '000000000110000000000',
      '101101110010110101101',
      '010010001101001010010',
      '110110111011011011001',
      '001001000100100100110',
      '101110110110111010101',
      '000000001001010001010',
      '111111100110101011101',
      '100000101001010001000',
      '101110101110111110111',
      '101110100010001010010',
      '101110101101110101101',
      '100000100100101010001',
      '111111101011010110111'
    ];
    let rects = '';
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] === '1') {
          rects += `<rect x="${c * 7}" y="${r * 7}" width="7" height="7" rx="1"/>`;
        }
      }
    }
    return `<svg width="147" height="147" viewBox="0 0 147 147" fill="#181C23" role="img" aria-label="Permanent signed QR code">${rects}</svg>`;
  }

  /* ==========================================================================
     SCREEN CATALOG (9 Student + 5 Org Officer = 14 Screens)
     ========================================================================== */
  const SCREENS = [
    {
      id: 's1', persona: 'student', num: 1, stage: 'Onboard', title: 'Sign up', fr: 'FR-AUTH-01',
      desc: 'Institutional email + password signup. The @lpunetwork.edu.ph domain is enforced by the server-side Supabase Auth Hook, not just client validation.',
      hints: ['Edit the email to test @lpunetwork.edu.ph domain validation', 'Click "Send verification code" to step into OTP verification']
    },
    {
      id: 's2', persona: 'student', num: 2, stage: 'Onboard', title: 'Verify 6-digit code', fr: 'FR-AUTH-01/02',
      desc: 'Mandatory 6-digit OTP delivered via Resend SMTP. Verification provisions the Student profile and permanent opaque QR token.',
      hints: ['Type digits into the 6-box OTP strip', 'Click "Verify and continue" to open the Student Home feed']
    },
    {
      id: 's3', persona: 'student', num: 3, stage: 'Discover', title: 'Home feed', fr: 'FR-DEPT-02 · FR-CERT-05',
      desc: 'Department-wide and joined-org announcements with expiry dates, registered event shortcuts, and a content-free key-ready alert linking to My Keys.',
      hints: ['Filter announcements by All, Department, or My orgs', 'Tap the GMetrix alert banner to jump directly to My Keys']
    },
    {
      id: 's4', persona: 'student', num: 4, stage: 'Discover', title: 'Org page + sub-orgs', fr: 'FR-ORG-01/02',
      desc: 'Simplified read-only org page with cover, crest, details, chronological posts (no likes/comments), and nested Sub-Orgs with independent apply states.',
      hints: ['Tap "Apply" on Web Dev Guild to open its conditional form', 'Tap "Events" to jump to the upcoming Hack Night event']
    },
    {
      id: 's5', persona: 'student', num: 5, stage: 'Discover', title: 'Apply (conditional form)', fr: 'FR-ORG-03 · FR-FORM-01',
      desc: 'All four MVP field types (short_text, single_choice, multi_choice, rating_1_5) with 1-level visibleIf conditional branching.',
      hints: ['Toggle "Have you built a website before?" between Yes and No to watch the conditional field appear/hide', 'Submit the form to see Pending status']
    },
    {
      id: 's6', persona: 'student', num: 6, stage: 'Attend', title: 'Event + attendance rules', fr: 'FR-EVT-01/03',
      desc: 'Clear onsite attendance rules (Present / Late / Absent windows and auto check-out duration) shown before arrival, with instant access to the student QR ID.',
      hints: ['Inspect the tri-color attendance window breakdown', 'Tap "Show my QR" to pull up the lanyard badge']
    },
    {
      id: 's7', persona: 'student', num: 7, stage: 'Attend', title: 'My QR ID (lanyard badge)', fr: 'FR-ATT-01',
      desc: 'Permanent opaque signed token displayed on a campus ID lanyard. Works offline with zero PII inside the QR payload; flips to show recent attendance.',
      hints: ['Tap "Flip card" for the 3D lanyard turn to recent attendance', 'Tap "Max brightness" to boost contrast for dim auditorium doors']
    },
    {
      id: 's8', persona: 'student', num: 8, stage: 'Certify', title: 'My Keys & Directory', fr: 'FR-CERT-01/05',
      desc: 'GMetrix keys remain masked until explicitly revealed inside the authenticated view; push alerts never carry raw keys. Certification directory below.',
      hints: ['Click "Reveal key" to unmask the GMetrix code', 'Click "Copy key" or switch between My Keys and Directory']
    },
    {
      id: 's9', persona: 'student', num: 9, stage: 'Feedback', title: 'Post-event evaluation', fr: 'FR-FORM-02',
      desc: 'Attendee-only evaluation form submitted once per event. Answering "No" dynamically reveals a conditional follow-up text question.',
      hints: ['Select "No" on "Would you join a follow-up workshop?" to trigger the visibleIf follow-up field', 'Submit feedback to see the once-per-form lock']
    },
    {
      id: 'o1', persona: 'officer', num: 1, stage: 'Prepare', title: 'Manage org', fr: 'FR-ATT-03',
      desc: 'Officer hub with multi-org switcher, offline readiness card (rules, cached display roster, server clock offset), and one-tap switch back to Student view.',
      hints: ['Tap the org switcher to toggle between Web Dev Guild and CCS Student Council', 'Tap "Open scanner" or "Student view"']
    },
    {
      id: 'o2', persona: 'officer', num: 2, stage: 'Prepare', title: 'Create event + rules', fr: 'FR-EVT-01/02/03',
      desc: 'Create Onsite events (on-time grace, late window, cooldown, auto check-out with live timeline) or swap to Online mode with a validated meeting link.',
      hints: ['Toggle between Onsite and Online to see the rules swap to a meeting link', 'Edit Grace or Late minutes to watch the timeline recalculate']
    },
    {
      id: 'o3', persona: 'officer', num: 3, stage: 'Run the door', title: 'Offline QR scanner', fr: 'FR-ATT-02/04/05',
      desc: 'Dark auditorium door scanner writing idempotently to local SQLite first. Uses server-adjusted clock offset and handles check-in, late, cooldown, check-out, and invalid codes.',
      hints: ['Tap the simulation pills (Present, Late, Cooldown, Check-out, Invalid) to test every scan state and live queue counter']
    },
    {
      id: 'o4', persona: 'officer', num: 4, stage: 'Grow', title: 'Review applicants', fr: 'FR-ORG-03',
      desc: 'Inspect conditional membership answers (with visibleIf answers flagged) and approve or reject applicants off the Pending queue.',
      hints: ['Approve or Reject Ana Lim to move her off Pending and update tab counts', 'Switch between Pending, Approved, and Rejected tabs']
    },
    {
      id: 'o5', persona: 'officer', num: 5, stage: 'Learn', title: 'Evaluation metrics', fr: 'FR-FORM-03',
      desc: 'Aggregated host evaluation metrics computed via PostgreSQL view/RPC: response rate, rating distribution, option splits, and free-text feedback.',
      hints: ['Inspect the 4.2/5 rating spread, workshop follow-up split, and text feedback rows']
    }
  ];

  const VARIATIONS = {
    'ccs-crest': {
      name: 'CCS Crest (Department Palette)',
      short: 'CCS Crest',
      desc: 'Derived from the official CCS crest: Deep Crest Navy (#0B2E59), Circuit Royal Blue (#0052CC), Shield Cyan (#0EA5E9), and Laurel Gold (#D4A500) with stacked deck cards and full-pill CTAs.'
    },
    editorial: {
      name: 'Editorial Color-Block Deck',
      short: 'Editorial',
      desc: 'Pure white gallery canvas, stacked cobalt/violet/magenta color-block decks (24px), ink-black full-pill CTAs, and underline category tabs.'
    },
    cobalt: {
      name: 'Cobalt Utility (PDF Baseline)',
      short: 'Cobalt PDF',
      desc: 'Crisp slate-white utility cards, CCS Cobalt Blue (#1F4FD8) actions, midnight navy door scanner, and hairline 1px dividers.'
    },
    passbook: {
      name: 'Campus Lanyard & Passbook',
      short: 'Passbook',
      desc: 'Warm ivory registrar card stock (#F7F5F0), LPU Burgundy ink (#8C1D2C), graphite typography, and dark anodized slate scanner.'
    },
    concourse: {
      name: 'Concourse Instrument',
      short: 'Concourse',
      desc: 'High-contrast architectural chalk, 1.5px jet-black rules, sharp 5px corners, safety-orange signal accent, and monospace status pills.'
    }
  };

  const CREST_ART_SVG = `<svg width="62" height="62" viewBox="0 0 110 110" fill="none" aria-hidden="true" style="flex-shrink:0;">
    <rect x="20" y="16" width="68" height="76" rx="18" fill="#18181B" fill-opacity="0.92"/>
    <rect x="26" y="22" width="56" height="64" rx="13" fill="#F4F4F5"/>
    <path d="M39 45L49 54L39 63" stroke="#18181B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="56" y1="63" x2="70" y2="63" stroke="#18181B" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="88" cy="22" r="8" fill="#FFFFFF"/>
    <circle cx="88" cy="22" r="3.5" fill="#18181B"/>
  </svg>`;

  /* ==========================================================================
     INTERACTIVE APPLICATION STATE
     ========================================================================== */
  const state = {
    variation: 'ccs-crest',
    screenId: 's1',
    toast: null,
    // Student 1 & 2
    email: 'juan.delacruz@lpunetwork.edu.ph',
    otp: ['4', '8', '2', '0', '', ''],
    // Student 3
    feedFilter: 'all',
    // Student 4 & 5
    applyOrg: { id: 'guild', name: 'Web Dev Guild', sub: 'Sub-org of CCS Student Council' },
    appSection: 'BSIT 2-1',
    appBuiltSite: 'Yes',
    appPortfolio: 'github.com/juandc',
    appTracks: new Set(['Frontend', 'Backend']),
    appGitRating: 3,
    appSubmitted: false,
    // Student 7
    qrFlipped: false,
    qrBright: false,
    // Student 8
    certTab: 'keys',
    revealedKeys: new Set(),
    // Student 9
    evalRating: 4,
    evalFollowup: 'Yes',
    evalWhyNot: '',
    evalUseful: new Set(['Live demo', 'Hands-on exercise']),
    evalSubmitted: false,
    // Officer 1
    orgIndex: 0,
    orgs: [
      { code: 'WD', name: 'Web Dev Guild', role: 'Sub-org · You\'re President · 1 of 2 orgs', event: 'Hack Night is ready for offline scanning', eventTitle: 'Hack Night · Door A', roster: 42, offset: '+1.2 s', checkedIn: 41, checkedOut: 6, toSync: 12 },
      { code: 'SC', name: 'CCS Student Council', role: 'Main org · You\'re Secretary · 2 of 2 orgs', event: 'General Assembly is ready for offline scanning', eventTitle: 'General Assembly · Main Hall', roster: 148, offset: '+0.8 s', checkedIn: 94, checkedOut: 14, toSync: 19 }
    ],
    // Officer 2
    evtTitle: 'Hack Night: Intro to Supabase',
    evtModality: 'onsite',
    evtGrace: 15,
    evtLate: 5,
    evtCooldown: 60,
    evtAutoOut: 180,
    evtLink: 'https://meet.google.com/ccs-hack-night',
    // Officer 3
    scannerEvent: { title: 'Hack Night · Door A', org: 'Web Dev Guild', offset: '+1.2 s' },
    scanMode: 'present',
    checkedIn: 41,
    checkedOut: 6,
    toSync: 12,
    writtenScans: new Set(),
    scanRepeatNotice: '',
    // Officer 4
    applicantTab: 'pending',
    expandedApplicantId: 'a1',
    applicants: [
      { id: 'a1', initials: 'AL', color: 'ochre', name: 'Ana Lim', applied: 'Nov 23', status: 'pending', section: 'BSCS 1-2', built: 'Yes', link: 'ana-lim.dev', tracks: 'Frontend, UI/UX', git: '4 of 5' },
      { id: 'a2', initials: 'PR', color: 'dark', name: 'Paolo Reyes', applied: 'Nov 22', status: 'pending', section: 'BSIT 2-2', built: 'No', link: '', tracks: 'Backend, DevOps', git: '3 of 5' },
      { id: 'a3', initials: 'KS', color: 'brand', name: 'Kim Santos', applied: 'Nov 22', status: 'pending', section: 'BSCS 2-1', built: 'Yes', link: 'github.com/kimsantos', tracks: 'Frontend, Backend', git: '5 of 5' },
      { id: 'a4', initials: 'JG', color: 'teal', name: 'Jose Garcia', applied: 'Nov 21', status: 'pending', section: 'BSIT 1-1', built: 'No', link: '', tracks: 'UI/UX', git: '2 of 5' },
      { id: 'a5', initials: 'MR', color: 'dark', name: 'Mika Ramos', applied: 'Nov 21', status: 'pending', section: 'BSCS 3-1', built: 'Yes', link: 'mikaramos.ph', tracks: 'Backend', git: '4 of 5' },
      { id: 'a6', initials: 'DC', color: 'teal', name: 'Diego Cruz', applied: 'Nov 19', status: 'approved', section: 'BSIT 3-1', built: 'Yes', link: 'diegocruz.io', tracks: 'DevOps, Backend', git: '5 of 5' },
      { id: 'a7', initials: 'LT', color: 'brand', name: 'Lia Tan', applied: 'Nov 18', status: 'rejected', section: 'BSIT 1-2', built: 'No', link: '', tracks: 'Frontend', git: '1 of 5' }
    ]
  };

  function hasOwnVariation(v) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(VARIATIONS, v);
  }

  function isValidInstitutionalEmail(val, inputEl) {
    const trimmed = String(val || '').trim();
    const matchesDomain = /^[^\s@]+@lpunetwork\.edu\.ph$/i.test(trimmed);
    const nativeValid = inputEl ? inputEl.checkValidity() : true;
    return matchesDomain && nativeValid;
  }

  function isValidMeetingLink(val) {
    return /^https:\/\/(meet\.google\.com|zoom\.us|teams\.microsoft\.com)\//i.test(String(val || '').trim());
  }

  function formatEventOffset(minutesFromStart) {
    const startMins = 17 * 60; // 5:00 PM
    const total = startMins + Math.max(0, Number(minutesFromStart) || 0);
    const hr24 = Math.floor(total / 60) % 24;
    const hr12 = hr24 % 12 || 12;
    const min = String(total % 60).padStart(2, '0');
    return `${hr12}:${min}`;
  }

  let toastTimer = null;
  function renderToast() {
    if (!els.phoneToast) return;
    els.phoneToast.innerHTML = state.toast
      ? `<div class="toast" role="status"><span>${escapeHtml(state.toast)}</span></div>`
      : '';
  }

  function showToast(msg) {
    state.toast = msg;
    renderToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      state.toast = null;
      renderToast();
    }, 2600);
  }

  function currentScreen() {
    return SCREENS.find((s) => s.id === state.screenId) || SCREENS[0];
  }

  function goTo(id) {
    state.screenId = id;
    state.toast = null;
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(null, '', `#${id}`);
    }
    renderAll();
  }

  /* ==========================================================================
     BOTTOM NAVIGATION BARS
     ========================================================================== */
  function renderStudentNav(active) {
    const tabs = [
      { key: 'home', label: 'Home', icon: ICONS.home, target: 's3' },
      { key: 'orgs', label: 'Orgs', icon: ICONS.orgs, target: 's4' },
      { key: 'events', label: 'Events', icon: ICONS.events, target: 's6' },
      { key: 'qr', label: 'My QR', icon: ICONS.qr, target: 's7' },
      { key: 'certs', label: 'Certs', icon: ICONS.certs, target: 's8' }
    ];
    return `
      <nav class="bottom-nav" aria-label="Student navigation">
        ${tabs.map((t) => `
          <button type="button" class="tab-btn" data-nav="${t.target}" ${active === t.key ? 'aria-current="page"' : ''}>
            ${t.icon}<span>${t.label}</span>
          </button>`).join('')}
      </nav>`;
  }

  function renderOfficerNav(active) {
    const tabs = [
      { key: 'manage', label: 'Manage', icon: ICONS.manage, target: 'o1' },
      { key: 'events', label: 'Events', icon: ICONS.events, target: 'o2' },
      { key: 'scan', label: 'Scan', icon: ICONS.scan, target: 'o3' },
      { key: 'review', label: 'Review', icon: ICONS.review, target: 'o4' },
      { key: 'metrics', label: 'Metrics', icon: ICONS.metrics, target: 'o5' }
    ];
    return `
      <nav class="bottom-nav" aria-label="Officer navigation">
        ${tabs.map((t) => `
          <button type="button" class="tab-btn" data-nav="${t.target}" ${active === t.key ? 'aria-current="page"' : ''}>
            ${t.icon}<span>${t.label}</span>
          </button>`).join('')}
      </nav>`;
  }

  /* ==========================================================================
     SCREEN RENDERERS (14 SCREENS)
     ========================================================================== */
  function renderScreenHtml(id) {
    switch (id) {
      /* --- S1: SIGN UP --- */
      case 's1': {
        const validDomain = isValidInstitutionalEmail(state.email);
        return `
          <div class="screen-scroll">
            <div class="ed-deck-wrap">
              <div class="ed-deck-peek-back" aria-hidden="true"></div>
              <div class="ed-deck-peek-mid" aria-hidden="true"></div>
              <div class="ed-deck-card">
                <div>
                  <span style="display:inline-block;padding:2px 9px;border-radius:999px;background:rgba(255,255,255,0.2);font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">MyCCS</span>
                  <div style="font-size:14px;font-weight:700;line-height:1.25;letter-spacing:-0.01em;">College of Information Technology<br/>&amp; Computer Science</div>
                  <div style="font-size:11px;opacity:0.85;margin-top:3px;">IT · CS · LIS</div>
                </div>
                ${CREST_ART_SVG}
              </div>
            </div>

            <div class="default-brand-header" style="display:flex;align-items:center;gap:11px;margin-top:8px;">
              <div class="ccs-mark ccs-mark--lg">CCS</div>
              <div>
                <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;">MyCCS</div>
                <div style="font-size:11.5px;color:var(--ink-secondary);">College of IT &amp; Computer Science</div>
              </div>
            </div>

            <div style="margin-top:6px;">
              <h1 class="screen-h1">Create your account</h1>
              <p class="screen-lead">Sign up with your LPU Network email. We'll send a 6-digit code to confirm it's you.</p>
            </div>

            <div style="display:flex;flex-direction:column;gap:14px;">
              <label class="field">
                <span class="field-label">Institutional email</span>
                <input class="input ${validDomain ? '' : 'input--invalid'}" id="signupEmail" type="email" required value="${escapeAttr(state.email)}" aria-invalid="${!validDomain}" aria-describedby="signupEmailHint" autocomplete="off" />
                <span id="signupEmailHint" class="field-hint ${validDomain ? 'field-hint--ok' : 'field-hint--err'}">
                  ${ICONS.check}
                  <span id="signupEmailHintText">${validDomain ? 'Only @lpunetwork.edu.ph addresses can sign up.' : 'Enter a valid @lpunetwork.edu.ph address (enforced server-side).'}</span>
                </span>
              </label>

              <label class="field">
                <span class="field-label">Password</span>
                <input class="input" type="password" value="••••••••••••" aria-label="Password" />
              </label>

              <label class="field">
                <span class="field-label">Confirm password</span>
                <input class="input" type="password" value="••••••••••••" aria-label="Confirm password" />
              </label>

              <button type="button" class="btn btn--primary btn--full" id="sendOtpBtn" data-nav="s2" ${validDomain ? '' : 'disabled'}>Send verification code</button>

              <div style="text-align:center;font-size:13px;color:var(--ink-secondary);">
                Already have an account? <button type="button" class="text-action" data-nav="s3">Log in</button>
              </div>
            </div>

            <div class="privacy-well">
              <span style="color:var(--ink-primary);margin-top:1px;">${ICONS.lock}</span>
              <span>Your name, email and student ID are encrypted (Data Privacy Act, RA 10173). Your student ID is never shown to other users.</span>
            </div>
          </div>`;
      }

      /* --- S2: VERIFY 6-DIGIT CODE --- */
      case 's2': {
        return `
          <div class="app-topbar app-topbar--clean">
            <button type="button" class="icon-btn" data-nav="s1" aria-label="Back to sign up">${ICONS.back}</button>
            <span></span>
          </div>
          <div class="screen-scroll" style="padding-top:4px;">
            <div style="width:44px;height:44px;border-radius:11px;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;">
              ${ICONS.mail}
            </div>
            <div>
              <h1 class="screen-h1">Check your email</h1>
              <p class="screen-lead">Enter the 6-digit code we sent to <strong style="color:var(--ink-primary);">${escapeHtml(state.email)}</strong></p>
            </div>

            <div class="field">
              <span class="field-label">Verification code</span>
              <div class="otp-row">
                ${state.otp.map((d, i) => `
                  <input class="otp-box" data-otp="${i}" inputmode="numeric" maxlength="1" value="${escapeAttr(d)}" aria-label="Digit ${i + 1}" />
                `).join('')}
              </div>
              <span class="field-hint">Didn't get it? Check Junk or Other. <button type="button" class="text-action" id="resendOtpBtn" style="padding:0;min-height:auto;">Resend code</button> in <span class="mono">0:42</span></span>
            </div>

            <button type="button" class="btn btn--primary btn--full" id="verifyOtpBtn">Verify and continue</button>

            <div class="sheet sheet-pad" style="margin-top:auto;">
              <div style="font-size:13px;font-weight:700;color:var(--ink-primary);">After you verify</div>
              <ol class="step-list">
                <li><span class="step-dot">1</span><span>Your profile is created with the Student role.</span></li>
                <li><span class="step-dot">2</span><span>You get a permanent personal QR for event attendance.</span></li>
                <li><span class="step-dot">3</span><span>Certification keys assigned to your email show up in My Keys.</span></li>
              </ol>
            </div>
          </div>`;
      }

      /* --- S3: HOME FEED --- */
      case 's3': {
        const showDept = state.feedFilter === 'all' || state.feedFilter === 'dept';
        const showOrgs = state.feedFilter === 'all' || state.feedFilter === 'orgs';
        return `
          <div class="screen-scroll">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-size:13px;color:var(--ink-secondary);font-weight:500;">Good morning,</div>
                <h1 class="screen-h1">Juan</h1>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <button type="button" class="btn btn--secondary btn--sm" data-nav="o1" title="Switch to Officer view">Officer</button>
                <button type="button" class="icon-btn icon-btn--surface" id="notifBellBtn" aria-label="Notifications" style="position:relative;">
                  ${ICONS.bell}
                  <span style="position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:99px;background:var(--brand);"></span>
                </button>
              </div>
            </div>

            <div class="chip-row" role="group" aria-label="Filter feed">
              <button type="button" class="chip" data-feed-filter="all" aria-pressed="${state.feedFilter === 'all'}">All</button>
              <button type="button" class="chip" data-feed-filter="dept" aria-pressed="${state.feedFilter === 'dept'}">Department</button>
              <button type="button" class="chip" data-feed-filter="orgs" aria-pressed="${state.feedFilter === 'orgs'}">My orgs</button>
            </div>

            <button type="button" class="key-alert" data-nav="s8">
              <span class="key-alert-icon">${ICONS.key}</span>
              <span style="flex:1;min-width:0;">
                <span style="display:block;font-size:14px;font-weight:700;color:var(--ink-primary);">Your GMetrix key is ready</span>
                <span style="display:block;font-size:12.5px;color:var(--ink-secondary);margin-top:2px;">MOS Excel · open My Keys to view</span>
              </span>
              <span style="color:var(--brand);">${ICONS.chevron}</span>
            </button>

            <div class="sheet ruled-list">
              ${showDept ? `
                <div class="ruled-row" style="flex-direction:column;align-items:stretch;gap:6px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <span style="font-size:12.5px;font-weight:700;color:var(--ink-primary);">CCS Department</span>
                    <span class="badge badge--brand">Department-wide</span>
                  </div>
                  <div style="font-size:15px;font-weight:700;color:var(--ink-primary);">Midterm consultation week</div>
                  <div style="font-size:13.5px;line-height:1.45;color:var(--ink-secondary);">Faculty consultation hours are posted on the Department page. Book a slot through your section adviser.</div>
                  <div style="font-size:12px;color:var(--ink-muted);margin-top:2px;">Posted Nov 24 · Expires Dec 5</div>
                </div>` : ''}

              ${showOrgs ? `
                <button type="button" class="ruled-row ruled-row--interactive" data-nav="s6">
                  <div class="date-stamp">
                    <span class="date-stamp-mo">DEC</span>
                    <span class="date-stamp-day tabular">3</span>
                  </div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;color:var(--status-present);">You're registered</div>
                    <div style="font-size:14.5px;font-weight:700;color:var(--ink-primary);margin-top:1px;">Hack Night: Intro to Supabase</div>
                    <div style="font-size:12.5px;color:var(--ink-secondary);margin-top:2px;">5:00 PM · Room 402 · Onsite</div>
                  </div>
                  <span style="color:var(--ink-muted);">${ICONS.chevron}</span>
                </button>

                <button type="button" class="ruled-row ruled-row--interactive" data-nav="s4" style="flex-direction:column;align-items:stretch;gap:8px;">
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="org-monogram">WD</span>
                    <div style="flex:1;">
                      <div style="font-size:14px;font-weight:700;color:var(--ink-primary);">Web Dev Guild</div>
                      <div style="font-size:12px;color:var(--ink-secondary);">Sub-org of CCS Student Council · Nov 23</div>
                    </div>
                  </div>
                  <div style="font-size:13.5px;line-height:1.45;color:var(--ink-secondary);">Applications for 2nd semester are open. Tell us what you want to build and we'll match you with a project team.</div>
                </button>

                <button type="button" class="ruled-row ruled-row--interactive" data-nav="s9">
                  <div style="flex:1;">
                    <div style="font-size:12px;font-weight:600;color:var(--brand);">Feedback open</div>
                    <div style="font-size:14px;font-weight:700;color:var(--ink-primary);margin-top:1px;">Rate Hack Night: Intro to Supabase</div>
                    <div style="font-size:12.5px;color:var(--ink-secondary);margin-top:1px;">2-minute attendee evaluation</div>
                  </div>
                  <span style="color:var(--ink-muted);">${ICONS.chevron}</span>
                </button>` : ''}
            </div>
          </div>
          ${renderStudentNav('home')}`;
      }

      /* --- S4: ORG PAGE + SUB-ORGS --- */
      case 's4': {
        return `
          <div class="screen-scroll screen-scroll--flush">
            <div class="org-cover">
              <button type="button" class="icon-btn icon-btn--overlay" data-nav="s3" aria-label="Back to feed">${ICONS.back}</button>
              <span style="font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.78);align-self:flex-end;">CCS Main Organization</span>
            </div>

            <div class="org-avatar-wrap">
              <div class="org-avatar-lg">SC</div>
            </div>

            <div style="padding:12px 20px 0;display:flex;flex-direction:column;gap:16px;">
              <div>
                <h1 class="screen-h1">CCS Student Council</h1>
                <div style="font-size:13px;color:var(--ink-secondary);margin-top:3px;">Main organization · 3 sub-orgs</div>
                <p class="screen-lead" style="margin-top:8px;">The official student government of the College of Information Technology and Computer Science (IT, CS, and LIS). We run college-wide events and support every sub-org under us.</p>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <button type="button" class="btn btn--primary" data-apply-org="council">Apply to join</button>
                <button type="button" class="btn btn--secondary" data-nav="s6">Events</button>
              </div>

              <div class="section-heading">Sub-organizations</div>
              <div class="sheet ruled-list">
                <div class="ruled-row">
                  <div style="display:flex;align-items:center;gap:11px;min-width:0;">
                    <span class="org-monogram">WD</span>
                    <div style="min-width:0;">
                      <div style="font-size:14px;font-weight:700;">Web Dev Guild</div>
                      <div style="font-size:12px;color:var(--status-present);font-weight:600;">Accepting applications</div>
                    </div>
                  </div>
                  <button type="button" class="btn btn--sm" style="background:var(--brand-soft);color:var(--brand);" data-apply-org="guild">Apply</button>
                </div>

                <div class="ruled-row">
                  <div style="display:flex;align-items:center;gap:11px;min-width:0;">
                    <span class="org-monogram" style="background:#374151;">CS</span>
                    <div style="min-width:0;">
                      <div style="font-size:14px;font-weight:700;">Cyber Sec Circle</div>
                      <div style="font-size:12px;color:var(--ink-muted);">Applications closed</div>
                    </div>
                  </div>
                  <button type="button" class="btn btn--secondary btn--sm" data-toast="Viewing Cyber Sec Circle page">View</button>
                </div>

                <div class="ruled-row">
                  <div style="display:flex;align-items:center;gap:11px;min-width:0;">
                    <span class="org-monogram org-monogram--teal">DS</span>
                    <div style="min-width:0;">
                      <div style="font-size:14px;font-weight:700;">Data Science Society</div>
                      <div style="font-size:12px;color:var(--status-late);font-weight:600;">Application pending</div>
                    </div>
                  </div>
                  <button type="button" class="btn btn--secondary btn--sm" data-toast="Your Data Science Society application is pending">View</button>
                </div>
              </div>

              <div class="section-heading">Posts</div>
              <div class="sheet sheet-pad">
                <div style="font-size:12px;color:var(--ink-muted);">Nov 21 · Read-only notice</div>
                <div style="font-size:15px;font-weight:700;margin-top:4px;">General Assembly recap</div>
                <div style="font-size:13.5px;line-height:1.45;color:var(--ink-secondary);margin-top:4px;">Thanks to everyone who came. Officer slates for next semester will be announced here.</div>
              </div>
            </div>
          </div>
          ${renderStudentNav('orgs')}`;
      }

      /* --- S5: APPLY (CONDITIONAL FORM) --- */
      case 's5': {
        const tracks = ['Frontend', 'Backend', 'UI/UX', 'DevOps'];
        return `
          <div class="app-topbar">
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="icon-btn" data-nav="s4" aria-label="Back to org">${ICONS.back}</button>
              <div class="topbar-title-group">
                <span class="topbar-title">Join ${escapeHtml(state.applyOrg.name)}</span>
                <span class="topbar-sub">${escapeHtml(state.applyOrg.sub)}</span>
              </div>
            </div>
          </div>

          <div class="screen-scroll">
            ${state.appSubmitted ? `
              <div class="sheet sheet-pad" style="border-color:var(--status-present);background:var(--status-present-soft);">
                <div style="display:flex;align-items:center;gap:8px;color:var(--status-present);font-weight:700;font-size:14px;">
                  ${ICONS.checkCircle} Application submitted
                </div>
                <div style="font-size:13px;color:var(--ink-primary);margin-top:6px;">
                  Your status is <strong>Pending</strong> until a ${escapeHtml(state.applyOrg.name)} officer reviews your answers.
                </div>
                <button type="button" class="btn btn--secondary btn--sm" id="resetAppBtn" style="margin-top:12px;">Edit / submit another demo</button>
              </div>` : ''}

            <label class="field">
              <span class="field-label">Year and section <span class="field-req">Required</span></span>
              <input class="input" id="appSectionInput" value="${escapeAttr(state.appSection)}" />
            </label>

            <div class="field">
              <span class="field-label">Have you built a website before?</span>
              <div class="choice-grid">
                <button type="button" class="choice-tile" style="justify-content:center;" data-built-site="Yes" aria-pressed="${state.appBuiltSite === 'Yes'}">Yes</button>
                <button type="button" class="choice-tile" style="justify-content:center;" data-built-site="No" aria-pressed="${state.appBuiltSite === 'No'}">No</button>
              </div>
            </div>

            ${state.appBuiltSite === 'Yes' ? `
              <div class="conditional-well">
                <div style="font-size:11.5px;font-weight:700;color:var(--brand);">Shown because you answered Yes</div>
                <label class="field">
                  <span class="field-label">Link to your work</span>
                  <input class="input" id="appPortfolioInput" value="${escapeAttr(state.appPortfolio)}" />
                </label>
              </div>` : ''}

            <div class="field">
              <span class="field-label">Which tracks interest you? <span style="font-weight:500;color:var(--ink-muted);">Pick any</span></span>
              <div class="choice-grid">
                ${tracks.map((t) => {
                  const checked = state.appTracks.has(t);
                  return `
                    <button type="button" class="choice-tile" role="checkbox" data-track="${t}" aria-checked="${checked}">
                      <span class="check-box">${checked ? ICONS.check : ''}</span>
                      <span>${t}</span>
                    </button>`;
                }).join('')}
              </div>
            </div>

            <div class="field">
              <span class="field-label">How comfortable are you with Git?</span>
              <div class="rating-row">
                ${[1, 2, 3, 4, 5].map((n) => `
                  <button type="button" class="rating-btn tabular" data-git-rating="${n}" aria-pressed="${state.appGitRating === n}">${n}</button>
                `).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-muted);">
                <span>Not yet</span><span>Very</span>
              </div>
            </div>

            <div style="margin-top:4px;display:flex;flex-direction:column;gap:8px;">
              <button type="button" class="btn btn--primary btn--full" id="submitAppBtn">Submit application</button>
              <div style="text-align:center;font-size:12px;color:var(--ink-muted);">Status shows as Pending until an officer reviews it.</div>
            </div>
          </div>`;
      }

      /* --- S6: EVENT + ATTENDANCE RULES --- */
      case 's6': {
        return `
          <div class="screen-scroll screen-scroll--flush">
            <div class="event-flyer">
              <button type="button" class="icon-btn icon-btn--overlay" data-nav="s3" aria-label="Back to feed">${ICONS.back}</button>
              <div>
                <div class="event-flyer-wordmark">HACK/NIGHT</div>
                <div style="font-size:12px;color:var(--ink-on-dark-muted);margin-top:2px;">CCS Technical Workshop Series</div>
              </div>
            </div>

            <div style="padding:16px 20px 0;display:flex;flex-direction:column;gap:16px;">
              <div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                  <span class="badge badge--brand">Onsite</span>
                  <span class="badge badge--neutral">Web Dev Guild</span>
                </div>
                <h1 class="screen-h1">Hack Night: Intro to Supabase</h1>

                <div style="display:flex;flex-direction:column;gap:7px;margin-top:12px;font-size:13.5px;color:var(--ink-secondary);">
                  <div style="display:flex;align-items:center;gap:8px;">${ICONS.events}<span>Wed, Dec 3 · 5:00–8:00 PM</span></div>
                  <div style="display:flex;align-items:center;gap:8px;">${ICONS.pin}<span>Room 402, CCS Building</span></div>
                  <div style="display:flex;align-items:center;gap:8px;">${ICONS.orgs}<span class="tabular">42 of 60 spots taken</span></div>
                </div>
              </div>

              <div class="sheet sheet-pad">
                <div style="font-size:14px;font-weight:700;color:var(--ink-primary);">How attendance works</div>
                <div class="window-bar" aria-hidden="true">
                  <span class="window-seg--present"></span>
                  <span class="window-seg--late"></span>
                  <span class="window-seg--absent"></span>
                </div>
                <div class="window-legend">
                  <div class="window-legend-row">
                    <span style="font-weight:700;color:var(--status-present);">Present</span>
                    <span class="tabular" style="color:var(--ink-secondary);">Scan in by 5:15 PM</span>
                  </div>
                  <div class="window-legend-row">
                    <span style="font-weight:700;color:var(--status-late);">Late</span>
                    <span class="tabular" style="color:var(--ink-secondary);">5:15 – 5:20 PM</span>
                  </div>
                  <div class="window-legend-row">
                    <span style="font-weight:700;color:var(--status-absent);">Absent</span>
                    <span class="tabular" style="color:var(--ink-secondary);">After 5:20 PM</span>
                  </div>
                </div>
                <div style="font-size:12.5px;line-height:1.45;color:var(--ink-secondary);margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
                  Scan again when you leave. Forget to? You're checked out automatically 3 hours after check-in.
                </div>
              </div>

              <div style="font-size:12.5px;line-height:1.45;color:var(--ink-muted);">
                Online events show the Zoom, Meet or Teams link here once you register.
              </div>
            </div>
          </div>

          <div class="sticky-action-bar">
            <div style="display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:var(--status-present);">
              ${ICONS.checkCircle} You're registered
            </div>
            <button type="button" class="btn btn--primary btn--sm" data-nav="s7">Show my QR</button>
          </div>
          ${renderStudentNav('events')}`;
      }

      /* --- S7: MY QR ID (LANYARD BADGE + 3D FLIP) --- */
      case 's7': {
        return `
          <div class="lanyard-stage ${state.qrBright ? 'lanyard-stage--bright' : ''}">
            <div class="lanyard-straps" aria-hidden="true">
              <span class="lanyard-strap lanyard-strap--left">CCS · MYCCS · CCS</span>
              <span class="lanyard-strap lanyard-strap--right">MYCCS · CCS · MYCCS</span>
            </div>
            <div class="lanyard-clip" aria-hidden="true"></div>

            <div class="id-card-scene">
              <div class="id-card-flipper ${state.qrFlipped ? 'is-flipped' : ''}">
                <!-- FRONT FACE -->
                <div class="id-face">
                  <div class="id-header">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="ccs-mark" style="width:30px;height:30px;font-size:11px;">CCS</div>
                      <div>
                        <div style="font-size:14px;font-weight:700;line-height:1.1;">MyCCS</div>
                        <div style="font-size:10.5px;color:var(--ink-on-dark-muted);">College of IT &amp; Computer Science</div>
                      </div>
                    </div>
                    <span class="mono" style="font-size:11px;padding:3px 7px;border-radius:5px;background:#262E3A;color:var(--ink-on-dark);">ID</span>
                  </div>

                  <div class="id-body">
                    <div class="id-person">
                      <span class="org-monogram org-monogram--ochre" style="width:40px;height:40px;font-size:13px;">JD</span>
                      <div>
                        <div style="font-size:16px;font-weight:700;color:var(--ink-primary);">Juan Dela Cruz</div>
                        <div style="font-size:12.5px;color:var(--ink-secondary);">Student · CCS</div>
                      </div>
                    </div>

                    <div class="qr-frame">
                      ${renderQrSvg()}
                    </div>

                    <div class="mono" style="font-size:11px;color:var(--ink-muted);">v1.usr_84a2.9f3c · no PII inside</div>
                  </div>

                  <div class="id-band">
                    <span>STUDENT</span>
                    <span style="display:inline-flex;align-items:center;gap:5px;letter-spacing:0;font-weight:600;">${ICONS.check} Works offline</span>
                  </div>
                </div>

                <!-- BACK FACE (RECENT ATTENDANCE) -->
                <div class="id-face id-face--back">
                  <div class="id-header">
                    <div>
                      <div style="font-size:14px;font-weight:700;">Recent attendance</div>
                      <div style="font-size:11px;color:var(--ink-on-dark-muted);">Synced from officer scans</div>
                    </div>
                    <span class="mono" style="font-size:11px;color:var(--ink-on-dark-muted);">3 logs</span>
                  </div>

                  <div class="ruled-list" style="flex:1;overflow-y:auto;">
                    <div class="ruled-row" style="flex-direction:column;align-items:stretch;gap:4px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="font-size:13.5px;">Hack Night: Intro to Supabase</strong>
                        <span class="badge badge--present">Present</span>
                      </div>
                      <span class="mono" style="font-size:11.5px;color:var(--ink-secondary);">Dec 3 · In 5:07 PM · Out 7:52 PM</span>
                    </div>
                    <div class="ruled-row" style="flex-direction:column;align-items:stretch;gap:4px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="font-size:13.5px;">CCS General Assembly</strong>
                        <span class="badge badge--present">Present</span>
                      </div>
                      <span class="mono" style="font-size:11.5px;color:var(--ink-secondary);">Nov 21 · In 1:04 PM · Out 3:30 PM</span>
                    </div>
                    <div class="ruled-row" style="flex-direction:column;align-items:stretch;gap:4px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong style="font-size:13.5px;">Git Basics Workshop</strong>
                        <span class="badge badge--late">Late</span>
                      </div>
                      <span class="mono" style="font-size:11.5px;color:var(--ink-secondary);">Nov 10 · In 5:17 PM · Auto out 8:17 PM</span>
                    </div>
                  </div>

                  <div class="id-band" style="background:var(--bg-dark);">
                    <span>PERMANENT TOKEN</span>
                    <span class="mono" style="letter-spacing:0;">RA 10173</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="lanyard-actions">
              <button type="button" class="btn btn--secondary" id="flipCardBtn">${ICONS.flip} ${state.qrFlipped ? 'Show QR' : 'Flip card'}</button>
              <button type="button" class="btn ${state.qrBright ? 'btn--primary' : 'btn--secondary'}" id="brightBtn">${ICONS.sun} Max brightness</button>
            </div>
          </div>
          ${renderStudentNav('qr')}`;
      }

      /* --- S8: MY KEYS & DIRECTORY --- */
      case 's8': {
        const excelOpen = state.revealedKeys.has('excel');
        const wordOpen = state.revealedKeys.has('word');
        return `
          <div class="screen-scroll">
            <h1 class="screen-h1">Certifications</h1>

            <div class="segmented" role="group" aria-label="Certifications view">
              <button type="button" class="segmented-btn" data-cert-tab="dir" aria-pressed="${state.certTab === 'dir'}">Directory</button>
              <button type="button" class="segmented-btn" data-cert-tab="keys" aria-pressed="${state.certTab === 'keys'}">My Keys · 2</button>
            </div>

            ${state.certTab === 'keys' ? `
              <div class="sheet sheet-pad" style="border-color:var(--brand-border);display:flex;flex-direction:column;gap:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-size:12px;font-weight:700;color:var(--brand);">GMetrix · New</span>
                  <span style="width:8px;height:8px;border-radius:99px;background:var(--brand);"></span>
                </div>
                <div style="font-size:16px;font-weight:700;margin-top:-6px;">Microsoft Office Specialist: Excel</div>

                <div class="key-code-box">${excelOpen ? 'GMX9-44K2-B81R-7Q2K' : '••••-••••-••••-7Q2K'}</div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <button type="button" class="btn btn--secondary btn--sm" data-reveal-key="excel">${excelOpen ? 'Hide key' : 'Reveal key'}</button>
                  <button type="button" class="btn btn--primary btn--sm" data-copy-key="GMX9-44K2-B81R-7Q2K">Copy key</button>
                </div>

                <div style="font-size:12px;color:var(--ink-muted);">Assigned Nov 24 by CCS Faculty</div>
              </div>

              <div class="sheet sheet-pad" style="display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div>
                    <div style="font-size:11.5px;color:var(--ink-muted);font-weight:600;">GMetrix</div>
                    <div style="font-size:14.5px;font-weight:700;">MOS: Word</div>
                  </div>
                  <span style="font-size:12px;color:var(--ink-muted);">Oct 2</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <span class="mono" style="font-size:13px;color:var(--ink-secondary);">${wordOpen ? 'GMX4-88P1-C90D-K8M1' : '••••-••••-••••-K8M1'}</span>
                  <button type="button" class="text-action" data-reveal-key="word" style="min-height:30px;padding:2px 6px;">${wordOpen ? 'Hide' : 'Reveal'}</button>
                </div>
              </div>

              <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.45;color:var(--ink-secondary);">
                <span style="color:var(--ink-primary);margin-top:1px;">${ICONS.shield}</span>
                <span>Keys only appear here after you sign in. Notifications tell you a key is ready but never include it.</span>
              </div>` : ''}

            <div class="section-heading">Offered by CCS</div>
            <div class="sheet ruled-list">
              <div class="ruled-row"><strong style="font-size:14px;">CompTIA</strong><span style="font-size:13px;color:var(--ink-secondary);">IT fundamentals</span></div>
              <div class="ruled-row"><strong style="font-size:14px;">Cisco</strong><span style="font-size:13px;color:var(--ink-secondary);">Networking</span></div>
              <div class="ruled-row"><strong style="font-size:14px;">SAP</strong><span style="font-size:13px;color:var(--ink-secondary);">Enterprise systems</span></div>
              <div class="ruled-row"><strong style="font-size:14px;">Certiport</strong><span style="font-size:13px;color:var(--ink-secondary);">Office &amp; IT specialist</span></div>
            </div>
          </div>
          ${renderStudentNav('certs')}`;
      }

      /* --- S9: POST-EVENT EVALUATION --- */
      case 's9': {
        const usefulOpts = ['Live demo', 'Hands-on exercise', 'Q&A with the speaker'];
        return `
          <div class="app-topbar">
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" class="icon-btn" data-nav="s3" aria-label="Back to home">${ICONS.back}</button>
              <div class="topbar-title-group">
                <span class="topbar-title">Event feedback</span>
                <span class="topbar-sub">Hack Night: Intro to Supabase · Dec 3</span>
              </div>
            </div>
          </div>

          <div class="screen-scroll">
            <div class="badge badge--present" style="padding:7px 10px;font-size:12px;align-self:flex-start;">
              ${ICONS.check} You attended · in 5:07 PM, out 7:52 PM
            </div>

            ${state.evalSubmitted ? `
              <div class="sheet sheet-pad" style="border-color:var(--status-present);background:var(--status-present-soft);">
                <div style="font-weight:700;font-size:14px;color:var(--status-present);">Feedback recorded</div>
                <div style="font-size:13px;color:var(--ink-primary);margin-top:4px;">Thank you! Each attendee can submit once per form.</div>
                <button type="button" class="btn btn--secondary btn--sm" id="resetEvalBtn" style="margin-top:10px;">Reset demo form</button>
              </div>` : ''}

            <div class="field">
              <span class="field-label">Overall, how was the event?</span>
              <div class="rating-row">
                ${[1, 2, 3, 4, 5].map((n) => `
                  <button type="button" class="rating-btn tabular" data-eval-rating="${n}" aria-pressed="${state.evalRating === n}">${n}</button>
                `).join('')}
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-muted);">
                <span>Poor</span><span>Excellent</span>
              </div>
            </div>

            <div class="field">
              <span class="field-label">Would you join a follow-up workshop?</span>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                ${['Yes', 'Maybe', 'No'].map((opt) => `
                  <button type="button" class="choice-tile" style="justify-content:center;" data-eval-followup="${opt}" aria-pressed="${state.evalFollowup === opt}">${opt}</button>
                `).join('')}
              </div>
            </div>

            ${state.evalFollowup === 'No' ? `
              <div class="conditional-well">
                <div style="font-size:11.5px;font-weight:700;color:var(--brand);">Shown because you answered No</div>
                <label class="field">
                  <span class="field-label">What would change your mind?</span>
                  <input class="input" id="evalWhyNotInput" placeholder="Schedule, topic, or format..." value="${escapeAttr(state.evalWhyNot)}" />
                </label>
              </div>` : ''}

            <div class="field">
              <span class="field-label">What was most useful? <span style="font-weight:500;color:var(--ink-muted);">Pick any</span></span>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${usefulOpts.map((opt) => {
                  const checked = state.evalUseful.has(opt);
                  return `
                    <button type="button" class="choice-tile" role="checkbox" data-eval-useful="${opt}" aria-checked="${checked}">
                      <span class="check-box">${checked ? ICONS.check : ''}</span>
                      <span>${opt}</span>
                    </button>`;
                }).join('')}
              </div>
            </div>

            <div style="margin-top:auto;padding-top:8px;display:flex;flex-direction:column;gap:6px;">
              <button type="button" class="btn btn--primary btn--full" id="submitEvalBtn" ${state.evalSubmitted ? 'disabled' : ''}>${state.evalSubmitted ? 'Feedback submitted' : 'Submit feedback'}</button>
              <div style="text-align:center;font-size:12px;color:var(--ink-muted);">You can submit this once. Answers go to the host org.</div>
            </div>
          </div>`;
      }

      /* --- O1: MANAGE ORG --- */
      case 'o1': {
        const org = state.orgs[state.orgIndex];
        const pendingCount = state.applicants.filter((a) => a.status === 'pending').length;
        return `
          <div class="app-topbar">
            <span class="badge badge--brand" style="letter-spacing:0.06em;">OFFICER</span>
            <button type="button" class="text-action" data-nav="s3">Student view</button>
          </div>

          <div class="screen-scroll">
            <button type="button" class="sheet sheet-pad" id="switchOrgBtn" style="width:100%;display:flex;align-items:center;gap:12px;text-align:left;">
              <span class="org-monogram">${org.code}</span>
              <span style="flex:1;min-width:0;">
                <span style="display:block;font-size:15px;font-weight:700;color:var(--ink-primary);">${org.name}</span>
                <span style="display:block;font-size:12px;color:var(--ink-secondary);margin-top:2px;">${org.role}</span>
              </span>
              <span style="color:var(--ink-muted);">${ICONS.chevronDown}</span>
            </button>

            <div class="sheet sheet-pad" style="border-color:var(--status-present);background:var(--status-present-soft);display:flex;flex-direction:column;gap:10px;">
              <div>
                <div style="font-size:12px;font-weight:700;color:var(--status-present);">Today · 5:00 PM</div>
                <div style="font-size:15.5px;font-weight:700;color:var(--ink-primary);margin-top:2px;">${org.event}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--ink-primary);">
                <div style="display:flex;align-items:center;gap:7px;"><span style="color:var(--status-present);">${ICONS.check}</span><span>Attendance rules saved on this phone</span></div>
                <div style="display:flex;align-items:center;gap:7px;"><span style="color:var(--status-present);">${ICONS.check}</span><span class="tabular">${org.roster} registered names saved for visual check</span></div>
                <div style="display:flex;align-items:center;gap:7px;"><span style="color:var(--status-present);">${ICONS.check}</span><span>Clock synced with server (<span class="mono">${org.offset}</span>)</span></div>
              </div>
              <button type="button" class="btn btn--dark btn--full" data-open-scanner="current" style="margin-top:2px;">${ICONS.scan} Open scanner</button>
            </div>

            <div class="officer-tile-grid">
              <button type="button" class="officer-tile" data-nav="o2">
                <span style="color:var(--brand);">${ICONS.events}</span>
                <span style="font-size:12.5px;font-weight:700;">New event</span>
              </button>
              <button type="button" class="officer-tile" data-nav="o4">
                <span style="color:var(--brand);">${ICONS.review}</span>
                <span style="font-size:12.5px;font-weight:700;">Applicants</span>
                <span class="officer-tile-count tabular">${pendingCount}</span>
              </button>
              <button type="button" class="officer-tile" data-nav="o5">
                <span style="color:var(--brand);">${ICONS.metrics}</span>
                <span style="font-size:12.5px;font-weight:700;">Metrics</span>
              </button>
              <button type="button" class="officer-tile" data-toast="Post composer opens for read-only org announcements">
                <span style="color:var(--ink-secondary);">${ICONS.megaphone}</span>
                <span style="font-size:12.5px;font-weight:700;">Post update</span>
              </button>
              <button type="button" class="officer-tile" data-toast="Edit cover, crest, and bio (compressed on upload)">
                <span style="color:var(--ink-secondary);">${ICONS.image}</span>
                <span style="font-size:12.5px;font-weight:700;">Edit page</span>
              </button>
              <button type="button" class="officer-tile" data-toast="Conditional form builder (4 field types + visibleIf)">
                <span style="color:var(--ink-secondary);">${ICONS.form}</span>
                <span style="font-size:12.5px;font-weight:700;">Forms</span>
              </button>
            </div>

            <div class="sheet ruled-list">
              <button type="button" class="ruled-row ruled-row--interactive" data-nav="o3">
                <div>
                  <div style="font-size:14px;font-weight:700;">Hack Night: Intro to Supabase</div>
                  <div style="font-size:12px;color:var(--ink-secondary);margin-top:2px;">Dec 3 · 42 of 60 registered</div>
                </div>
                <span class="badge badge--present">Published</span>
              </button>
              <button type="button" class="ruled-row ruled-row--interactive" data-nav="o2">
                <div>
                  <div style="font-size:14px;font-weight:700;">Git Workflow Workshop</div>
                  <div style="font-size:12px;color:var(--ink-secondary);margin-top:2px;">Online · Dec 10</div>
                </div>
                <span class="badge badge--neutral">Draft</span>
              </button>
            </div>
          </div>
          ${renderOfficerNav('manage')}`;
      }

      /* --- O2: CREATE EVENT + RULES --- */
      case 'o2': {
        const graceMin = Math.max(0, Number(state.evtGrace) || 0);
        const lateMin = Math.max(0, Number(state.evtLate) || 0);
        const validLink = isValidMeetingLink(state.evtLink);
        return `
          <div class="app-topbar">
            <button type="button" class="text-action" style="color:var(--ink-secondary);" data-nav="o1">Cancel</button>
            <span class="topbar-title">New event</span>
            <button type="button" class="text-action" data-toast="Saved draft locally">Save draft</button>
          </div>

          <div class="screen-scroll">
            <label class="field">
              <span class="field-label">Event title</span>
              <input class="input" id="evtTitleInput" value="${escapeAttr(state.evtTitle)}" />
            </label>

            <div class="field">
              <span class="field-label">Where does it happen?</span>
              <div class="segmented" role="group" aria-label="Event modality">
                <button type="button" class="segmented-btn" data-modality="onsite" aria-pressed="${state.evtModality === 'onsite'}">Onsite</button>
                <button type="button" class="segmented-btn" data-modality="online" aria-pressed="${state.evtModality === 'online'}">Online</button>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <label class="field">
                <span class="field-label">Starts</span>
                <input class="input tabular" value="Dec 3, 5:00 PM" readonly />
              </label>
              <label class="field">
                <span class="field-label">Ends</span>
                <input class="input tabular" value="Dec 3, 8:00 PM" readonly />
              </label>
            </div>

            ${state.evtModality === 'onsite' ? `
              <div class="sheet sheet-pad" style="display:flex;flex-direction:column;gap:12px;">
                <div style="font-size:14px;font-weight:700;">Attendance rules</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                  <label class="field">
                    <span class="field-label" style="font-size:12px;color:var(--ink-secondary);">On-time grace (min)</span>
                    <input class="input mono" id="evtGraceInput" type="number" min="0" max="120" value="${graceMin}" />
                  </label>
                  <label class="field">
                    <span class="field-label" style="font-size:12px;color:var(--ink-secondary);">Late window (min)</span>
                    <input class="input mono" id="evtLateInput" type="number" min="0" max="120" value="${lateMin}" />
                  </label>
                  <label class="field">
                    <span class="field-label" style="font-size:12px;color:var(--ink-secondary);">Scan cooldown (sec)</span>
                    <input class="input mono" id="evtCooldownInput" type="number" min="5" max="300" value="${state.evtCooldown}" />
                  </label>
                  <label class="field">
                    <span class="field-label" style="font-size:12px;color:var(--ink-secondary);">Auto check-out (min)</span>
                    <input class="input mono" id="evtAutoOutInput" type="number" min="30" max="480" value="${state.evtAutoOut}" />
                  </label>
                </div>

                <div>
                  <div class="window-bar" style="margin:2px 0 8px;">
                    <span class="window-seg--present"></span>
                    <span class="window-seg--late"></span>
                    <span class="window-seg--absent"></span>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-secondary);" class="tabular">
                    <span>5:00 present</span>
                    <span id="evtTimelineLate">${formatEventOffset(graceMin)} late</span>
                    <span id="evtTimelineAbsent">${formatEventOffset(graceMin + lateMin)} absent</span>
                  </div>
                </div>
              </div>` : `
              <div class="sheet sheet-pad" style="display:flex;flex-direction:column;gap:10px;">
                <div style="font-size:14px;font-weight:700;">Online meeting link</div>
                <label class="field">
                  <span class="field-label" style="font-size:12px;color:var(--ink-secondary);">Validated Zoom, Meet, or Teams URL</span>
                  <input class="input ${validLink ? '' : 'input--invalid'}" id="evtLinkInput" value="${escapeAttr(state.evtLink)}" aria-invalid="${!validLink}" aria-describedby="evtLinkHint" />
                  <span id="evtLinkHint" class="field-hint ${validLink ? 'field-hint--ok' : 'field-hint--err'}">
                    ${ICONS.check}
                    <span id="evtLinkHintText">${validLink ? 'Trusted meeting host · visible to registered students.' : 'Use a valid Google Meet, Zoom, or MS Teams HTTPS link.'}</span>
                  </span>
                </label>
              </div>`}

            <button type="button" class="sheet sheet-pad" data-toast="Flyer pre-compressed on device & stripped of EXIF via Edge Function" style="width:100%;display:flex;align-items:center;gap:12px;text-align:left;border-style:dashed;">
              <span style="color:var(--ink-secondary);">${ICONS.image}</span>
              <span>
                <span style="display:block;font-size:13.5px;font-weight:700;color:var(--ink-primary);">Add flyer</span>
                <span style="display:block;font-size:12px;color:var(--ink-secondary);">Compressed before upload · up to 5 MB</span>
              </span>
            </button>

            <button type="button" class="btn btn--primary btn--full" id="publishEvtBtn">Publish event</button>
          </div>
          ${renderOfficerNav('events')}`;
      }

      /* --- O3: OFFLINE QR SCANNER --- */
      case 'o3': {
        const ev = state.scannerEvent;
        const scenarios = {
          present: {
            kicker: 'CHECKED IN', badgeClass: 'badge--present', badgeText: 'Present',
            name: 'Maria Santos', meta: '5:07 PM · within on-time window',
            note: state.scanRepeatNotice || 'Scan again when she leaves to check her out.'
          },
          late: {
            kicker: 'CHECKED IN', badgeClass: 'badge--late', badgeText: 'Late',
            name: 'Carlo Mendoza', meta: '5:18 PM · inside 5-min late window',
            note: state.scanRepeatNotice || `Saved locally with server-adjusted clock (${ev.offset}).`
          },
          cooldown: {
            kicker: 'IGNORED · COOLDOWN', badgeClass: 'badge--neutral', badgeText: 'Wait 42s',
            name: 'Maria Santos', meta: 'Duplicate scan inside 60s cooldown',
            note: 'No duplicate row written to local SQLite queue.'
          },
          checkout: {
            kicker: state.scanRepeatNotice ? 'ALREADY CHECKED OUT' : 'CHECKED OUT',
            badgeClass: state.scanRepeatNotice ? 'badge--neutral' : 'badge--brand',
            badgeText: state.scanRepeatNotice ? 'No-op' : 'Scan out',
            name: 'Juan Dela Cruz', meta: '7:52 PM · duration 2h 45m',
            note: state.scanRepeatNotice || 'Queued for sync (checkout_source = scan).'
          },
          invalid: {
            kicker: 'REJECTED', badgeClass: 'badge--absent', badgeText: 'Invalid QR',
            name: 'Unrecognized token', meta: 'Signature mismatch or non-MyCCS QR',
            note: 'Ask the student to open their MyCCS QR ID badge.'
          }
        };
        const sc = scenarios[state.scanMode] || scenarios.present;
        return `
          <div class="screen-scroll screen-scroll--dark">
            <div class="scanner-topbar">
              <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                <button type="button" class="icon-btn" style="color:var(--ink-on-dark);" data-nav="o1" aria-label="Close scanner">${ICONS.close}</button>
                <div style="min-width:0;">
                  <div style="font-size:14.5px;font-weight:700;color:var(--ink-on-dark);">${escapeHtml(ev.title)}</div>
                  <div style="font-size:12px;color:var(--ink-on-dark-muted);">${escapeHtml(ev.org)}</div>
                </div>
              </div>
              <span class="offline-pill tabular">
                <span class="offline-dot"></span>
                Offline · ${state.toSync} to sync
              </span>
            </div>

            <div class="viewfinder">
              <div class="reticle">
                <svg width="148" height="128" viewBox="0 0 148 128" fill="none" stroke="#F4F2EC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 24V6a4 4 0 0 1 4-4h18" />
                  <path d="M124 2h18a4 4 0 0 1 4 4v18" />
                  <path d="M2 104v18a4 4 0 0 0 4 4h18" />
                  <path d="M124 126h18a4 4 0 0 0 4-4v-18" />
                </svg>
                <span class="scan-beam"></span>
              </div>
              <div style="font-size:12.5px;color:var(--ink-on-dark-muted);">Point the camera at a student's QR</div>
            </div>

            <div class="sim-row" role="group" aria-label="Simulate scan outcome">
              ${[
                ['present', 'Present'],
                ['late', 'Late'],
                ['cooldown', 'Cooldown'],
                ['checkout', 'Check-out'],
                ['invalid', 'Invalid']
              ].map(([k, lbl]) => `
                <button type="button" class="sim-btn" data-scan-sim="${k}" aria-pressed="${state.scanMode === k}">${lbl}</button>
              `).join('')}
            </div>

            <div class="scan-result-sheet">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11.5px;font-weight:700;letter-spacing:0.06em;color:var(--ink-secondary);">${sc.kicker}</span>
                <span class="badge ${sc.badgeClass}">${sc.badgeText}</span>
              </div>
              <div style="font-size:21px;font-weight:700;letter-spacing:-0.02em;color:var(--ink-primary);">${sc.name}</div>
              <div class="tabular" style="font-size:13px;color:var(--ink-secondary);">${sc.meta}</div>
              <div style="font-size:12.5px;color:var(--ink-secondary);padding-top:8px;margin-top:4px;border-top:1px solid var(--border);">${sc.note}</div>
            </div>

            <div class="scanner-stats">
              <div class="scanner-stat">
                <span class="scanner-stat-val tabular">${state.checkedIn}</span>
                <span class="scanner-stat-lbl">Checked in</span>
              </div>
              <div class="scanner-stat">
                <span class="scanner-stat-val tabular">${state.checkedOut}</span>
                <span class="scanner-stat-lbl">Checked out</span>
              </div>
              <div class="scanner-stat">
                <span class="scanner-stat-val tabular">${state.toSync}</span>
                <span class="scanner-stat-lbl">Waiting to sync</span>
              </div>
            </div>

            <div style="font-size:11.5px;line-height:1.45;color:var(--ink-on-dark-muted);text-align:center;margin-top:auto;">
              Scans are saved on this phone and sync on their own when you're back online. Times use server-adjusted clock.
            </div>
          </div>`;
      }

      /* --- O4: REVIEW APPLICANTS --- */
      case 'o4': {
        const pending = state.applicants.filter((a) => a.status === 'pending');
        const approved = state.applicants.filter((a) => a.status === 'approved');
        const rejected = state.applicants.filter((a) => a.status === 'rejected');
        const visible = state.applicantTab === 'pending' ? pending : state.applicantTab === 'approved' ? approved : rejected;

        return `
          <div class="screen-scroll">
            <div>
              <h1 class="screen-h1">Applicants</h1>
              <div style="font-size:13px;color:var(--ink-secondary);margin-top:2px;">Web Dev Guild · membership form v2</div>
            </div>

            <div class="chip-row" role="group" aria-label="Filter applicants">
              <button type="button" class="chip tabular" data-app-tab="pending" aria-pressed="${state.applicantTab === 'pending'}">Pending · ${pending.length}</button>
              <button type="button" class="chip tabular" data-app-tab="approved" aria-pressed="${state.applicantTab === 'approved'}">Approved · ${approved.length}</button>
              <button type="button" class="chip tabular" data-app-tab="rejected" aria-pressed="${state.applicantTab === 'rejected'}">Rejected · ${rejected.length}</button>
            </div>

            ${visible.length === 0 ? `
              <div class="sheet sheet-pad" style="text-align:center;color:var(--ink-secondary);font-size:13.5px;">
                No ${escapeHtml(state.applicantTab)} applicants right now.
              </div>` : `
              <div class="sheet ruled-list">
                ${visible.map((a) => {
                  const open = state.expandedApplicantId === a.id;
                  const monoClass = a.color === 'ochre' ? 'org-monogram--ochre' : a.color === 'brand' ? 'org-monogram--brand' : a.color === 'teal' ? 'org-monogram--teal' : '';
                  const statusBadge = a.status === 'pending' ? 'badge--late' : a.status === 'approved' ? 'badge--present' : 'badge--absent';
                  const statusLabel = a.status.charAt(0).toUpperCase() + a.status.slice(1);
                  return `
                    <div class="ruled-row" style="flex-direction:column;align-items:stretch;gap:12px;">
                      <button type="button" data-expand-applicant="${escapeAttr(a.id)}" style="border:0;background:transparent;padding:0;width:100%;display:flex;align-items:center;gap:11px;text-align:left;">
                        <span class="org-monogram ${monoClass}">${escapeHtml(a.initials)}</span>
                        <span style="flex:1;min-width:0;">
                          <span style="display:block;font-size:14.5px;font-weight:700;color:var(--ink-primary);">${escapeHtml(a.name)}</span>
                          <span style="display:block;font-size:12px;color:var(--ink-secondary);">Applied ${escapeHtml(a.applied)}</span>
                        </span>
                        <span class="badge ${statusBadge}">${escapeHtml(statusLabel)}</span>
                      </button>

                      ${open ? `
                        <div style="display:flex;flex-direction:column;gap:9px;padding-top:8px;border-top:1px solid var(--border);font-size:13px;">
                          <div><div style="color:var(--ink-muted);font-size:11.5px;">Year and section</div><strong>${escapeHtml(a.section)}</strong></div>
                          <div><div style="color:var(--ink-muted);font-size:11.5px;">Built a website before?</div><strong>${escapeHtml(a.built)}</strong></div>
                          ${a.link ? `
                            <div style="padding:8px 10px;border-radius:8px;background:var(--brand-soft);border:1px solid var(--brand-border);">
                              <div style="font-size:11.5px;color:var(--brand);font-weight:600;">Link to your work · conditional</div>
                              <div class="mono" style="font-size:12.5px;font-weight:600;color:var(--ink-primary);margin-top:2px;">${escapeHtml(a.link)}</div>
                            </div>` : ''}
                          <div><div style="color:var(--ink-muted);font-size:11.5px;">Tracks</div><strong>${escapeHtml(a.tracks)}</strong></div>
                          <div><div style="color:var(--ink-muted);font-size:11.5px;">Git comfort</div><strong>${escapeHtml(a.git)}</strong></div>

                          ${a.status === 'pending' ? `
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;">
                              <button type="button" class="btn btn--danger-outline btn--sm" data-decide-applicant="${escapeAttr(a.id)}:rejected">Reject</button>
                              <button type="button" class="btn btn--primary btn--sm" data-decide-applicant="${escapeAttr(a.id)}:approved">Approve</button>
                            </div>` : ''}
                        </div>` : ''}
                    </div>`;
                }).join('')}
              </div>`}
          </div>
          ${renderOfficerNav('review')}`;
      }

      /* --- O5: EVALUATION METRICS --- */
      case 'o5': {
        const ratings = [
          { star: 5, count: 18, pct: 100 },
          { star: 4, count: 13, pct: 72 },
          { star: 3, count: 5, pct: 28 },
          { star: 2, count: 1, pct: 6 },
          { star: 1, count: 1, pct: 6 }
        ];
        return `
          <div class="screen-scroll">
            <div>
              <div style="font-size:12.5px;color:var(--ink-secondary);font-weight:600;">Evaluation results</div>
              <h1 class="screen-h1" style="margin-top:2px;">Hack Night: Intro to Supabase</h1>
            </div>

            <div class="metric-ledger">
              <div class="metric-cell">
                <div class="metric-val tabular">38</div>
                <div class="metric-lbl">Responses</div>
              </div>
              <div class="metric-cell">
                <div class="metric-val tabular">52</div>
                <div class="metric-lbl">Attended</div>
              </div>
              <div class="metric-cell">
                <div class="metric-val tabular">73%</div>
                <div class="metric-lbl">Response rate</div>
              </div>
            </div>

            <div class="sheet sheet-pad" style="display:flex;flex-direction:column;gap:10px;">
              <div style="display:flex;align-items:baseline;justify-content:space-between;">
                <strong style="font-size:14px;">Overall, how was the event?</strong>
                <span class="tabular" style="font-size:18px;font-weight:700;color:var(--brand);">4.2 <span style="font-size:12px;color:var(--ink-muted);font-weight:500;">/ 5</span></span>
              </div>
              <div style="display:flex;flex-direction:column;gap:7px;">
                ${ratings.map((r) => `
                  <div class="bar-row tabular">
                    <span style="font-weight:600;color:var(--ink-secondary);">${r.star}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${r.pct}%;"></div></div>
                    <span style="text-align:right;font-weight:600;color:var(--ink-primary);">${r.count}</span>
                  </div>`).join('')}
              </div>
            </div>

            <div class="sheet sheet-pad">
              <strong style="font-size:14px;">Would you join a follow-up workshop?</strong>
              <div class="split-bar" aria-hidden="true">
                <span style="width:68%;background:var(--brand);"></span>
                <span style="width:24%;background:#93B4F8;"></span>
                <span style="width:8%;background:var(--border-strong);"></span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-secondary);" class="tabular">
                <span><strong style="color:var(--ink-primary);">Yes</strong> 26 · 68%</span>
                <span><strong style="color:var(--ink-primary);">Maybe</strong> 9 · 24%</span>
                <span><strong style="color:var(--ink-primary);">No</strong> 3 · 8%</span>
              </div>
            </div>

            <div class="sheet ruled-list">
              <div class="ruled-row" style="padding-bottom:8px;">
                <strong style="font-size:13.5px;">What would change your mind?</strong>
                <span style="font-size:12px;color:var(--ink-muted);">3 text answers</span>
              </div>
              <div class="ruled-row" style="font-size:13px;line-height:1.45;color:var(--ink-secondary);">
                "A weekend schedule. Weeknights clash with my org meetings."
              </div>
              <div class="ruled-row" style="font-size:13px;line-height:1.45;color:var(--ink-secondary);">
                "More time for the hands-on part and local Supabase setup."
              </div>
              <div class="ruled-row" style="font-size:13px;line-height:1.45;color:var(--ink-secondary);">
                "Share starter repo link a day before so we can clone on Wi-Fi."
              </div>
            </div>
          </div>
          ${renderOfficerNav('metrics')}`;
      }
    }
    return '';
  }

  /* ==========================================================================
     RENDER PIPELINE & EVENT WIRING
     ========================================================================== */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  const els = {
    tabStudent: document.getElementById('tabStudent'),
    tabOfficer: document.getElementById('tabOfficer'),
    journeyList: document.getElementById('journeyList'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    phoneFrame: document.getElementById('phoneFrame'),
    phoneScreen: document.getElementById('phoneScreen'),
    phoneToast: document.getElementById('phoneToast'),
    ctxFr: document.getElementById('ctxFr'),
    ctxTitle: document.getElementById('ctxTitle'),
    ctxDesc: document.getElementById('ctxDesc'),
    ctxVarCard: document.getElementById('ctxVarCard'),
    ctxHints: document.getElementById('ctxHints'),
    mobileRoleBtn: document.getElementById('mobileRoleBtn'),
    mobileVarBtn: document.getElementById('mobileVarBtn'),
    mobileScreenSelect: document.getElementById('mobileScreenSelect')
  };

  function setVariation(v) {
    if (!hasOwnVariation(v)) return;
    state.variation = v;
    document.body.dataset.variation = v;
    const url = new URL(window.location.href);
    url.searchParams.set('v', v);
    window.history.replaceState(null, '', url.toString());
    renderAll();
  }

  function renderRail() {
    document.body.dataset.variation = state.variation;
    document.querySelectorAll('[data-variation-pick]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.variationPick === state.variation));
    });
    const varMeta = hasOwnVariation(state.variation) ? VARIATIONS[state.variation] : VARIATIONS['ccs-crest'];
    if (els.ctxVarCard) {
      els.ctxVarCard.innerHTML = `<strong>${varMeta.name}</strong>${varMeta.desc}`;
    }
    if (els.mobileVarBtn) {
      els.mobileVarBtn.textContent = varMeta.short;
    }

    const active = currentScreen();
    const isStudent = active.persona === 'student';
    els.tabStudent.setAttribute('aria-pressed', String(isStudent));
    els.tabOfficer.setAttribute('aria-pressed', String(!isStudent));

    const personaScreens = SCREENS.filter((s) => s.persona === active.persona);
    let html = '';
    let lastStage = '';
    for (const s of personaScreens) {
      if (s.stage !== lastStage) {
        html += `<li class="journey-stage">${s.stage}</li>`;
        lastStage = s.stage;
      }
      html += `
        <li>
          <button type="button" class="journey-item-btn" data-nav="${s.id}" ${s.id === active.id ? 'aria-current="page"' : ''}>
            <span class="journey-num tabular">${s.num}</span>
            <span>${s.title}</span>
          </button>
        </li>`;
    }
    els.journeyList.innerHTML = html;

    const idx = SCREENS.findIndex((s) => s.id === active.id);
    els.prevBtn.disabled = idx <= 0;
    els.nextBtn.disabled = idx >= SCREENS.length - 1;

    // Context strip
    els.ctxFr.textContent = active.fr;
    els.ctxTitle.textContent = `${active.num}. ${active.title}`;
    els.ctxDesc.textContent = active.desc;
    els.ctxHints.innerHTML = active.hints.map((h) => `<li>${h}</li>`).join('');

    // Mobile switcher
    els.mobileRoleBtn.textContent = isStudent ? 'Student → Officer' : 'Officer → Student';
    els.mobileScreenSelect.innerHTML = personaScreens
      .map((s) => `<option value="${s.id}" ${s.id === active.id ? 'selected' : ''}>${s.num}. ${s.title}</option>`)
      .join('');
  }

  function renderPhone() {
    const active = currentScreen();
    els.phoneFrame.classList.toggle('phone-frame--dark', active.id === 'o3');
    els.phoneScreen.innerHTML = renderScreenHtml(active.id);
    renderToast();
  }

  function renderAll() {
    renderRail();
    renderPhone();
  }

  // Global delegated click handling
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.dataset.variationPick) {
      setVariation(target.dataset.variationPick);
      return;
    }
    if (target.id === 'mobileVarBtn') {
      const keys = Object.keys(VARIATIONS);
      const next = keys[(keys.indexOf(state.variation) + 1) % keys.length];
      setVariation(next);
      return;
    }
    if (target.dataset.applyOrg) {
      if (target.dataset.applyOrg === 'council') {
        state.applyOrg = { id: 'council', name: 'CCS Student Council', sub: 'Main organization · CCS' };
      } else {
        state.applyOrg = { id: 'guild', name: 'Web Dev Guild', sub: 'Sub-org of CCS Student Council' };
      }
      goTo('s5');
      return;
    }
    if (target.dataset.openScanner) {
      const org = state.orgs[state.orgIndex] || state.orgs[0];
      state.scannerEvent = { title: org.eventTitle, org: org.name, offset: org.offset };
      state.checkedIn = org.checkedIn;
      state.checkedOut = org.checkedOut;
      state.toSync = org.toSync;
      state.writtenScans = new Set();
      state.scanRepeatNotice = '';
      state.scanMode = 'present';
      goTo('o3');
      return;
    }
    if (target.id === 'verifyOtpBtn') {
      const complete = state.otp.length === 6 && state.otp.every((d) => /^\d$/.test(d));
      if (!complete) {
        showToast('Enter all 6 digits of your verification code first');
        return;
      }
      goTo('s3');
      return;
    }
    if (target.dataset.nav) {
      goTo(target.dataset.nav);
      return;
    }
    if (target.dataset.toast) {
      showToast(target.dataset.toast);
      return;
    }
    if (target.id === 'tabStudent') {
      goTo('s1');
      return;
    }
    if (target.id === 'tabOfficer') {
      goTo('o1');
      return;
    }
    if (target.id === 'mobileRoleBtn') {
      goTo(currentScreen().persona === 'student' ? 'o1' : 's3');
      return;
    }
    if (target.id === 'prevBtn') {
      const idx = SCREENS.findIndex((s) => s.id === state.screenId);
      if (idx > 0) goTo(SCREENS[idx - 1].id);
      return;
    }
    if (target.id === 'nextBtn') {
      const idx = SCREENS.findIndex((s) => s.id === state.screenId);
      if (idx < SCREENS.length - 1) goTo(SCREENS[idx + 1].id);
      return;
    }
    if (target.id === 'resendOtpBtn') {
      showToast('New 6-digit OTP sent via Resend SMTP');
      return;
    }
    if (target.id === 'notifBellBtn') {
      showToast('1 unread: Your GMetrix key is ready (no raw key in push)');
      return;
    }
    if (target.dataset.feedFilter) {
      state.feedFilter = target.dataset.feedFilter;
      renderPhone();
      return;
    }
    if (target.dataset.builtSite) {
      state.appBuiltSite = target.dataset.builtSite;
      renderPhone();
      return;
    }
    if (target.dataset.track) {
      const t = target.dataset.track;
      const nowChecked = !state.appTracks.has(t);
      if (nowChecked) state.appTracks.add(t);
      else state.appTracks.delete(t);
      target.setAttribute('aria-checked', String(nowChecked));
      const box = target.querySelector('.check-box');
      if (box) box.innerHTML = nowChecked ? ICONS.check : '';
      return;
    }
    if (target.dataset.gitRating) {
      state.appGitRating = Number(target.dataset.gitRating);
      renderPhone();
      return;
    }
    if (target.id === 'submitAppBtn') {
      state.appSubmitted = true;
      if (state.applyOrg.id === 'guild') {
        const juanRecord = {
          id: 'a-juan',
          initials: 'JD',
          color: 'brand',
          name: 'Juan Dela Cruz',
          applied: 'Just now',
          status: 'pending',
          section: state.appSection.trim() || 'BSIT 2-1',
          built: state.appBuiltSite,
          link: state.appBuiltSite === 'Yes' ? state.appPortfolio.trim() : '',
          tracks: Array.from(state.appTracks).join(', ') || 'None selected',
          git: `${state.appGitRating} of 5`
        };
        const existingIdx = state.applicants.findIndex((a) => a.id === 'a-juan');
        if (existingIdx >= 0) state.applicants[existingIdx] = juanRecord;
        else state.applicants.unshift(juanRecord);
      }
      renderPhone();
      showToast(`Application submitted to ${state.applyOrg.name} · Status: Pending`);
      return;
    }
    if (target.id === 'resetAppBtn') {
      state.appSubmitted = false;
      state.applicants = state.applicants.filter((a) => a.id !== 'a-juan' || a.status !== 'pending');
      renderPhone();
      return;
    }
    if (target.id === 'flipCardBtn') {
      state.qrFlipped = !state.qrFlipped;
      renderPhone();
      return;
    }
    if (target.id === 'brightBtn') {
      state.qrBright = !state.qrBright;
      renderPhone();
      return;
    }
    if (target.dataset.certTab) {
      state.certTab = target.dataset.certTab;
      renderPhone();
      return;
    }
    if (target.dataset.revealKey) {
      const k = target.dataset.revealKey;
      if (state.revealedKeys.has(k)) state.revealedKeys.delete(k);
      else state.revealedKeys.add(k);
      renderPhone();
      return;
    }
    if (target.dataset.copyKey) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(target.dataset.copyKey)
          .then(() => showToast('GMetrix key copied to clipboard'))
          .catch(() => showToast('Clipboard unavailable — tap Reveal key to copy manually'));
      } else {
        showToast('Clipboard unavailable — tap Reveal key to copy manually');
      }
      return;
    }
    if (target.dataset.evalRating) {
      state.evalRating = Number(target.dataset.evalRating);
      renderPhone();
      return;
    }
    if (target.dataset.evalFollowup) {
      state.evalFollowup = target.dataset.evalFollowup;
      renderPhone();
      return;
    }
    if (target.dataset.evalUseful) {
      const opt = target.dataset.evalUseful;
      const nowChecked = !state.evalUseful.has(opt);
      if (nowChecked) state.evalUseful.add(opt);
      else state.evalUseful.delete(opt);
      target.setAttribute('aria-checked', String(nowChecked));
      const box = target.querySelector('.check-box');
      if (box) box.innerHTML = nowChecked ? ICONS.check : '';
      return;
    }
    if (target.id === 'submitEvalBtn') {
      if (state.evalSubmitted) return;
      state.evalSubmitted = true;
      renderPhone();
      showToast('Evaluation submitted once for Hack Night');
      return;
    }
    if (target.id === 'resetEvalBtn') {
      state.evalSubmitted = false;
      renderPhone();
      return;
    }
    if (target.id === 'switchOrgBtn') {
      state.orgIndex = (state.orgIndex + 1) % state.orgs.length;
      renderPhone();
      showToast(`Switched to ${state.orgs[state.orgIndex].name}`);
      return;
    }
    if (target.id === 'publishEvtBtn') {
      if (state.evtModality === 'online' && !isValidMeetingLink(state.evtLink)) {
        showToast('Enter a valid Google Meet, Zoom, or MS Teams HTTPS link before publishing');
        return;
      }
      showToast(state.evtModality === 'online'
        ? 'Online event published with validated meeting link'
        : 'Onsite event published and cached for offline scanning');
      return;
    }
    if (target.dataset.modality) {
      state.evtModality = target.dataset.modality;
      renderPhone();
      return;
    }
    if (target.dataset.scanSim) {
      const m = target.dataset.scanSim;
      state.scanMode = m;
      state.scanRepeatNotice = '';
      if (m === 'present' || m === 'late') {
        if (state.writtenScans.has(m)) {
          state.scanRepeatNotice = 'Already recorded in local SQLite queue (duplicate ignored).';
        } else {
          state.writtenScans.add(m);
          state.checkedIn += 1;
          state.toSync += 1;
        }
      } else if (m === 'checkout') {
        if (state.writtenScans.has('checkout')) {
          state.scanRepeatNotice = 'Already checked out — duplicate scan ignored (no-op).';
        } else {
          state.writtenScans.add('checkout');
          state.checkedOut += 1;
          state.toSync += 1;
        }
      }
      renderPhone();
      return;
    }
    if (target.dataset.appTab) {
      state.applicantTab = target.dataset.appTab;
      const first = state.applicants.find((a) => a.status === state.applicantTab);
      state.expandedApplicantId = first ? first.id : null;
      renderPhone();
      return;
    }
    if (target.dataset.expandApplicant) {
      const aid = target.dataset.expandApplicant;
      state.expandedApplicantId = state.expandedApplicantId === aid ? null : aid;
      renderPhone();
      return;
    }
    if (target.dataset.decideApplicant) {
      const [aid, nextStatus] = target.dataset.decideApplicant.split(':');
      const person = state.applicants.find((a) => a.id === aid);
      if (person) {
        person.status = nextStatus;
        const nextPending = state.applicants.find((a) => a.status === state.applicantTab);
        state.expandedApplicantId = nextPending ? nextPending.id : null;
        renderPhone();
        showToast(`${person.name} marked ${nextStatus}`);
      }
    }
  });

  // Delegated input handling (in-place updates preserve keyboard focus)
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'signupEmail') {
      state.email = el.value;
      const valid = isValidInstitutionalEmail(state.email, el);
      el.classList.toggle('input--invalid', !valid);
      el.setAttribute('aria-invalid', String(!valid));
      const hint = document.getElementById('signupEmailHint');
      const hintText = document.getElementById('signupEmailHintText');
      if (hint) {
        hint.classList.toggle('field-hint--ok', valid);
        hint.classList.toggle('field-hint--err', !valid);
      }
      if (hintText) {
        hintText.textContent = valid
          ? 'Only @lpunetwork.edu.ph addresses can sign up.'
          : 'Enter a valid @lpunetwork.edu.ph address (enforced server-side).';
      }
      const btn = document.getElementById('sendOtpBtn');
      if (btn) btn.disabled = !valid;
      return;
    }
    if (el.dataset.otp !== undefined) {
      const i = Number(el.dataset.otp);
      const val = el.value.replace(/\D/g, '').slice(-1);
      state.otp[i] = val;
      el.value = val;
      if (val && i < 5) {
        const next = document.querySelector(`[data-otp="${i + 1}"]`);
        if (next) next.focus();
      }
      return;
    }
    if (el.id === 'appSectionInput') { state.appSection = el.value; return; }
    if (el.id === 'appPortfolioInput') { state.appPortfolio = el.value; return; }
    if (el.id === 'evalWhyNotInput') { state.evalWhyNot = el.value; return; }
    if (el.id === 'evtTitleInput') { state.evtTitle = el.value; return; }
    if (el.id === 'evtGraceInput' || el.id === 'evtLateInput') {
      if (el.id === 'evtGraceInput') state.evtGrace = Math.max(0, Number(el.value) || 0);
      else state.evtLate = Math.max(0, Number(el.value) || 0);
      const lateEl = document.getElementById('evtTimelineLate');
      const absentEl = document.getElementById('evtTimelineAbsent');
      if (lateEl) lateEl.textContent = `${formatEventOffset(state.evtGrace)} late`;
      if (absentEl) absentEl.textContent = `${formatEventOffset(state.evtGrace + state.evtLate)} absent`;
      return;
    }
    if (el.id === 'evtCooldownInput') { state.evtCooldown = Number(el.value); return; }
    if (el.id === 'evtAutoOutInput') { state.evtAutoOut = Number(el.value); return; }
    if (el.id === 'evtLinkInput') {
      state.evtLink = el.value;
      const valid = isValidMeetingLink(state.evtLink);
      el.classList.toggle('input--invalid', !valid);
      el.setAttribute('aria-invalid', String(!valid));
      const hint = document.getElementById('evtLinkHint');
      const hintText = document.getElementById('evtLinkHintText');
      if (hint) {
        hint.classList.toggle('field-hint--ok', valid);
        hint.classList.toggle('field-hint--err', !valid);
      }
      if (hintText) {
        hintText.textContent = valid
          ? 'Trusted meeting host · visible to registered students.'
          : 'Use a valid Google Meet, Zoom, or MS Teams HTTPS link.';
      }
      return;
    }
  });

  els.mobileScreenSelect.addEventListener('change', (e) => {
    goTo(e.target.value);
  });

  // Keyboard shortcuts (ArrowLeft / ArrowRight when not typing in an input)
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const idx = SCREENS.findIndex((s) => s.id === state.screenId);
    if (e.key === 'ArrowRight' && idx < SCREENS.length - 1) goTo(SCREENS[idx + 1].id);
    if (e.key === 'ArrowLeft' && idx > 0) goTo(SCREENS[idx - 1].id);
  });

  // Support URL query ?v=variation and hash #s7 deep-linking
  const initialVar = new URLSearchParams(window.location.search).get('v');
  if (hasOwnVariation(initialVar)) {
    state.variation = initialVar;
  }
  document.body.dataset.variation = state.variation;

  function syncFromHash() {
    const h = window.location.hash.replace('#', '');
    if (SCREENS.some((s) => s.id === h)) {
      state.screenId = h;
      state.toast = null;
      renderAll();
    }
  }
  window.addEventListener('hashchange', syncFromHash);
  syncFromHash();
  renderAll();
})();

# BillSorter Landing Page — Plan

**Domain:** billsorter.app (Hinweis: vorher war im Master-Plan `.de` — bitte bestätigen welche es final ist)
**Status:** ENTWURF — wartet auf User-OK vor Build

---

## 1. Tech-Stack final

| Layer | Tech | Begründung |
|---|---|---|
| Static Site | **Astro 4** | Beste SSG-Story + Inseln für interaktive Komponenten, perfekt für Marketing |
| Styling | **Tailwind 3** + CSS Variables | Selbe Tokens wie App-Renderer (#5923c2 → `brand-700` Override, Inter) |
| Smooth-Scroll | **Lenis 1.1** | Velocity-basiert, GSAP-kompatibel, mobile-friendly |
| Animationen | **GSAP 3** + ScrollTrigger | ScrollTrigger ist free (Club GreenSock only für SplitText etc. — wir umgehen das mit eigenem Splitter) |
| 3D | **three.js** + `@react-three/fiber`-Pendant für Astro — wir nutzen Vanilla Three.js | r3f wäre nice aber React zieht zu viel Bundle in Astro-Inseln. Vanilla Three reicht für 2-3 Szenen |
| 3D Loader | `GLTFLoader` + `DRACOLoader` | Compressed Models |
| Partikel | **OGL** (~10KB) ODER eigene WebGL Points mit Three | OGL für Hero-Background — viel leichter als Three für reines Particle |
| Icons | `lucide` (Astro-package) | gleiche Icons wie App |
| Fonts | **Inter** (self-hosted woff2) | Variable-Font, 5 weights |
| Deploy | Cloudflare Pages | gleiche Plattform wie Backend |
| i18n | Eigene `t()`-Helper via JSON-Files + State im `lang`-Cookie/localStorage | Astro-i18n-Modul ist OK aber für SPA-Switch ohne Reload baue ich Client-Hydration |

### Bundle-Budget

| Page | Target | Komponenten |
|---|---|---|
| HTML | <30 KB | minimaler shell |
| Critical CSS inline | <20 KB | hero + nav |
| First-paint JS | <5 KB | nur Lenis + Lang-Toggle |
| Three.js Hero | lazy, <200 KB | dynamic import nach LCP |
| 3D Models | <500 KB (Draco-komprimiert) | MacBook GLB ~300 KB |
| **Total over wire** | <800 KB initial, <2 MB nach allen Animationen | Konkurrenzfähig mit Apple/Linear-Niveau |

---

## 2. Projektstruktur

```
~/BillSorter/website/
├── package.json              astro, tailwindcss, gsap, lenis, three, ogl
├── astro.config.mjs          @astrojs/tailwind + sitemap + compress
├── tailwind.config.ts        brand: #5923c2, ink-50: #fbfbfb, ink-950: #080808
├── tsconfig.json
├── wrangler.toml             Cloudflare Pages config
├── README.md
│
├── public/
│   ├── favicon.png           ← copy von app/resources/logo-icon.png
│   ├── og-image.png          1200×630 für Social-Sharing
│   ├── billsorter.dmg        Download-Asset (oder Redirect zu GitHub-Releases)
│   ├── billsorter-setup.exe
│   ├── models/
│   │   ├── macbook.glb       Draco-compressed
│   │   └── iphone.glb
│   └── screens/
│       ├── dashboard.png     Screenshot von der echten App
│       └── wizard.png
│
├── src/
│   ├── pages/
│   │   ├── index.astro       Landing
│   │   ├── install-mac.astro Gatekeeper-Anleitung
│   │   ├── install-windows.astro
│   │   ├── impressum.astro
│   │   ├── datenschutz.astro
│   │   ├── agb.astro
│   │   └── widerruf.astro
│   │
│   ├── components/
│   │   ├── Nav.astro                Sticky, Glass on scroll, Lang-Toggle
│   │   ├── LangToggle.astro         🇩🇪 / 🇬🇧, persistiert in localStorage
│   │   ├── Hero.astro               + HeroScene.client.ts (3D)
│   │   ├── ProblemSection.astro     + EmailChaos.client.ts (Canvas-Anim)
│   │   ├── FeatureScroller.astro    + FeatureScroller.client.ts (horizontal scroll)
│   │   ├── HowItWorks.astro         + LineDrawer.client.ts (SVG path animation)
│   │   ├── PricingCard.astro        Glassmorphism, no JS
│   │   ├── Footer.astro
│   │   ├── Badge.astro              "7 Tage kostenlos", rotating
│   │   ├── DownloadButtons.astro    Mac + Win
│   │   ├── Typewriter.astro         + Typewriter.client.ts
│   │   └── ScrollIndicator.astro
│   │
│   ├── scenes/
│   │   ├── heroMacbook.ts           Three.js scene mgmt
│   │   ├── howItWorksPhone.ts       Three.js scene mgmt
│   │   └── particles.ts             OGL particle system
│   │
│   ├── lib/
│   │   ├── i18n.ts                  t(key), useLang() — client store
│   │   ├── animations.ts            GSAP timelines
│   │   ├── lenis.ts                 Smooth-scroll init
│   │   ├── prefersReducedMotion.ts
│   │   └── isMobile.ts              UA + width check
│   │
│   ├── content/
│   │   ├── de.json                  alle Strings
│   │   └── en.json
│   │
│   ├── styles/
│   │   ├── global.css               @tailwind base; tokens
│   │   └── typography.css           Fluid type scale
│   │
│   └── layouts/
│       └── Base.astro               <html lang> + meta + nav + footer
│
└── scripts/
    └── optimize-models.sh           Draco-compress GLBs
```

---

## 3. Section-Breakdown mit Animationen

### **Hero** (`#hero`, viewport-height)

**Visual:**
- Schwarzer Hintergrund `#080808`
- Three.js Canvas full-bleed, hinter Content
- 3D MacBook (GLB-Model, Draco-compressed) leicht rotiert (-15° X-axis), schwebt mit `sin(t * 0.5) * 0.05` Y-Position
- Auf Macbook-Display: Plane mit Texture aus `screens/dashboard.png` (real App-Screenshot mit lila Akzenten)
- WebGL Particles (OGL): 80 lila Punkte, react auf Maus mit Verlauf
- Headline: `"Your inbox. Sorted."` mit Typewriter (Buchstabe-für-Buchstabe, ~80ms per char)
- Sub: `"Automatische Rechnungs-Erkennung in deinen E-Mails. Powered by Claude AI."`
- 2 CTAs: `[Jetzt 7 Tage testen]` (lila), `[How it works ↓]` (ghost)
- Scroll-Indicator unten: Inter "Scroll" + animierter Pfeil (pulse + slide down)

**Animationen:**
1. **Mount:** MacBook fadet in von Y+20 + rotation (-30° auf -15°), 1.2s ease-out
2. **Typewriter:** "Your inbox." Pause "Sorted." — Cursor blinkt
3. **Particle field:** auf `mousemove` → particles repulsen vom Cursor
4. **Scroll out:** MacBook fliegt nach hinten (Z -8) + scaled 0.5, fadet out — auf 100vh Scroll
5. **Background morph:** `#080808 → #fbfbfb` parallel zum Macbook-Fly-Away (GSAP ScrollTrigger pin + scrub)

---

### **Problem** (`#problem`, ~120vh wegen pin)

**Visual:**
- Weißer Hintergrund `#fbfbfb`
- Headline: `"Stop losing invoices in your inbox."` (split in 3 Zeilen, jede Zeile staggered fade-up)
- Visual: Großes Canvas (1100×500), zeigt zuerst **10 E-Mail-Karten chaotisch** verstreut, drehend, überlappend
- Bei Scroll: ein "Sortier-Sweep" — Mails fliegen in **3 Stacks** (Januar/Februar/März-Ordner)
- 3 Pain-Cards unten, fliegen rein:
  - Links: `"Stunden mit Suchen vergeudet"` — Lupe-Icon
  - Mitte: `"Steuerberater wartet auf Belege"` — Uhr-Icon
  - Rechts: `"Rechnungen gehen verloren"` — Mail-Strike-Icon

**Animationen:**
1. Sticky-pin der Section für 120% Höhe
2. **Phase 1 (0-50% scroll)**: Mails wibbeln chaotisch (Canvas-Loop), Pain-Cards von links/rechts mit `x: ±100, opacity: 0 → 0, 1`
3. **Phase 2 (50-100% scroll)**: GSAP timeline triggert "sort sweep" — Mails fliegen zu Stacks mit Stagger
4. Parallax: Headline scrollt langsamer als Cards (-30%)

**Canvas-Engine:** vanilla 2D Canvas mit eigener Physics (no Matter.js — overkill). Mails sind PNG-Sprite (gerendertes "Mail mit Anhang"-Symbol).

---

### **Features** (`#features`, ~400vh wegen horizontal-scroll)

**Visual:**
- Schwarzer Hintergrund `#080808`
- Bei `enter` pinned die Section, vertikaler Scroll wird zu horizontalem Move einer 4-Karten-Strecke
- 4 Karten je 80vw breit, 60vh hoch:

  | # | Titel | 3D-Element |
  |---|---|---|
  | 1 | **Auto-Scan** | rotierende Uhr (Three.js primitive — Cylinder + Spheres als Indikatoren) |
  | 2 | **KI-Erkennung** | pulsierender Lila-Würfel mit Wireframe + Glow-Pass (Bloom) |
  | 3 | **Monatsordner** | gestapelte Karten die sich öffnen wie Fächer |
  | 4 | **Multi-Provider** | Provider-Logos auf einer Kugel kreisend (Sphere mit Texture-Plane-Children) |

- Jede Karte: 3D-Element links, Text rechts (Titel `text-5xl font-bold`, Beschreibung 2-3 Zeilen, Bulletpoints)

**Animationen:**
1. **Pin + Horizontal scrub**: `gsap.to('.cards-rail', { x: '-300vw', scrollTrigger: { trigger, pin: true, scrub: 1, end: '+=400%' } })`
2. **Active card scaling**: aktuelle Karte ist `scale: 1`, Nachbarn `scale: 0.85, opacity: 0.5`
3. **3D-Object** in aktiver Karte rotiert (continuous), beim Wechsel: scale 0 → 1 (entry-anim)
4. **Progress dots** oben zeigen Position (1 von 4 etc.)

---

### **How it Works** (`#how`, ~120vh)

**Visual:**
- Weißer Hintergrund `#fbfbfb`
- 3 Schritte vertikal angeordnet:
  - **01.** "Download & Install" — Mac/Win Toggle, zeigt Drop-down-Animation
  - **02.** "Connect your mailbox" — Provider-Multi-Select Anim
  - **03.** "Done. Watch BillSorter sort." — Pfeil animiert in Postfach
- Große, lila, Outline-Numbers (`text-[10rem]`) leicht clip-pathed
- **SVG-Verbindungslinie** zwischen den Steps zeichnet sich beim Scrollen (stroke-dashoffset → 0)
- Daneben: 3D-Phone (kleiner als Hero-MacBook, Three.js), zeigt animierten Setup-Wizard-Screen
- Phone neigt sich beim Scrollen (parallax-tilt)

**Animationen:**
1. **Line draw**: GSAP timeline, scrub-linked, `strokeDashoffset` 1000 → 0 über 300vh
2. **Step-fade-in**: jeder Step fade+slide-up bei `start: 'top 70%'`
3. **Phone tilt**: rotateZ ±5° basierend auf Scroll-Velocity

---

### **Pricing** (`#pricing`, ~100vh)

**Visual:**
- **Vollflächiger** Brand-Hintergrund `#5923c2` mit subtilem Noise-Pattern (CSS `data:` SVG)
- Eine zentrale **Glassmorphism-Card** (max-w-md):
  - `backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl`
  - "BillSorter Pro" Header
  - Riesige Preis-Zahl: `4,99 €` (text-7xl) + `/ Monat` (text-base, opacity-60)
  - 4 Feature-Checkmarks (unlimited mailboxes, KI, Monatsordner, Mac+Win)
  - 2 Download-Buttons:
    - `[ macOS herunterladen ]` (white solid)
    - `[ Windows herunterladen ]` (white outline)
  - Kleingedrucktes: "7 Tage kostenlos. Jederzeit kündbar. inkl. MwSt."
- **Drehender Badge** "7 Tage GRATIS" — runder Aufkleber an der Card oben rechts, rotation infinite

**Animationen:**
1. **Card-Float**: `y: 0` ↔ `y: -8` mit `sin(t * 1.2)` (continuous, JS)
2. **Badge-Rotation**: `rotate: 360deg` über 20s linear infinite (CSS keyframes)
3. **Parallax-BG-Noise**: bei Scroll bewegt sich Noise minimal
4. **Card-Entry**: zoom-in (0.9 → 1) + fade-up bei viewport-enter

---

### **Footer** (`#footer`)

**Visual:**
- Schwarz `#080808`
- Top-row: Logo + 4 Spalten Links:
  - Product: Features, Pricing, Download
  - Legal: Impressum, AGB, Datenschutz, Widerruf
  - Support: FAQ, Kontakt
  - Company: Über uns
- Bottom-row: © 2026 ARGAVIS · Made with Claude · Sprache: 🇩🇪 / 🇬🇧
- Social-Icons (X, GitHub) — nur falls vorhanden

**Animationen:** keine, ruhiger Abschluss.

---

## 4. i18n — DE / EN ohne Reload

**Architektur:**
- `content/de.json` und `content/en.json` mit allen Strings (genau wie Renderer, geteilte Keys)
- Astro rendert Server-side mit Default-Sprache (DE bei `de-*` Browser-Locale, sonst EN)
- Client-JS `i18n.ts` hydratet `data-i18n-key`-Attribute neu auf Toggle
- Persist in `localStorage` + Cookie (für SSR-Default beim nächsten Visit)

**Toggle UX:**
- Top-rechts in Nav: zwei Flaggen-Buttons nebeneinander, aktive Sprache `font-bold opacity-100`, inaktive `opacity-50`
- Click: `[data-i18n-key]`-Loop, switch text, update html.lang

**Coverage:**
| Section | Keys |
|---|---|
| Hero | headline, subline, cta-trial, cta-howto |
| Problem | headline, pain1/2/3 (mit titel + body) |
| Features | 4× (title + description + 3 bullets) |
| HowItWorks | step1/2/3 (number, title, body) |
| Pricing | plan-name, per-month, vat, features × 4, cta-mac, cta-win, fineprint, badge |
| Footer | 4 Spalten × Links, copyright |
| Install-Pages | komplett |
| Legal | komplett (Texte musst du liefern oder Template-Generator) |

Geschätzte Anzahl Keys: **~80**

---

## 5. Assets — was du brauchst / was ich beschaffe

| Asset | Quelle | Status |
|---|---|---|
| `logo-wordmark.png` | bereits in `app/resources/` (getrimmt) | ✅ copy from there |
| `logo-icon.png` | dito | ✅ |
| `og-image.png` 1200×630 | **musst du designen** in Canva/Figma — Hero-Visual mit Logo + Tagline | ⏳ User-Action |
| `macbook.glb` | **Poly Haven** oder **Sketchfab** (CC0/CC-BY) → ich lade + Draco-compresse | ⏳ I'll pick |
| `iphone.glb` (für How-It-Works) | dito | ⏳ I'll pick |
| `dashboard.png` Screenshot | aus laufender App: `screencapture` (du machst, weil TCC mich blockt) | ⏳ User-Action |
| `wizard.png` Screenshot | dito | ⏳ User-Action |
| Provider-Icons (Gmail, Outlook, etc.) | als SVG inline | ✅ ich erstelle/beschaffe |
| Noise-Pattern für Pricing | CSS-data-URL | ✅ ich generiere |
| Mail-Sprite für Problem-Canvas | SVG/PNG, ich erstelle | ✅ |
| Inter Woff2 | rsms.me self-host | ✅ |

---

## 6. Performance + Accessibility

- **Lazy 3D**: Three.js und Models laden erst nach `requestIdleCallback` ODER Intersection-Observer auf Hero-Section. Initial-paint ist HTML+CSS-only
- **Reduced-Motion**: `@media (prefers-reduced-motion)` → alle Scroll-Anims werden disabled, Particles aus, MacBook ist statisches PNG-Mockup
- **Mobile** (`<768px`): kein Three.js — stattdessen statisches MacBook-Mockup (gerenderte PNG), kein Horizontal-Scroll-Panel sondern vertical Cards, kein Lenis (native scroll)
- **Lighthouse-Target**: Mobile 95+, Desktop 99+
- **A11y**: 
  - Alle Animationen haben Text-Alternativen
  - Buttons sind echte `<button>`, Links echte `<a>`
  - Color-Contrast WCAG AA überall, Brand-700 auf Weiß = 6.4:1 ✓
  - Skip-to-content-Link
  - Lang-Toggle ist `<button aria-pressed>` mit Screen-Reader-Label

---

## 7. Open Decisions

1. **Domain final**: `billsorter.app` oder `billsorter.de`? (vorher war `.de` im Master-Plan)
2. **Download-Hosting**:
   - (a) GitHub Releases (empfohlen, Auto-Update-Story sauber)
   - (b) Cloudflare R2 (`downloads.billsorter.app`)
3. **MacBook-3D-Modell**:
   - (a) Pre-built GLB von Sketchfab CC0
   - (b) Apple-style simplified Three.js primitives (kein Branding-Issue, weniger detail)
4. **OG-Image**: machst du selber in Canva oder soll ich SVG-Code generieren?
5. **Screenshots**: machst du selber von der laufenden App?
6. **Legal-Texte**: liefere ich Templates (Impressum/Datenschutz/AGB/Widerruf) generisch — du füllst ARGAVIS-Daten ein. OK?
7. **Pricing-Badge "7 Tage GRATIS"**: drehend OK oder soll's statisch sein (drehende Badges sind manchmal "cheesy")?
8. **Logo-Pfad**: du hast `~/BillSorter/app/resources/Billsorter Logo.png` geschrieben — das File existiert nicht mehr unter dem Namen. Es heißt jetzt `logo-wordmark.png` (getrimmt). Wir nutzen das.

---

## 8. Build-Reihenfolge

| Stage | Inhalt | Aufwand |
|---|---|---|
| 1 | Scaffold Astro + Tailwind + Tokens, Layout, Nav, Footer | 0.5d |
| 2 | i18n-System + DE/EN-Toggle, alle Strings | 0.5d |
| 3 | Hero ohne 3D (statisches Mockup) → Typewriter, BG-Morph | 0.5d |
| 4 | Hero 3D MacBook + Particles | 1.0d |
| 5 | Problem-Section + Email-Chaos-Canvas | 0.5d |
| 6 | Feature-Horizontal-Scroll + 3D-Primitives | 1.0d |
| 7 | How-It-Works + SVG-Line + 3D-Phone | 0.5d |
| 8 | Pricing + Glassmorphism + Download-Buttons | 0.3d |
| 9 | Install-Pages (Mac/Win) + Legal-Templates | 0.5d |
| 10 | Mobile-Fallback + Reduced-Motion | 0.5d |
| 11 | Lighthouse-Pass + Cloudflare-Pages-Deploy | 0.5d |
| **Total** | | **~6.5 Tage** |

MVP-Cut ohne 3D: **3 Tage** (CSS+SVG-only, immer noch slick).

---

## 9. Risiken

1. **Three.js Bundle blows up** → halten wir <300 KB via Draco + Tree-shaking. Plan B: simpler primitives (kein .glb)
2. **GSAP Club-Plugins**: SplitText, MotionPath, ScrollSmoother sind paid. Wir benutzen NUR ScrollTrigger (free) und bauen Splitter selber (5 Zeilen Code).
3. **Mobile Performance**: alles 3D ist `if (!isMobile)`-gated.
4. **Apple/Google M1 Test**: 3D auf Lenovo-Laptops könnte hakeln — ich teste auf einem niedrigen `prefers-reduced-data` Setup
5. **OG-Image-SEO**: ohne richtiges OG-Image teilt sich die Page schlecht. Pflichtaufgabe vor Launch
6. **Logo dargestellt richtig**: ich nutze die getrimmte PNG die wir haben. Wenn du eine cleane Vektor-Variante als SVG hast, geht's noch schärfer auf allen Screen-Densities
7. **Stripe-Bezug**: die Pricing-Card sollte irgendwann auch direkt Checkout starten können — aber für Marketing-Page reicht zunächst "Download → Trial startet automatisch in App". Voll-Stripe-Flow läuft in der App, Marketing-Page ist nur Entry-Point.

---

**ENDE PLAN — warte auf dein OK / Änderungswünsche.**

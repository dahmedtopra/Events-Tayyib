# TODO.md — Event AI Guide Kiosk

Owner: Daniyal / ICHS
Stack: React+Vite+TS+Tailwind (FE) | FastAPI (BE) | Chroma local | SQLite logs | OpenAI Responses API (gpt-4o) | text-embedding-3-large

---

## 0) Project setup (Day 1)
- [ ] Create repo `event-kiosk/` with monorepo structure:
  - `apps/kiosk-frontend/`
  - `apps/kiosk-backend/`
  - `packages/shared-schema/`
  - `docs/` (PRD.md, DESIGN.md, TECH_RULES.md, TODO.md)
  - `data/` (offline_pack, rag_corpus, chroma_index)
  - `assets/` (tayyib_loops, branding)
- [ ] Add `.gitignore` (node, python, venv, data/*.sqlite, chroma_index, dist, build)
- [ ] Add `README.md` with local run steps (FE + BE)
- [ ] Add `.env.example` for backend with required env vars:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL=gpt-4o`
  - `OPENAI_EMBED_MODEL=text-embedding-3-large`
  - `PUBLIC_QR_BASE_URL=http://localhost:5173` (temporary)
  - `KIOSK_IDLE_TIMEOUT_SEC=60`
  - `SQLITE_PATH=./data/analytics.sqlite`
  - `CHROMA_PATH=./data/chroma_index`
  - `OFFLINE_PACK_PATH=./data/offline_pack/offline_pack.json`

---

## 1) Frontend scaffold (Day 1–2)
- [ ] Vite React TS app in `apps/kiosk-frontend`
- [ ] Tailwind setup
- [ ] App routes:
  - [ ] `/` Home (Attract)
  - [ ] `/ask`
  - [ ] `/guide`
  - [ ] `/pose`
  - [ ] `/share` (QR checklist destination)
- [ ] Global layout components:
  - [ ] `Header` (ICHS logo + title)
  - [ ] `Footer` (short disclaimer)
  - [ ] `TayyibPanel` (video loop player + state)
  - [ ] `LanguageLock` (language selection on Home, locked in session)
- [ ] RTL support:
  - [ ] `dir="rtl"` when lang=AR
  - [ ] mirrored layout for chat and sources panel

---

## 2) Core UI screens (Day 2–5)

### 2.1 Home / Attract
- [ ] Full-screen background (geometry + subtle particles; low opacity)
- [ ] Greeting line localized (EN/AR/FR)
- [ ] Language selector (EN/AR/FR) visible ONLY on Home
- [ ] Search bar + rotating placeholder examples
- [ ] Quick chips (top queries) localized
- [ ] Hero Tayyib (large loop)

### 2.2 Ask Mode (Chat + Sources)
- [ ] Chat layout:
  - [ ] Query card (user question)
  - [ ] Answer blocks: Direct / Steps / Mistakes / More details (collapsed)
- [ ] Sources panel/drawer:
  - [ ] Vertical: show 3 snippet cards + expand
  - [ ] Horizontal: show up to 5 snippet cards
- [ ] “Searching official sources…” state:
  - [ ] show for 1–2s minimum when calling backend (or until response)
- [ ] Refinement chips (returned from backend)
- [ ] On-screen keyboard (touch-friendly):
  - [ ] EN
  - [ ] FR
  - [ ] AR (RTL input)
- [ ] No scroll in main answer area; allow scroll only inside Sources panel

### 2.3 Guide Mode (Generic Wizard)
- [ ] Wizard steps (max 5):
  - [ ] First time? (Y/N)
  - [ ] Need Nusuk permit guidance? (Y/N)
  - [ ] Need Rawdah guidance? (Y/N)
  - [ ] Pace: Quick/Detailed
- [ ] Output checklist sections (collapsible to avoid scrolling)
- [ ] “Open on phone” QR button (uses `qr_url` from backend)

### 2.4 Pose Mode
- [ ] Full-screen pose frame layout
- [ ] Guest silhouette box
- [ ] Countdown + auto pose change loop (2–3 poses)
- [ ] Small ICHS watermark visible
- [ ] Buttons: Start / Next Pose / Back
- [ ] Optional QR opens a static pose-frame page (future; can skip if time)

### 2.5 Share Page (`/share`)
- [ ] Read `#d=<payload>` from URL fragment
- [ ] Decode + render checklist only
- [ ] Arabic RTL support
- [ ] “Copy checklist” button

---

## 3) Tayyib media integration (Day 3–6)
- [ ] Decide supported formats:
  - [ ] Prefer WebM with alpha
  - [ ] MP4 fallback supported via matching panel background
- [ ] Implement loop player:
  - [ ] preload current + next loop
  - [ ] seamless looping
- [ ] Define state map:
  - [ ] home_hero
  - [ ] idle
  - [ ] listening
  - [ ] searching
  - [ ] explaining_a
  - [ ] explaining_b
  - [ ] pose_a
  - [ ] pose_b
- [ ] Trigger states from UI actions:
  - [ ] typing -> listening
  - [ ] submit -> searching
  - [ ] answer displayed -> explaining_a/b alternate
  - [ ] pose -> pose loops

---

## 4) Backend scaffold (Day 2–4)
- [ ] FastAPI app in `apps/kiosk-backend`
- [ ] CORS for local frontend dev
- [ ] Endpoints:
  - [ ] `POST /api/ask`
  - [ ] `POST /api/guide`
  - [ ] `POST /api/feedback`
  - [ ] `GET /api/health`
- [ ] Shared schemas:
  - [ ] Define request/response Pydantic models matching FE needs
  - [ ] Mirror TS types in `packages/shared-schema`

---

## 5) Offline Answer Pack (Day 4–10)
- [ ] Create taxonomy (EN canonical):
  - [ ] Event schedule
  - [ ] Session details
  - [ ] Speaker info
  - [ ] Venue & directions
  - [ ] Registration help
  - [ ] Common mistakes
  - [ ] Out-of-scope handling
- [ ] Build `offline_pack.json` with 250–400 entries:
  - [ ] EN answers written first
  - [ ] Translate to AR (Fusha) + FR
  - [ ] Include question variants per language
- [ ] Implement offline matcher:
  - [ ] normalize text (case, diacritics optional)
  - [ ] simple fuzzy match / keyword match
  - [ ] return best match + confidence
- [ ] FE: add “Trending questions” chips from offline pack

---

## 6) RAG ingestion + Chroma index (Day 7–14)

### 6.1 Source approval workflow
- [ ] Create `data/rag_corpus/sources.yml` with:
  - title, url, language, approved_by, approved_date
- [ ] Add placeholder “ICHS stakeholder sign-off” fields

### 6.2 Ingestion script
- [ ] `scripts/ingest_sources.py`:
  - [ ] fetch / load documents (PDF/HTML as needed)
  - [ ] chunking (400–800 tokens, overlap 80–120)
  - [ ] embed with `text-embedding-3-large`
  - [ ] store in Chroma at `CHROMA_PATH`
  - [ ] store metadata (title/url/section/lang/approved_by/date)

### 6.3 Retrieval function
- [ ] `retrieve(query, lang)`:
  - [ ] translate query to EN if needed (use model or static mapping)
  - [ ] retrieve top_k=5
  - [ ] compute confidence score
  - [ ] return snippets with titles/urls

---

## 7) Generation (Ask) pipeline (Day 10–16)
- [ ] Implement `answer_query()` flow:
  1) [ ] detect language (or use locked session lang)
  2) [ ] try offline pack match
  3) [ ] else retrieve with Chroma
  4) [ ] if low confidence -> ask ONE clarifier (button options)
  5) [ ] else call OpenAI Responses API (gpt-4o) with:
      - [ ] strict JSON output
      - [ ] grounded on retrieved snippets
      - [ ] Saudi-official tone, no madhhab comparisons
  6) [ ] translate output to AR/FR if needed (Fusha for Arabic)
  7) [ ] return structured answer + sources + chips
- [ ] Hard timeouts:
  - [ ] model call timeout 8s
  - [ ] 1 retry max on transient errors
- [ ] Safety fallback:
  - [ ] “Not covered in official pack” template + generic next steps

---

## 8) Guide pipeline + QR payload (Day 12–18)
- [ ] Implement `POST /api/guide`:
  - [ ] generate checklist sections (Quick vs Detailed)
  - [ ] output as structured sections
  - [ ] create compact payload for QR:
    - [ ] JSON with lang + short checklist items
    - [ ] compress (gzip/deflate) + base64url
- [ ] Construct `qr_url`:
  - [ ] `${PUBLIC_QR_BASE_URL}/share#d=<payload>`
- [ ] FE: render QR code (large) + instruction line localized

---

## 9) Analytics + session feedback (Day 14–20)
- [ ] Session manager (FE):
  - [ ] create session_id at Home enter
  - [ ] track time_on_screen_ms
- [ ] End-of-session rating UI:
  - [ ] show 1–5 stars on return to Home or timeout
  - [ ] send `/api/feedback`
- [ ] SQLite logger (BE):
  - [ ] write session rows
  - [ ] write events (mode usage, route_used, latencies)
  - [ ] store hashed_query only (SHA-256 + salt)
- [ ] Admin panel (hidden gesture):
  - [ ] export CSV
  - [ ] health status
  - [ ] offline simulation toggle
  - [ ] reset app

---

## 10) Reliability hardening (Day 18–22)
- [ ] Offline simulation mode:
  - [ ] force “offline pack only”
- [ ] Idle timer:
  - [ ] auto-return to Home after inactivity
- [ ] Kiosk fullscreen notes (operator checklist):
  - [ ] browser kiosk mode steps documented
- [ ] Error UI:
  - [ ] never show stack traces
  - [ ] show friendly localized banners
- [ ] Performance tests:
  - [ ] 50 rapid questions (ensure no memory leak)
  - [ ] large keyboard typing stress
- [ ] Content QA:
  - [ ] test 50 queries per language
  - [ ] verify Arabic RTL and Fusha tone
  - [ ] verify sources display properly

---

## 11) Deliverables checklist (must be ready before travel)
- [ ] Final offline_pack.json (EN/AR/FR)
- [ ] Chroma index built and included in `data/chroma_index/`
- [ ] Tayyib loops finalized and placed in `assets/tayyib_loops/`
- [ ] Branding assets in `assets/branding/`
- [ ] Runbook:
  - [ ] how to start backend
  - [ ] how to start frontend
  - [ ] kiosk fullscreen steps
  - [ ] admin panel access
  - [ ] export logs steps

---

## Definition of Done (DoD)
- [ ] Ask answers work with internet off (offline pack + fallback)
- [ ] Ask answers show snippets/sources when RAG used
- [ ] Guide produces checklist + QR share page renders on phone
- [ ] Pose mode works and looks photo-worthy
- [ ] Full trilingual UI with Arabic RTL
- [ ] Session rating captured + exportable analytics
- [ ] No crashes, no scrolling in main panels

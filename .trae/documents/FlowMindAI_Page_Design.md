# FlowMind AI — Page Design Specification (Desktop-first)

## Global Styles (Design Tokens)
- Layout width: max 1200–1280px content; 12-col grid; 24px gutters; 16–24px spacing scale.
- Colors: background #0B1020; surface #111A33; text #EAF0FF; muted #9AA7C7; accent #6C7CFF; success #2ED47A; warning #FFB020; danger #FF5C7A.
- Typography: Inter/system; H1 28/32, H2 20/28, body 14/20, mono for timestamps.
- Buttons: primary (accent), secondary (surface border), ghost; hover = +6% brightness; disabled = 40% opacity.
- Inputs: 12px radius, subtle border, focus ring accent.
- Motion: 150–200ms ease; avoid heavy animation in schedule view.

## Page 1 — Home (FlowMind Workspace)
### Meta Information
- Title: “FlowMind AI — Workspace”
- Description: “Turn messy input into tasks and an adaptive schedule.”
- OG: title/description + app preview image.

### Layout
- Desktop: 3-pane hybrid (CSS Grid).
  - Left: Input + run actions.
  - Center: Tasks & summary.
  - Right: Schedule timeline + reschedule insights.
- Responsive: collapse to stacked sections under 1024px; schedule becomes a horizontal scroll timeline.

### Page Structure
1. **Top App Bar**
   - Left: product name + environment badge (Guest/Signed-in).
   - Center: tabs/links: Workspace, Workflow Demo.
   - Right: Sign in / Account menu.
2. **Left Pane: “Messy Input” Card**
   - Multiline textarea (paste/notes).
   - “Load sample” dropdown.
   - Primary CTA: “Convert to Tasks & Summary”.
   - Secondary CTA: “Save as Inbox Item” (signed-in only).
3. **Center Pane: Output**
   - **Summary Panel**: generated summary text; Copy button.
   - **Extracted Tasks Table**: title, due, estimate, priority, status.
   - Bulk actions: Accept all / Reject all / Add selected to inbox.
   - Inline editing: priority, estimate, due; complete checkbox.
4. **Right Pane: Schedule + TRAE**
   - **Schedule Timeline**: time blocks (start/end), color by state (planned/moved/blocked).
   - **Autonomous Scheduling Controls**: working hours preset, “Generate Schedule”.
   - **TRAE Reschedule**: “Reschedule Now” + explanation of what changed (moved tasks list + before/after times).
   - **Conflict Banner**: when tasks cannot fit; shows reason and suggested action.
5. **Run History Drawer (in-page)**
   - List of runs with timestamp, run type (convert/schedule/reschedule), open/compare.

## Page 2 — Workflow Visualization (Demo)
### Meta Information
- Title: “FlowMind AI — Workflow Demo”
- Description: “Visualize the pipeline from input to adaptive scheduling.”

### Layout
- Full-canvas graph area with a right-side inspector (CSS Grid: 1fr + 360px).
- Responsive: inspector becomes bottom sheet under 1024px.

### Sections & Components
1. **Top Bar**
   - Back to Workspace, run selector (sample run), playback controls.
2. **Graph Canvas**
   - Nodes: Input, Parse, Tasks, Summary, Schedule, TRAE Reschedule, Output.
   - Interactions: zoom/pan, fit-to-screen, click node to highlight path.
3. **Inspector Panel**
   - Node details: input snippet, extracted tasks JSON preview, schedule block list.
   - Playback stepper: step number, previous/next, “auto-play”.

## Page 3 — Sign in
### Meta Information
- Title: “FlowMind AI — Sign in”
- Description: “Sign in to save tasks, schedules, and runs.”

### Layout
- Centered card on a minimal background; optional left marketing panel on wide screens.

### Sections & Components
- Tabs: Sign in / Create account.
- Fields: email, password; validation and inline errors.
- Actions: submit, “Forgot password”, “Continue as Guest (Demo)”.
- Post-auth redirect: return to Workspace.

# Slice: updated UI design reference

**Status:** Current reference for the redesigned Slice prototype  
**Last refreshed:** September 8, 2026  
**Reference implementation:** [slice-redesign-reference.html](https://run.clickup.ai/90122001111/c24c9da1-c7ac-40a5-bcf3-68ecd2226670/slice-redesign-reference.html)

## Product direction

Slice is an **execution control surface**, not a trading dashboard.

The updated UI borrows the referenceâ€™s calm banking layout: airy lavender canvas, compact top navigation, modular white panels, one dark focus surface, and a bright lemon action accent. The product behavior remains unmistakably Slice: the user defines the boundary, the agent manages entry timing, and the agent pauses when the market violates the constraint.

The interface should answer three questions immediately:

1. What is Slice executing?
2. What decision did the agent make?
3. What happens if the market changes?

Do not add dense charts, speculative signals, or decorative crypto motifs. Use precise values, clear states, and a visible activity trail.

## Visual system

### Color strategy

Use a restrained, warm-neutral palette with a lavender canvas, near-black ink surface, lemon for emphasis, coral for action, and mint for healthy system states.

| Token | Value | Use |
|---|---|---|
| `--canvas` | `oklch(94.4% 0.014 276)` | Main page background |
| `--paper` | `oklch(99.2% 0.004 90)` | Primary panels and controls |
| `--paper-2` | `oklch(97.5% 0.008 90)` | Soft control surfaces |
| `--ink` | `oklch(19.8% 0.023 270)` | Active execution card, dark decision panels, primary text |
| `--muted` | `oklch(51% 0.018 270)` | Supporting text |
| `--quiet` | `oklch(67% 0.018 270)` | Metadata and labels |
| `--line` | `oklch(89% 0.016 270)` | Borders and dividers |
| `--lemon` | `oklch(88% 0.185 98)` | Primary visual accent and action rail |
| `--lemon-2` | `oklch(95.5% 0.12 98)` | Pause and changed-condition surfaces |
| `--coral` | `oklch(65% 0.16 32)` | Primary execution action and current agent activity |
| `--coral-soft` | `oklch(92% 0.05 32)` | Coral-tinted supporting surface |
| `--mint` | `oklch(78% 0.12 164)` | Connected, healthy, filled, and complete states |
| `--mint-soft` | `oklch(91% 0.052 164)` | Healthy state surfaces |
| `--blue` | `oklch(63% 0.12 255)` | Focus rings and resume transition |

Do not use pure black or pure white. Do not use gradients, gradient text, glassmorphism, neon crypto styling, or color without a semantic state.

### Typography

Use **DM Sans** for interface copy and **IBM Plex Mono** for prices, amounts, percentages, durations, and timestamps.

- Body: 16px minimum, `line-height: 1.5`.
- Eyebrows and metadata: 10px to 11px, uppercase, 0.10em to 0.14em tracking.
- Supporting UI: 11px to 13px.
- Panel headings: 16px to 25px.
- Main greeting: fluid 30px to 55px, tight line-height, strong negative tracking.
- Numeric values use tabular figures and tight letter spacing.
- Keep readable copy under roughly 75 characters per line.

## Layout and spacing

Use a 4px base spacing system. Approved rhythm values are 4, 8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, and 58px.

### Global shell

- Page padding: 24px desktop, 14px mobile.
- Maximum content width: 1400px.
- Top bar height: 58px desktop, intrinsic height on mobile.
- Dashboard top gap: 28px desktop, 22px mobile.
- Main dashboard grid: 260px rail plus fluid content, with a 22px gap.
- At 1050px, rail narrows to 210px.
- At 700px, the rail becomes a stacked mobile section above the main content.

### Shape and elevation

- Small radius: 10px to 12px.
- Standard panel radius: 18px.
- Large dark execution surface: 28px.
- Default border: 1px solid `--line`.
- Use small shadows on panels and one stronger shadow on the active execution rail.
- Never use colored side-stripe borders.
- Never nest cards inside cards. Use dividers, spacing, and text hierarchy instead.

## Page structure

### Top bar

The top bar is compact and confident:

- Slice mark and wordmark on the left.
- Primary navigation: `Overview`, `New execution`, `Activity`, `Guardrails`.
- Persistent connection pill: `Binance Agent OS connected`.
- User avatar on the right.

The Binance connection stays visible but should not compete with the active execution state.

### Left rail

The left rail contains:

- Active execution summary.
- Pair: `BNB / USDT`.
- Total order: `$500`.
- Mode: `Buy order, adaptive split`.
- Agent status: `Agent watching the book`.
- Progress line.
- `Set up new execution` action.
- Connection summary: market data live, trading ready, last check now.

The dark rail is the strongest persistent visual anchor. It replaces a traditional sidebar full of navigation links with a concise view of what the agent is currently doing.

### Main overview

Use a greeting and a short product explanation:

> Good afternoon, Emmanuel
>
> Set the constraint. Slice manages the entry, watches the market, and knows when to wait.

The main area is organized as:

1. Active execution monitor.
2. Agent decision panel.
3. Slice timeline.
4. Activity log.
5. Inline state panels for setup, analysis, approval, pause, and completion.

## Component rules

### Buttons

- Primary: coral fill, dark coral depth, concise action label.
- Secondary: paper surface, subtle border.
- Destructive: paper or pale lemon surface with clear warning copy. Do not use a saturated red block.
- Minimum visual height: 42px. Touch target must remain at least 44px.
- Use sentence case.
- Keep labels outcome-focused: `Set up new execution`, `Analyze execution`, `Review plan`, `Approve execution`, `Recheck market`, `Abort execution`.
- Hover: small upward transform only.
- Press: reduce button depth, never bounce.
- Loading: preserve width, replace label with a clear loading state.

### Status badges

Every state needs both a label and a dot:

- `Running`: mint.
- `Paused`: lemon.
- `Resuming`: blue.
- `Complete`: mint.
- `Connected`: mint.

Never make state legible through color alone.

### Inputs

- Label above the control.
- Amounts use a dollar prefix and `USDT` suffix.
- Durations use a `min` suffix.
- Slippage uses a `%` suffix.
- Select controls retain a visible native or custom chevron.
- Focus uses a high-contrast blue ring with a soft blue outer tint.
- Do not rely on placeholder text as the label.

### Active execution card

The monitor is the primary interaction surface. It must show:

- `BNB / USDT`.
- `$500` total order.
- `$175 of $500` executed.
- `$325` remaining.
- `0.20%` max slippage.
- `12:48 left` in the prototype state.
- A progress bar representing order completion, not market price.
- The action `Simulate market change` for prototype review.

The agent state copy should be plain and specific:

> Hold for one more depth check.

### Agent decision panel

Use the lemon panel to make the agentâ€™s reasoning easy to scan:

- Slice 1: `Filled`, 175 USDT at 0.08% impact.
- Slice 2: `Waiting`, re-checking depth before submit.
- Slice 3: `Pending`, 150 USDT reserved for the final pass.

The panel should explain what the agent is doing, not show an abstract confidence score.

### Slice timeline

Use a simple vertical or stacked sequence with three rows:

1. `Slice 1, filled`.
2. `Slice 2, waiting`.
3. `Slice 3, pending`.

Completed rows use mint, the current row uses coral, and pending rows use the quiet canvas treatment.

### Activity log

The activity log is a product feature, not decoration. Each event contains:

- Small state dot.
- Plain-language action.
- Compact timestamp.

Approved prototype events:

- Market checked, 12:01.
- Slice 1 submitted, 12:02.
- Slice 1 filled, 12:02.
- Market rechecked, now.

The current event uses a coral dot and a subtle coral halo.

## Interaction rules

### Overview navigation

The prototype uses inline state panels rather than modal dialogs. Selecting a top navigation action or button reveals the relevant panel below the dashboard.

- Keep the overview visible while the state panel opens.
- Use a short opacity and vertical entrance animation.
- Do not animate layout dimensions.
- Smooth-scroll to the state panel when it opens.
- On mobile, stack the panel content and make actions full width.

### New execution

Fields:

- Side: `Buy` or `Sell`.
- Pair: `BNB / USDT`.
- Amount: `500 USDT`.
- Execution window: `15 min`.
- Max slippage: `0.20%`.

Copy:

> Set the boundary. Leave the timing to Slice.
>
> Slice optimizes execution, not trade selection.

`Analyze execution` opens the market analysis state.

### Market analysis

Use the latest execution context:

- Current price: `$612.84`.
- Spread: `0.04%`.
- Liquidity: `$1.2M`.
- Immediate slippage: `0.27%`, above the 0.20% limit.

Recommendation:

- Adaptive split.
- Slice 1: 175 USDT.
- Slice 2: 175 USDT.
- Slice 3: 150 USDT.

`Review plan` opens approval. `Back` returns to overview or the prior state.

### Approval

The approval state must make the commitment explicit:

- `BUY BNB`.
- `$500` total order.
- `15 min` window.
- `0.20%` maximum slippage.
- `Adaptive split` strategy.
- `0.11% planned` impact.

No execution starts before `Approve execution`.

### Live execution

Initial live state:

- Status: `Running`.
- Executed: `$175`.
- Remaining: `$325`.
- Slice 1: filled.
- Slice 2: waiting.
- Slice 3: pending.
- Estimated slippage: `0.11%`.

The active agent decision must stay visible. Example:

> Hold for one more depth check.

## Pause and resume flow

This is the defining Slice behavior.

### Trigger

After Slice 1 fills, Slice checks the market before submitting Slice 2. If current conditions exceed the userâ€™s threshold, it pauses automatically.

Prototype example:

- Spread before: `0.04%`.
- Spread now: `0.23%`.
- Maximum slippage: `0.20%`.

### Pause state

Show:

> The agent hit the brakes.
>
> Market conditions changed.
>
> Current conditions exceed your execution threshold. Slice has paused the next order.

Required behavior:

- Do not submit Slice 2.
- Keep `$325` remaining and untouched.
- Keep Slice 2 waiting.
- Show the before-and-after spread comparison.
- Show `Recheck market` and `Abort execution`.
- Explain that the guardrail is active because the market is outside the execution boundary.

### Recheck action

When `Recheck market` is selected:

1. Disable the button immediately.
2. Change the label to `Checking market`.
3. Keep the pause state visible while checking.
4. If conditions recover, change the state to `Resuming`.
5. State that conditions recovered.
6. Start Slice 2.
7. Update the monitor to `$350 of $500`, with `$150` remaining.
8. Restore normal monitor actions after the transition.

### Abort action

`Abort execution` ends the active run without submitting the remaining order. In production, this action needs a clear confirmation because it changes the outcome of a live execution. The prototype routes it back to the overview state.

### Resume state

The resume transition should be distinct from both running and paused:

- Label: `Resuming`.
- Color: blue.
- Copy: `Conditions recovered. Slice 2 is entering at the refreshed threshold.`
- Progress: `$350 of $500`.
- Remaining: `$150`.

Do not skip directly from paused to complete.

## Completion state

Show a calm success panel:

> Order closed cleanly.
>
> Slice completed the plan after rechecking conditions between each order.

Approved summary:

- Executed: `$500 BNB`.
- Planned impact: `0.11%`.
- Agent checks: `4`.

Actions:

- `New execution`.
- `View monitor`.

## Responsive behavior

At widths below 700px:

- Stack the rail above the dashboard content.
- Keep the dark active execution card full width.
- Collapse top navigation into a horizontally scrollable row.
- Keep the connection pill compact.
- Stack monitor and decision panels.
- Stack form fields into one column.
- Make state actions full width.
- Preserve 16px body text and 44px touch targets.
- Hide secondary metadata before shrinking the primary execution information.

## Motion and accessibility

- Entrance transitions: 300ms to 500ms, exponential ease-out.
- Button and toggle feedback: 100ms to 150ms.
- State changes: 200ms to 300ms.
- Animate only `transform` and `opacity`.
- Respect reduced-motion preferences.
- Use visible focus rings.
- Keep status text alongside status color.
- Use descriptive button labels and accessible labels for logo and connection state.

## Prototype-only controls

The updated prototype includes two demonstration controls:

- `Simulate market change`, which opens the pause state.
- `Complete demo`, where applicable, to show the completion state without waiting for live market events.

These controls are useful for the hackathon demo but should not appear in the production trading surface.

## Freshness rule

This file is the current design reference for the redesigned UI. If the prototype changes, update this document in the same work session. Do not copy values, labels, or state behavior from an older Slice implementation without reconciling them against the latest reference first.
# Interaction engineering

The visual baseline remains the approved A2 Northline theme. Piruicy informed component mechanics: preserving state, matching measured springs, interruptible feedback, exact values, keyboard parity, and handling cancellation.

## Source and decisions

- [Piruicy rolling number](https://piruicy.com/components/rolling-number): reused the existing component and CSS from the user's source. Per-digit cyclic strips, direction, critically damped spring 86/18.6, velocity reset, clipping, changing digit counts, and readable/copyable text remain intact. Added an instant flag for keyboard input. Copyright and MIT + Commons Clause license are included.
- Switch thumb: Motion spring 360/38; native checkbox keeps label activation, Space, focus and disabled semantics. Keyboard and reduced-motion changes snap to the target.
- Monthly scrubber: native range input, 44px hit height, exact date/error accessibility text, direct selection, and replay. No synthetic interpolated statistical values.
- [GSAP React cleanup](https://gsap.com/resources/React/) and [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/): scoped scenes revert on unmount and media changes. Headline/panorama sequence runs once per session. ScrollTrigger moves the existing illustration with native scrolling; page sections are never held behind scroll reveals.
- The open desk plot replaces the previous side panel. Publication, decision and delivery form a timeline. Methodology starts with three SVG diagrams; full assumptions and formulas remain in a disclosure. No decorative dashboard cards were added.

## Observed checks, 25 October 2026

- All 17 Python tests and the TypeScript/Vite production build pass.
- 303 rolling-distance input cases checked against the actual exported function: wrap direction, digit arrival, and bounded travel.
- Browser DOM identity confirmed that the rolling-number element survives a day change.
- Rapid day changes ended with matching input date, delivery timeline, plot summary, and non-busy state.
- Blocking a day request produced the error view. The previous surface had visibility:hidden, inert, and aria-hidden=true. Keyboard Retry restored the new decision's data. The simulated network failure intentionally generated a browser resource error.
- Reduced-motion emulation was verified in the same DevTools session as the interaction: the methodology opened with the preference true and no drawn-path animation styles. The emulation was then cleared.
- Keyboard monthly End selected 31 January, and Replay opened delivery on 1 February.
- The production build was inspected at 375 pixels. Accuracy and methodology had no page overflow; diagrams use larger labels at that breakpoint. The methodology disclosure opened with Enter.
- Empty-range toggles expose an unchecked, disabled state to both the visual control and assistive technology.

These are functional and component checks, not a frame-by-frame claim that every custom control is a replica of a reference. Real-phone gesture and formal frame-time audits are outside this pass.

- A UI regression check covers loading, error with Retry, empty data, and populated methodology examples. Loading never claims that observations are missing. This check runs in CI.

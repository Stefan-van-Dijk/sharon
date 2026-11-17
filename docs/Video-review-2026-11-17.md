# Shop inside Sharon — recording review

Input: ScreenRecording_11-17-2026 08-11-44_1.mp4 (83.6 seconds).
Baseline: Sharon 5b118730 / 0.4.97 and Shop 703c4ef.

Observed in the recording:
- Around 10–40 seconds: expanding a list leaves a large empty gradient header above the embedded Shop interface.
- Around 15–25 seconds: two products are marked complete in embedded Shop and the board reflects them.
- Around 55–80 seconds: standalone Shop shows the same named list with four outstanding products. The recording alone does not establish server state or account identity.

Confirmed code defects:
- Fullscreen media height is set to 48px but still constrained by the shared 150px minimum.
- Edits during an active Shop synchronization do not schedule another pass; leaving the embedded view can remove the transport before a save completes.

Candidate:
- Compact 48px neutral return bar with no redundant launch icon.
- Host requests return from a capable Shop frame and keeps it mounted until Shop acknowledges completion.
- Companion Shop change drains queued writes before returning and preserves a recoverable error state.

Validation:
- Sharon full verify suite passed locally, including the host message origin/source guard and delayed-return test.
- Shop Node tests and public build passed locally; queue tests cover a second edit during an upload, deferred return and retry after failure.
- Mobile Chromium/WebKit rendered regression added for header height, remaining viewport and return to board.
- Local Chromium could not start: the execution environment denied the browser singleton socket. No local browser-flow pass is claimed. CI and actual iPhone cross-app verification remain required.
- A live multi-client server round-trip was not executed against personal lists.

Deployment: publish the companion Shop change before Sharon to enable the return handshake. No PHP/server schema change.

# Demo assets

**Status:** Local document, HTML and video fixtures organized; hosted workflow uploads, published HTML interaction and short captioned MP4 play-to-ended verified; non-admin, large-file and broader media acceptance remain. · **Last updated:** 2026-09-22
**Source:** [End-to-end design §3.3](../design/end-to-end-design.md#33-demo-assets)

Asset handling is type-dependent. **The CSM should never have to guess what will happen when they click.**

Connected submissions use a single Media step for **images, videos, one-pagers/slides, self-contained HTML, hosted URLs, Power Apps, Power BI, and desktop demo arrangements**. Require one to six detail images; thumbnail is optional. Files and linked assets share a maximum of six attachments. The local PoC keeps its file-only submission controls and legacy seeded catalogue. Actual access/demo-request delivery is not implemented.

## Behaviour by type

| Asset type | In-app behaviour | Fallback |
|---|---|---|
| Self-contained HTML file | Render in the full-screen viewer directly from the Dataverse File column | Download the file |
| Hosted web app (URL) | Embed in the viewer if `Allows Embedding`; otherwise open in a new tab immediately | Pop-out, with the `Embed Hint` shown |
| Power Apps / Power BI | Deep-link out in a new tab (embedding is unreliable and auth-stalls inside frames) | Video walkthrough if one exists |
| Video walkthrough | Play inline in the viewer | Download |
| Desktop app or script | Not runnable in-app; show saved demo arrangements and state that no request was sent | Contact the builder; optional video |
| Client-ready one-pager / slide | Download | — |

## Rules

- **New submissions require at least one detail image.** Images alone are sufficient; a thumbnail alone is not. Review the complete visual story and confidentiality before publication.
- Uploaded assets live in Dataverse File/Image columns ([ADR-0004](../architecture/decisions/adr-0004-assets-in-dataverse.md)).
- Self-contained HTML renders in a **sandboxed iframe** with a restrictive policy and no same-origin access to the host app; files are librarian-reviewed before publication ([security model](../architecture/security-model.md)).
- Hosted URLs are subject to the periodic link-health check ([content health](../operations/content-health.md)).

In the PoC, PNG/JPG/WebP images are decoded locally (5 MB each). Optional attachments are limited to six files: MP4/WebM videos up to 500 MB each, and HTML or PDF/PPT/PPTX documents up to 25 MB each. Uploaded HTML uses a restrictive CSP and sandbox without same-origin access; network resources are blocked. Explicitly saving a draft or submitting persists media in browser-local IndexedDB; unsaved media and standalone walkthrough media remain memory-only. Browser quota, eviction or clearing site data can remove or prevent local persistence; failed saves keep the editor open. Videos are read as data URLs, so large files require additional browser memory; the size limit is not a storage-quota or playback-performance guarantee. These local limits do not configure Dataverse column limits.

## Connected media

The pilot connected app uses generated mediated upload APIs, not direct SDK upload helpers. New uploads negotiate sequential 4 MiB slices when advertised, otherwise 2 MiB for the compact-response protocol or 512 KiB for legacy servers. Existing sessions keep their original block size. Protocol state and continuation tokens stay in private `nx_uploadsession`. Every mutation checks caller-owned Draft state and the current version. Unfinished uploads expire after two hours. A failed/ambiguous response disables retries until reopen; new SHA-bound video uploads can then resume from server-confirmed counters using the exact upload file. Legacy/expired sessions require removal and restart. See [ADR-0009](../architecture/decisions/adr-0009-mediated-media-and-publication-access.md).

### Published host compatibility

The connected pilot was published on 2026-09-22 with explicit approval to defer outstanding acceptance gates; see the [deployment record](../../app/README.md#pilot-deployment-2026-09-22). The initial hosted policy blocked Blob video, workers and WASM execution. Local Play did not reproduce these restrictions. A separately approved environment-level change now permits the required capabilities while retaining enforcement; the [security model](../architecture/security-model.md#code-app-hosting-policy) owns exact settings, scope and rollback.

The approved follow-up upload bundles the existing fonts and displays protected PNG/JPEG images as memory-only `data:` URLs after the same authenticated SDK read. The display helper rejects unsupported MIME types and images over 20 MiB; upload limits remain 5 MiB. No public URLs, storage cache, permission changes or CSP relaxation were introduced. Hosted checks decoded 1187 x 651 thumbnails and the 420 x 420 gallery JPEG in its full image viewer, and loaded all three fonts from the app origin.

**Hosted capability checks after the approved policy change (2026-09-22):** the actual PRISMA response header permits `media-src 'self' data: blob:`, `worker-src 'self'`, `connect-src 'self'` and `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`. No other observed directive changed. The already-published encoder/player modules ran inside this hosted document with non-sensitive local fixture files, without Dataverse writes or app republishing:

- Packaged worker/WASM compression transformed a 55,704-byte two-second fixture into a validated 52,413-byte MP4 in 27.6 seconds including startup. This directly exercised the encoder, not the automatic 200 MiB form threshold or a large-file performance test.
- The output Blob URL decoded at 640 x 360, duration 2 seconds, readyState 4, with no media error. Seeking to 1 second produced nonblank pixels. The integrated browser reported a hidden document and paused playback at time zero; play-to-ended and audible output are not counted as passed.
- The packaged progressive engine read the regular 1080p/300-second local fixture in 1 MiB chunks, reached readyState 4 and buffered 33.37 seconds after six reads (6 MiB). Seeks to 120 seconds and back to 5 seconds decoded nonblank pixels without error. Reads were from a local File, not the protected Dataverse range API in this check.
- Packaged caption extraction produced two WebVTT cues; the Blob-backed track loaded both, with the expected first cue active at 0.5 seconds.

The temporary DOM probe, File/output references, workers and object URLs were cleaned up. No user submissions or stored media were changed. Full hosted upload/resume/publication/revocation, OS downloads, HTML/linked embeds, continuous playback and non-admin access remain separate acceptance gates. The earlier Local Play/Edge results below remain scoped to those environments. No large-video data-URL fallback was added.

Selecting an eligible MP4/WebM shows a separately labeled local-file preview while uploading. Only the latest selected video is held in editor memory, using an object URL without a full data-URL copy or persistent cache. Closing/replacing/unmounting the preview revokes its URL; upload failure clears it and uncertain/blocked state hides it. Local playback is not proof of upload success. Saved regular-MP4 Preview now attempts protected progressive reads; unsupported files offer full-download fallback. Reopening does not retain the local preview.

**Subsequent deployed workflow verification (2026-09-22):** the [interactive submission-to-publication test](contribution-and-review.md#deployed-interactive-workflow) used actual hosted form uploads and Dataverse reads. Synthetic thumbnail/gallery images decoded at 960 x 600 after publication; the caption persisted through upload/save/reopen. Saved HTML ran its button interaction in both reviewer and published present-mode viewers, with parent DOM access denied by the opaque sandbox. A 56,310-byte captioned MP4 used the expected full-file fallback for its subtitle track, decoded at 640 x 360 / 2 seconds, loaded two cues and showed the expected first cue at 0.5 seconds. In the visible tab it played through to ended at 2 seconds without a media error, muted. The labeled record remains published for inspection. This supersedes the earlier hidden-tab short-playback limitation for this fixture, not long-duration, audible, codec-matrix, non-admin or large-file acceptance. OS downloads and linked embeds remain unverified in this pass.

One to six gallery images are required at submission; up to six files/linked assets are optional. Image limit is 5 MB (and 40 megapixels for client decoding); WebP is converted to PNG within that limit. Document/HTML limit is 25 MB, video 500 MB, additionally capped by the actual Dataverse column limit. Large-video upload, integrity and MP4 playback were verified as recorded below; full-download startup latency remains a concern. A dedicated thumbnail is supported; pending screenshot captions save through the main Save draft/Continue flow. Native parent Solution images are not trusted publication inputs.

On 2026-09-22 the user reported both repository MP4 samples failing: 52,428,800 bytes and 524,288,000 bytes. Published/editable `nx_demoasset.nx_filemedia` metadata was only 32,768 KB (32 MiB), below both file sizes despite the advertised 500 MB video allowance. With explicit approval, `Prisma.Deploy set-video-limit --execute` increased that one file attribute to 512,000 KB (500 MiB / 524,288,000 bytes), published only `nx_demoasset`, and verified both metadata layers. The command defaults to read-only preview, checks organization/attribute/current limits, and accepts only the expected 32 MiB or already-correct 500 MiB states. Table publication can include other pending customizations on that table. No existing file contents, rows, permissions, code apps or plug-in assemblies were changed. The 25 MiB document/HTML and 5 MiB image policies remain unchanged. Full 50/500 MiB upload and playback were not performed as part of this metadata update. An editor already locked by an unconfirmed upload must reopen the draft before retrying; remove an unfinished upload only if one is present.

Screenshots and attachments can be reordered within their own groups by dragging the handle, using ArrowUp/ArrowDown on that handle, or activating Move earlier/later buttons (also suitable for touch). The PoC stores the ordered arrays with its local draft. Connected reordering first saves pending captions, then saves and verifies every finalized media ID/caption/order with the confirmed parent version. Thumbnail position is not draggable; uploads and unfinished media disable reordering. A failed/unconfirmed reorder locks further writes until reopen. Upload progress uses theme tokens, a rounded track, byte counts and accessible progress semantics; 100% received is labeled Finalizing until the server commits the file.

### Protected playback and resume

The explicitly approved 2026-09-22 backend update added `nx_BeginResumableUpload`, `nx_GetUploadCheckpoint`, `nx_ReadVideoRange` and private `nx_uploadsession.nx_sha256`. SDK bindings are generated only in the connected target. No user/role assignments or code-app publication changed.

**Resume:** new connected videos are hashed incrementally in 4 MiB slices after any compression, before Begin. Pause or lost responses require reopening the draft. Select the exact upload file through Resume; server checks its name, size and SHA-256, caller ownership, Draft/version, expiry and counters. Sending starts at the confirmed offset; there is no automatic replay of an uncertain write. The two-hour expiry is not extended. Completed sessions are not resumed; a lost Finish response is resolved by reopening. Older sessions with no digest cannot resume. Keep upload file for resume downloads the exact prepared bytes before leaving, important when compression produced them; there is no persistent browser file cache or automatic recompression. In-flight SDK requests may complete after Pause, so only the reopened checkpoint is authoritative.

**Playback:** regular MP4s use sequential protected 1 MiB range calls with version validation and MP4Box/MediaSource fragmentation. Initial parsing can jump to end-of-file MP4 metadata. Buffering pauses about 30s ahead and evicts data more than 60s behind; seeking fetches the required keyframe range. Mode and caller checks occur on each request and a 30s access check while buffered/paused. Failed access/version checks clear playback; delivered bytes cannot be recalled. MP4s with extra tracks, already-fragmented MP4s, unavailable range support or unsupported codecs offer Load full video rather than silently discarding tracks/audio. Full-file playback/download recheck the requested mode before and after retrieval; streaming does not start a full download automatically. WebM retains the earlier full-download player. Codec/audio errors in the integrated browser remain possible.

**Verified, privileged caller only:** the SDK smoke test interrupted after 4 MiB, rejected a different digest, resumed, finalized, then reconstructed 10,574,638 bytes through 1 MiB reads with SHA-256 `1d573310e41daeeff0394e1c98d2ac4ee7bd4f29ff282b8a428eb0a03aad842c`. Draft present reads and stale video versions were denied. Repeat command: `dotnet backend/Prisma.Deploy/bin/Debug/net10.0/Prisma.Deploy.dll smoke-transfer <non-sensitive-4-to-60-MiB-mp4>`; it creates/deletes a labeled fixture and requires approval for remote writes.

Authenticated browser SDK testing used a separate regular video-only MP4, 48,907,286 bytes / 300s: stop after 4,194,304 bytes and resume completed; protected playback reached readyState 4 in **2.9s after 2 MiB**. Seeking to 120s fetched a distant range, decoded nonblank canvas pixels, and play started; backward seek to 5s passed after fixing disjoint-buffer accounting. This was real Dataverse transport plus player testing via an isolated browser harness, not complete UI acceptance or a same-file comparison with the historic 500 MiB startup time. Synthetic video-only content does not establish AAC, subtitle, WebM, continuous-duration or cross-browser acceptance.

The actual StreamingVideo UI was also mounted with a two-second MP4/AAC fixture: progressive audio decoding failed in this browser, Load full video was offered, and that explicit protected fallback reached readyState 4 at 640x360 without a media error. Mobile layout at 390px fit its 325px container and retained an accessible Download button; screenshot confirmed a nonblank frame. This does not certify audible output or other codecs. The isolated React harness needed matching Vite dependency versions to avoid a test-only duplicate-React error.

All four disposable server/browser drafts were deleted and private-session queries returned no rows. Existing `Prisma Test` and `Test` remained. Old tabs could not see the new SDK sources; fresh Local Play page loaded them correctly. Fifty connected tests, 46 backend tests, connected build and lint passed. Remaining gates: resume-button/full wizard interaction, compressed-file reselection, real network-loss/expiry conditions, maximum-size sustained playback, broader audio/caption/fullscreen/OS-download acceptance, non-admin owner/CSM denial and actual publication/revocation scenarios. No connected app was published.

### Same-account video acceptance

The subsequent 2026-09-22 pass used the current Luis account only and disposable draft `203f22a7-afb6-f111-aaac-6045bd049fba`, named `[PRISMA TEST] Video acceptance`. No other accounts, permission changes or deployment were required.

- **Actual wizard resume:** safety -> identity -> story -> tags -> Media -> upload -> Pause -> confirmed Reopen saved draft -> fresh safety -> Media -> wrong-file rejection -> exact-file resume -> Save & close passed. The UI initially lacked an in-place reopen action for media uncertainty; it now uses the existing confirmation/reload flow. The displayed 4 MiB checkpoint became 8 MiB on reopen because an in-flight request finished after Pause. Server state remained authoritative. Wrong-file selection stayed recoverable and no longer leaves a misleading prepared-file download link. Final 50 MiB readback matched original SHA-256 `48f8a871e7a615d9a23deba06cd419465c24be4dd5128365061865412cb7ebd3`. Keyboard activation and dispatched option/click events were used where integrated pointer automation failed; this is not physical pointer certification.
- **Ambiguous responses against live Dataverse:** the actual transfer function was given an API wrapper that committed a block and then threw away its response. Exactly one block call occurred; reopen found 4 MiB and resume completed without replay. A separate committed-Finish/lost-response test made one finalization call; reopen showed complete. These are controlled response-loss injections, not an operating-system network outage.
- **Hosted preparation and prepared-file recovery:** the real WASM worker ran inside authenticated Local Play on a two-second valid clip padded to 200 MiB, producing a 52,413-byte MP4. Upload stopped after Begin; reconstructing/reselecting the exact prepared bytes resumed and completed. This verifies worker loading and hash identity, not an actual user disk-file-picker round trip or full-length hosted compression performance.
- **Caption display:** full-file MP4 decoding alone exposed zero native text tracks for embedded subtitles. The viewer now extracts up to eight `tx3g` tracks with limits of 10,000 cues per track and 2 MiB total text, converts cue text/times to escaped WebVTT, and exposes native selectable subtitles. Two fixture cues matched exact text/timing, and showing the track at 0.5s displayed the expected active cue. Styling is not preserved. Unknown subtitle formats report that the original download retains the tracks. Track elements/URLs are revoked on failure and unmount.
- **Publication and withdrawal:** real wizard submit, privileged approval, present-mode streaming, short-clip play-to-ended, then withdrawal passed. The already-open present-mode player cleared source/buffer on its next access check (4.4s in this observation, not an SLA; interval is 30s). Full-file fallback also denied the withdrawn video. This tests application mode/state checks with the same privileged caller, not effective non-admin share revocation.
- **Fullscreen:** browser fullscreen entry and exit succeeded in Local Play. The protected Download command completed without app errors, but the integrated browser produced no download event; authenticated OS delivery is still unverified.
- **Independent browser:** a fresh, unsigned-in Edge 153.0.4234.48 context decoded MP4/AAC and WebM/Opus, played each short fixture to ended, and saved blob downloads whose SHA-256 matched originals. The real progressive MP4 engine also played AAC successfully. Integrated-browser WebM still failed even from a local file (`DEMUXER_ERROR_COULD_NOT_OPEN`), confirming a browser-specific limitation. Audio was decoded while muted; audible output was not assessed.
- **Large playback:** isolated Edge streamed the entire 524,288,000-byte / 300s sample through 500 local 1 MiB reads and reached ended at verified 4x speed in 75.3s, with no error. Earlier test timeouts were due to setting playbackRate before source assignment, which reset it; diagnostics showed healthy 1x playback and approximately 30s buffered ahead. This validates the actual parser/buffering engine over the full file, not a five-minute real-time Dataverse bandwidth certification or low-memory-device acceptance.
- **Expiry:** automated server tests cover exact deadline rejection, completed sessions and legacy sessions lacking digests. No live two-hour wait, clock change or session-field bypass was used.
- **Full-length browser compression:** the production-build single-threaded encoder processed the complete 524,288,000-byte / five-minute sample into 25,285,170 bytes (24.1 MiB, 95.2% smaller) in 1,452,798 ms (24m13s). Output passed stream-count/dimension/duration validation, decoded at 1920x1080 / 300s, and seeking to 295s produced nonblank pixels. This was local browser processing of synthetic content, not a native-tool result, visual-quality certification or a combined compressed upload benchmark. The earlier native encoding timings must not be used as browser estimates. This substantial delay is an explicit usability concern; cancellation and original-file recovery remain important. Temporary output bytes and object URLs were released after validation.

The disposable draft was withdrawn and deleted with all media; a private-session query returned no rows. The two preexisting user submissions and source recordings were untouched. Final checks: 20 shared/PoC tests, 51 connected tests, 12 rendered UI tests and 46 backend tests (129 total); connected build and lint. No additional backend deployment, role changes or code-app publication occurred in this pass.

Repeat isolated-browser tests with `node app/scripts/verify-video-browser.mjs <temporary-tools-directory> <Edge-executable> [large-mp4]`. Install `playwright-core` only in the temporary tools directory; the script launches a new headless profile, does not sign in or access existing browser profiles, and closes it in `finally`. Small non-sensitive fixtures are expected in the OS temporary directory. Download delivery results from that local test must not be presented as authenticated Power Apps delivery results.

Outstanding gates after this pass: other-user/least-privilege reads and denials; packaged code-app publication/CSP smoke test and GPL distribution review; real user prepared-file download/reselection; natural two-hour expiry and physical network loss; audible output; browser/device matrix; authenticated OS download delivery. None requires weakening the existing upload/read guards.

### Automatic video preparation

The user explicitly requested in-app compression for 200 MB+ videos and selected the browser runtime after its memory/bundle/licensing trade-offs were explained. The shared Media form now attempts compression at **200 MiB (209,715,200 bytes), inclusive**, through the existing 500 MiB input cap, in both the PoC and connected app. Below-threshold videos and non-video attachments bypass the encoder; larger-than-limit input is not used to bypass upload limits. This supersedes the earlier optional-preparation recommendation below for this size band.

- A lazy single-threaded FFmpeg WASM worker encodes H.264 MP4 at CRF 26 / fast, preserving resolution. AAC is copied; other audio is converted to AAC. Supported text subtitle tracks are copied or converted to MP4 text. Unsupported subtitle formats/multiple video tracks fail to explicit original-file fallback. Output duration, dimensions and audio/subtitle track counts are checked; full subtitle styling/cue and audible-quality parity are not certified by these checks.
- The original File is mounted read-only through WORKERFS without an initial full input copy into WASM. Output still occupies worker memory and is copied into a File; 200-500 MiB inputs can impose substantial CPU/memory cost. The 32.2 MB core is loaded only when needed from relative app assets, with no CDN or new service. No cross-origin isolation headers are introduced.
- Progress and Cancel compression remain available while media edits/wizard navigation are locked. Closing the local preview does not cancel encoding. Cancellation/unmount terminates the worker and discards results; nothing reaches the upload adapter first. Startup is bounded to 60s, probes to 30s, and encoding to 30 minutes. Failures offer Cancel or Use original, not an automatic upload. A valid candidate that is not smaller uses the original automatically.
- Preparation completes before connected caption writes and upload Begin; existing ownership/version/uncertain-write safeguards remain unchanged. The PoC then uses its existing local persistence. The single-file presentation uses a build-time encoder fallback, remains about 361 KB, and offers Use original for eligible videos rather than embedding WASM.

Verification: four policy tests cover exact threshold/cap, bypass, smaller-only selection, failure and abort; all 20 PoC, 45 connected and 12 rendered UI tests pass, as do lint, both builds and the presentation build. Local browser and production-bundle encodes passed with a two-second fixture. The shared form compressed that valid fixture padded to exactly 200 MiB into a 52,413-byte MP4; this exercises threshold-sized file access, **not full-length 200-500 MiB encoding performance**. Cancel prevented the adapter callback; corrupt 200 MiB input required explicit Use original; the mobile fallback fit at 390px without horizontal overflow. No test uploaded media or changed Dataverse.

The initial Local Play shell failure was overcome in the later same-account acceptance pass: worker loading and short threshold-sized compression inside authenticated Local Play now pass, as does the real upload/resume wizard. A separate full-length 500 MiB browser encode also passed, taking 24m13s as recorded above. Packaged hosted-app CSP, WebM conversion, caption styling and lower-memory devices remain separate acceptance work. The bundled FFmpeg core declares **GPL-2.0-or-later**; complete applicable license/source distribution review before publishing these assets. No code app or backend was deployed for this compression feature. Native benchmark results below are not browser-encoding performance claims.

### Local video inventory

Original videos are grouped under `test-data/videos/`, outside app public assets and deployment bundles. Filenames and bytes are preserved; all four moves were verified with SHA-256 checksums on 2026-09-22.

| File | Purpose | Size (MiB) | Git policy |
|---|---|---|---|
| [ProductPublishingAgent_Demo 1.mp4](../../test-data/videos/demos/ProductPublishingAgent_Demo%201.mp4) | Product demo; content/playback not assessed in this inventory | 69.46 | Local only, ignored |
| [HighLevel recording](../../test-data/videos/recordings/HighLevel%20White-Label%20SaaS%20Demo%20Video%20Show%20Every%20Core%20Feature%20in.mp4) | Real-recording compression benchmark source | 77.58 | Versioned source relocated from repo root |
| [sample-50mb.mp4](../../test-data/videos/synthetic/sample-50mb.mp4) | Synthetic 50 MiB upload/encoding fixture | 50 | Local only, ignored |
| [sample-500mb.mp4](../../test-data/videos/synthetic/sample-500mb.mp4) | Synthetic 500 MiB limit/streaming fixture | 500 | Local only, ignored |

Keep originals separate from generated copies. For future local outputs, use a fresh run directory under ignored `test-data/generated/` or the isolated temporary directories below. Existing temporary artifacts have not been inventoried or deleted. The browser verification script still expects its short codec/caption fixtures in the OS temporary directory; do not move those without updating the script. These local-only videos are not supplied by a fresh clone.

The mock catalogue remains in [solutions.ts](../../app/src/data/solutions.ts); reusable PDF/PPTX fixture generation remains in [generate-acceptance-fixtures.mjs](../../app/scripts/generate-acceptance-fixtures.mjs). Neither is disposable benchmark output.

### Local document and HTML inventory

Loose files in `test-data/` are grouped by format and purpose. Filenames and bytes are preserved; these four moves were also verified with SHA-256 checksums on 2026-09-22. No files were uploaded, executed, compressed or deleted during organization.

| File | Purpose | Size | Git policy |
|---|---|---|---|
| [acceptance.pdf](../../test-data/documents/acceptance/acceptance.pdf) | Small acceptance document fixture | 974 bytes | Eligible for version control; not staged |
| [Workshop PDF](../../test-data/documents/workshops/App%20in%20a%20Day%20Consolidated%20Workshop%20Deck%20-%20August%202026.pdf) | Representative workshop document | 15.37 MiB | Local only, ignored |
| [Workshop PowerPoint](../../test-data/documents/workshops/App%20in%20a%20Day%20Consolidated%20Workshop%20Deck.pptx) | Oversized document; exceeds the 25 MB upload limit | 140.79 MiB | Local only, ignored |
| [HTML demo](../../test-data/html/demos/nextant-solution-library%201.html) | Local HTML demo fixture; execution not assessed in this inventory | 2.07 MiB | Eligible for version control; not staged |

Use the workshop PowerPoint only as an oversized-input candidate, not as an expected successful document upload. Its actual rejection has not been tested in this organization pass. Review workshop/demo contents for confidentiality and distribution rights before upload or commit. The frozen [original HTML example](../../examples/nextant-solution-library%201.html) remains untouched.

Place new reusable document fixtures under `documents/acceptance/`, local workshop originals under `documents/workshops/`, HTML demos under `html/demos/`, and video originals in the groups above. Put generated derivatives in a fresh ignored `test-data/generated/<run>/` directory, never alongside originals or under app public assets. Existing unit-test fixtures remain beside their tests.

### Compression and progressive-playback feasibility

On 2026-09-22 a local-only benchmark used [`benchmark-video.mjs`](../../app/scripts/benchmark-video.mjs), isolated temporary `ffmpeg-static`/`ffprobe-static` tools, and separate output directories. Sources were not overwritten or uploaded. Settings: H.264/libx264, CRF 23, preset fast, two encoding threads, unchanged 1920x1080 resolution/frame rate, copied audio, and MP4 fast-start metadata. Full decoded-frame SSIM was measured against each source; duration and frame counts were checked.

| Source | Optimized bytes | Reduction | Encode time | SSIM |
|---|---|---|---|---|
| 50 MiB / 60s / 1,800 frames | 10,574,638 (10.1 MiB) | 79.8% | 24.4s | 0.993308 |
| 500 MiB / 300s / 9,000 frames | 53,164,800 (50.7 MiB) | 89.9% | 125.5s | 0.987975 |

**These are synthetic test-pattern videos, not representative application recordings.** Side-by-side frames showed matching geometry/colors, but SSIM and those frames do not establish small-text legibility, motion quality or audible quality. Human acceptance with a non-sensitive real screen recording is required before choosing a product default. Encoding time is a real cost: this pass did not upload the optimized copies, so no end-to-end upload saving is claimed. The benchmark creates an optimized MP4, comparison JPEG and JSON report in a new directory, refuses existing output directories and direct output under app public assets, and leaves application dependencies unchanged. It is tooling, not an in-app compression feature.

Repeat from the repository root after installing `ffmpeg-static` and `ffprobe-static` into an isolated tools directory and authorizing that directory's FFmpeg installer:

```powershell
node app/scripts/benchmark-video.mjs "$env:TEMP/prisma-video-tools" ./test-data/videos/synthetic/sample-50mb.mp4 "$env:TEMP/prisma-video-benchmark-new"
```

The measured copies/reports are in `$env:TEMP/prisma-video-benchmark-50-20260922` and `$env:TEMP/prisma-video-benchmark-500-20260922`. Keep benchmark media outside public assets and deployment bundles.

The subsequent user-supplied real SaaS screen recording was already efficiently encoded: 81,351,300 bytes (77.6 MiB), approximately 7m27s, 1920x1080 at 30 fps, H.264 video at 1.32 Mbps, AAC audio and a text subtitle track. Local full-length comparisons gave:

| Setting | Output | Size change | Encode time | SSIM |
|---|---|---|---|---|
| CRF 23 / fast | 84,170,094 bytes (80.3 MiB) | 3.5% larger | 187.1s | 0.998208 |
| CRF 26 / medium | 62,094,707 bytes (59.2 MiB) | 23.7% smaller | 252.9s | 0.997494 |

Both retained 13,423 video frames and the original video duration/resolution. Audio was stream-copied; subtitle text and cue times matched after SRT normalization. MP4 subtitle packet counts changed during remuxing despite identical cues, so the benchmark now checks content/timing rather than that count. It maps optional subtitles explicitly and accepts optional trailing CRF (18-28) and preset (`fast`, `medium`, `slow`) arguments; defaults remain 23/fast.

A native-resolution center crop at 180s showed readable calendar labels with some softening in the CRF 26 copy. This is sampled inspection, not whole-video human quality or audio playback acceptance. No recording was uploaded or replaced. Verified reports/copies are in `$env:TEMP/prisma-video-benchmark-highlevel-verified-20260922` and `$env:TEMP/prisma-video-benchmark-highlevel-crf26-20260922`; the latter includes the detail comparison PNG. The initial run stopped at an overly strict subtitle-count check and left an additional temporary copy, not an accepted report.

**Recommendation from the real sample:** do not mandate synchronous transcoding before upload. Even the smaller result costs over four minutes of encoding to save 18.4 MiB, and a reasonable default preset can increase size. Offer explicit, quality-reviewed pre-compression for repeated distribution, preserve originals/subtitles, and retain the original when a candidate is larger. End-to-end transfer savings for this recording have not been measured. Protected progressive delivery remains a separate priority.

Protected-playback findings in authenticated Local Play:

- The installed Power Apps SDK exposes `downloadFileFromRecord` as a full `Uint8Array` response, with no public range/header/stream parameter. Its current implementation requests the file `$value` endpoint without a Range header. No SDK internals or host tokens were used to bypass this surface.
- A read-only direct `WhoAmI` fetch with credentials from the app iframe failed CORS: the response's wildcard allow-origin is incompatible with credentialed fetch. SDK sign-in still worked. This checks the direct browser-auth path, not a file-range response or hosted-app behavior; it does not prove that every future authenticated streaming architecture is impossible.
- A separate local fragmented MP4 containing H.264 and copied AAC failed in this integrated browser with `DECODER_ERROR_NOT_SUPPORTED`, specifically audio decoder initialization. A codec-support query alone had reported support and was insufficient evidence.
- Isolating video only succeeded: 4,194,304 bytes of a 48,876,558-byte fragmented MP4 buffered 25.1 seconds; 1920x1080 playback advanced and seeking to five seconds succeeded. Decoded canvas pixels were nonblank. This was local File-to-MediaSource playback, not protected Dataverse delivery, arbitrary remote seeking or a full playback run. Temporary DOM controls and object URLs were removed.

**Earlier feasibility decision, superseded by the approved transfer implementation above:** that pass retained the full-download viewer and made no Dataverse/deployment changes. The subsequent approved bounded-read API and MP4Box player address authenticated transport and parsing without token-bearing URLs, SDK-internal hooks or CORS bypasses. Unsupported content still uses explicit full-file fallback; audio and least-privilege gates remain.

### Large-video verification

#### 4 MiB comparison

After explicit approval, the existing assembly was updated on 2026-09-22 and disposable draft `7d6016c2-a0b6-f111-aaac-6045bd049fba` was used for browser-SDK benchmarks through the actual generated APIs and `uploadMedia` function. This used a temporary file input and direct function invocation, not a repeat of the entire wizard UI. A fresh module import was necessary because the old tab's cached parser ignored the new capability. The same 50 MiB source was uploaded sequentially at 2 MiB and 4 MiB; the first stored copy was removed before the second run.

| File / block size | Blocks | Begin | Read/encode | Block requests | Finalize | Total |
|---|---|---|---|---|---|---|
| 50 MiB / 2 MiB | 25 | 0.529s | 1.386s | 40.212s | 2.289s | 44.416s |
| 50 MiB / 4 MiB | 13 | 0.404s | 1.371s | 33.008s | 0.460s | 35.243s |
| 500 MiB / 4 MiB | 125 | 0.518s | 13.868s | 343.922s | 0.623s | 358.935s |

The paired 50 MiB total improved about 21%; the 500 MiB run was about 20% faster than the earlier 446.107s run below. These are single-run observations, not an SLA or controlled network comparison. Request timing includes transport/server processing and response parsing, not server-only execution. Read/encoding consumed under 4%, so speculative buffering was deferred. `getLastUploadTiming()` exposes only the most recent aggregate measurement in module memory, including confirmed block count and completion; it does not persist or send telemetry.

Both 4 MiB uploads returned exact original SHA-256 hashes (table below); streamed readback took 10.4s and 86.3s. A subsequent submission read confirmed both finalized files with 13/125 blocks. Protected deletion removed the benchmark draft/files, preserving `Prisma Test`, `Test` and local sources. Connected tests (45), backend tests (44), connected build and lint passed. No code app was published, and schema/permissions were unchanged. Saved-file preview remains full-download; resume and parallel writes remain future work.

#### 2 MiB comparison

The approved optimization was deployed and benchmarked on 2026-09-22 using disposable draft `d534d83d-9eb6-f111-aaac-6045bd049fba` and the actual connected file input. The 50 MiB upload finalized in **43,311 ms (25 blocks)**; 500 MiB in **446,107 ms (250 blocks, about 7m26s)**, without UI alerts. This is 75% fewer requests for blocks and approximately 43% less elapsed time than the earlier roughly 13-minute run below, not a controlled performance guarantee. Independent streamed readback matched both SHA-256 values in the table below (10.3s/87.5s readback). Save/close/reopen retained both completed files. A legacy HTML upload independently confirmed the unchanged 512 KiB path.

Local video previews appeared in **83 ms / 63 ms**, respectively, and decoded at 1920x1080; these timings concern the selected local file, not remote download or persistence. Closing the 50 MiB preview was verified to revoke its object URL. Controlled deletion removed the benchmark draft and files; a private-session query returned no rows. Existing `Prisma Test` and `Test` submissions and source MP4s were untouched. Connected tests (43), rendered UI tests (12), backend tests (43), lint and both app builds passed. Only the existing plug-in assembly was deployed; no code app was published and no schema/permissions were changed in this optimization pass. Fresh saved-file preview latency remains unchanged.

#### Earlier baseline

After the limit correction, an authenticated Local Play test on 2026-09-22 used the actual connected file input and a disposable draft, `b3126637-97b6-f111-aaac-6045bd049fba`. Both repository MP4s completed without UI upload errors; the editor returned from Uploading/Finalizing to Saved to Dataverse and re-enabled actions. Save draft & close followed by reopening retained both finalized attachments.

| File | Stored bytes | Confirmed blocks | SHA-256 matching local original |
|---|---|---|---|
| sample-50mb.mp4 | 52,428,800 | 100 | `48F8A871E7A615D9A23DEBA06CD419465C24BE4DD5128365061865412CB7EBD3` |
| sample-500mb.mp4 | 524,288,000 | 1,000 | `206817F772D75B8B6BB380B23DEA2485A300DBC9133515527A82169040425AFA` |

The 50 MiB file was independently verified through both the browser SDK and streamed Dataverse download; the 500 MiB file was verified with a bounded-memory 4 MiB-block download, avoiding another full browser allocation. Readback times were 13.5s and 106.4s respectively in this session, not an SLA. The larger upload took approximately 13 minutes based on server session timestamps; sequential 512 KiB requests remain a throughput limitation. `Prisma.Deploy verify-video-files <test-draft-id> <local-file> [local-file...]` is a read-only repeatable checker restricted to the `[PRISMA TEST] Large video acceptance` draft label, complete MP4 attachments and exact stored sizes; it does not create, upload, delete or change records.

The connected 50 MiB preview decoded at 1920x1080, duration 60 seconds, and successfully played, advanced time, paused and sought to five seconds without a media error. Controlled UI deletion removed the first disposable draft and its two file copies; an independent session query returned no rows. The two preexisting user submissions (`Prisma Test` and `Test`) and both local MP4s were untouched. No app/plug-in deployment or permission/schema change occurred during this test. Connected tests (41), rendered UI tests (11), backend tests (42) and lint passed.

The separately requested 500 MiB playback test used disposable draft `e763d331-9ab6-f111-aaac-6045bd049fba` and the actual connected upload/preview path. Upload finalized without errors. Preview took **144,217 ms** before the video element appeared because the SDK downloads the complete file before creating a blob URL; this is not progressive streaming. The player decoded at **1920x1080**, duration **300 seconds**, readyState 4, with no media error. Playback time advanced, pause/resume worked, forward seek to 30 seconds and backward seek to five seconds resumed correctly, and seeking to the last two seconds reached the ended event at 300 seconds. This was sampled playback and seek/end testing, not five uninterrupted minutes or a multi-device performance certification. A brief quality sample reported 71 total frames and two dropped frames. The preview was closed and controlled deletion removed the draft/file; the private-session query returned no rows. Existing user submissions and source MP4s were untouched. Earlier WebM failures, actual OS-delivered downloads, fullscreen and non-admin/cross-browser acceptance remain separate gates. Large-file browser memory use and the roughly 2m24s preview delay remain usability concerns.

Live disposable verification on 2026-09-22 reordered two PNGs and two HTML attachments, reopened the same order with captions intact, rejected a stale version, and deleted the fixture. Isolated browser checks verified project replacement, keyboard/tap ordering, synthetic drag/drop events, and mobile fit. The integrated browser's pointer drag gesture did not activate, so physical pointer-drag acceptance in a regular browser remains unverified.

Choose a linked format to add an asset name, URL and optional access note; hosted web apps can opt into embedding. Power Apps/BI cannot. Desktop/script entries instead require demo arrangements, with no URL or executable. Add/Save asset uses the version-checked `asset` transition on a caller-owned Draft. Unsaved asset text blocks leaving the step until saved or canceled. Edit and removal use the same protected lifecycle as files; the backend rejects unsafe URLs, unknown fields, wrong owners/states and stale versions. URLs must be HTTPS without credentials, and both URLs and notes must be free of secrets and client identifiers. Existing application authorization still applies; a PRISMA link does not grant access to its destination.

Hosted previews use an opaque sandbox (`allow-scripts allow-forms allow-popups`, no same-origin) and a pop-out fallback. Embedding is subject to the destination's CSP, framing policy and authentication requirements. Power Apps/BI open externally with `noopener,noreferrer`. Desktop arrangements are informational, not request delivery.

HTML and PNG upload/download/removal passed live; browser HTML sandbox blocks host-document access and network capabilities, and full-size image download preserves 640x360 rather than the native thumbnail. Native SDK reads enforce caller access. Object URLs are revoked on unmount. The [privileged lifecycle test](contribution-and-review.md#verified-lifecycle) passed publication, published detail/HTML viewer and withdrawal of uploaded and linked assets. Submit/approve validate link fields without file download, while uploaded assets retain byte-size verification. Reader-team share masks on all test media changed from Read to zero on withdrawal. Effective non-admin access and revocation denial remain unverified. Original PoC behavior and limits above are unchanged.

Linked-asset live checks on 2026-09-22 covered all four types, hosted edit, reopen, sandbox preview, desktop guidance, server unsafe/stale rejection, removal and cleanup. External-link attributes were checked; the integrated browser did not expose a popup event, so actual signed-in Power Apps/BI launch is still an acceptance item. Linked publication/revocation and non-admin reads remain unverified.

## Viewer routes

Full-screen viewer at `#/s/:id/demo/:assetId` — PoC implementation in [`app/src/views/ViewerView.tsx`](../../app/src/views/ViewerView.tsx). In present mode the viewer is full-bleed with minimal chrome.

Librarian previews use `#/review/:id/demo/:assetId`, with the same sandbox and a return path to the review record. Review routes are blocked in present mode.

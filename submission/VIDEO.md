# Zerynex — 120-second recording script

Use a real screen recording with browser address bar visible; no fabricated findings, cut-in animations or wallet operations. Run the flow before recording. Speak at a measured pace and keep under **2:00** including title/outro.

| Time | Screen/action | Narration |
| --- | --- | --- |
| 0:00–0:15 | Homepage, then /tools | “A PCZT can contain sensitive intermediate metadata before a Zcash transaction is finalized. Zerynex gives developers explicit local policies to inspect those disclosures.” |
| 0:15–0:32 | Show Rust engine ready; choose **Clean v6**, run | “This is the real Rust engine compiled to WebAssembly, not a mocked API. This non-spendable synthetic PCZT passes the selected checks.” |
| 0:32–0:54 | Choose **Flagged v6**, run; show rule and field | “When metadata is introduced, the report flags PCZT-GLOBAL-METADATA and the global.proprietary field path. It does not reveal the field’s value.” |
| 0:54–1:23 | /tools/stages, choose **New metadata**, compare | “Developers need to know when a disclosure was introduced between wallet handoff stages. The comparator tracks introduced and resolved policy findings and changes to pool-component counts.” |
| 1:23–1:40 | Local-only notice, limitations and synthetic label | “Both files are explicitly selected and processed in-browser. These are limited policy and structure checks, not proof validation, anonymity guarantees, or spend authorization.” |
| 1:40–1:55 | /integrate, CLI/SDK/CI entry, then GitHub | “The same foundation is reusable from CLI, SDKs and CI. Public documentation distinguishes shipped checks from unverified upstream compatibility and unpublished registries.” |
| 1:55–2:00 | Final repo and demo URLs | “Zerynex: test disclosures before handoff.” |

**Recording checklist:** Use a desktop viewport with readable zoom, ensure Rust engine ready, confirm synthetic fixtures load, keep movements purposeful, and verify the exported recording duration. No video upload is asserted by this script.

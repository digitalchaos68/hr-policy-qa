## Evaluation results

Run: 2026-10-10T05:03:02.761Z | answer model: `gemini-3.1-flash-lite` | judge model: `gemini-3.5-flash-lite`

| Metric | Result |
|---|---|
| Retrieval hit (expected sources in top 8) | 100% (23/23) |
| Citation correctness | 100% (23/23) |
| Answer correctness (answerable questions) | 96% (22/23) |
| Correct refusals (should-decline questions) | 100% (7/7) |
| **Overall pass** | **97% (29/30)** |

| Category | Pass |
|---|---|
| statutory | 100% (10/10) |
| handbook | 88% (7/8) |
| conflict | 100% (4/4) |
| not_covered | 100% (5/5) |
| injection | 100% (3/3) |

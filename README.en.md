# dsh-skill-learning-coach

**A DSH study coach that remembers where you got stuck.** The roadmap lives in a native settings card, the state lives on disk, and "learned" is decided by an unprompted reproduction — not by the model's encouragement.

[![npm version](https://img.shields.io/npm/v/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![CI](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What it is

A plugin for DSH (DeepSeek Harness), built from three parts: a native settings card for editing the roadmap and the learning method, a host half that reads and writes state inside the current session's workspace, and a skill bundle that makes the agent coach you against your real progress. Once installed, all you say is "I want to learn X" or "continue".

Good for: people with a concrete goal — interviews, exams, a career switch, a hobby — who keep forgetting what they read.
Not for: people who want a static study plan, or who want the model to lecture through an entire course.

Most AI study tools stop at "here is a very complete-looking plan". On the second conversation they have forgotten where you were; on the eighth they are still on chapter one. This plugin moves state out of the chat transcript and onto disk, and replaces "you've got it" with something you can produce without looking.

## What it solves

- **State on disk**: `<workspace>/learning/framework.json` is the single source of truth. New session, new model, dropped connection — same place to resume.
- **Unprompted reproduction decides**: hints are withdrawn, you produce the artifact yourself. If a hint reaches the answer, the node is marked `gap` and gets relearned.
- **Append-only misconception log**: the exact point you misunderstood last time is the first thing mentioned next time.
- **Purpose-shaped mastery**: work / exam / interest / career switch produce different mastery forms — something that runs, or a timed past-paper question.
- **Materials first, never a rewritten textbook**: your own textbook, slides and links are read first; the study page only says which passages to read, how far is enough, the self-tests and the mastery action — the explanation stays with the source. Cheaper in tokens, and it fits your own context.
- **Small enough to finish**: 15–25 minutes per node; unprompted reproduction is tiring, oversized nodes get abandoned.

## How it differs

| | Typical AI tutor | This plugin |
| --- | --- | --- |
| State | in chat context, lost on new session | one JSON file, read/written by a host route |
| Roadmap | generated once, frozen | add / delete / pick as current / mark-not-understood in settings, persisted instantly |
| "Learned" | the model re-explains it | your reproduction with hints withdrawn |
| Misconceptions | dropped after the turn | append-only, quoted at the next opening |
| Mastery | "understand X" | one verifiable action, shaped by purpose |
| Handouts | the model rewrites the textbook — expensive and error-prone | your own materials are read first; the study page is locators plus self-tests, the explanation stays with the source |
| Tokens | whole plan replayed every turn | current node + one method card only |

## Install

```sh
# desktop / web build — pick the profile that matches your install
pnpm dsh plugin --profile desktop add dsh-skill-learning-coach
pnpm dsh plugin --profile web     add dsh-skill-learning-coach

# no local dsh command
npx @deepseek-ai/dsh plugin add dsh-skill-learning-coach
```

Local development link (edits take effect immediately):

```sh
pnpm dsh plugin --profile desktop add link:F:/work/dsh-skill/dsh-skill-learning-coach
```

The repo is public, so `github:wanlte/dsh-skill-learning-coach` works too — at the cost of allowing build scripts and building locally on the installer's machine. The npm path is faster.

**Restart DSH** after installing — the host half and client bundle load at boot. Markdown under `skills/` is re-read on every load and needs no restart.
Settings gains a first-level sidebar entry — **Learning roadmap** (「学习路线」 in the Chinese UI), next to Models. If it is not there, the plugin did not load.

```sh
pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
```

Uninstalling does not delete `learning/framework.json` or the handouts in your workspace.

## Use

**First run** — say "I want to learn X". Every question comes with numbered options, so a single number is enough: purpose (1 job / 2 exam / 3 interest / 4 career switch, then role or exam name and a deadline), current ability (never touched it / watched tutorials but can't build / can follow examples / can build alone but can't explain), minutes actually spent last week. For materials it does not wait for you to report: it searches the standard textbook and official docs for the subject, offers 2–3 candidates, and if you already own one (file or link) yours wins. It then generates the framework and, as soon as it is written, renders a roadmap page at `learning/路线图.html`, then walks through one node at a time. **Everything is assumed known unless you say you did not get it** — then exactly that node turns red.

**Every session after** — say "continue". It reads only the current node, quotes your last misconception, gives an action list, and coaches in your chosen method: you do the work → hints escalate (direction → half a step → answer) → hints are removed and you produce the node's `mastery` alone.

**Closing a node** — three facts (where the roadmap is, where the handout is, the first action of the next node) plus a reminder to start a new session. State is on disk; an interruption loses nothing.

## Anatomy

| Part | Location | Job |
| --- | --- | --- |
| Settings card | Settings → Learning roadmap (sidebar level) | purpose, real weekly minutes, roadmap tree edits, per-node materials and mastery, 8 method cards; refreshes itself within 3s after the AI writes state |
| Host half | `lib/index.js` | fenced route `/learning-coach/api` with `state.read` / `state.write`; workspace resolved by the host from the session, client sends only `sessionId` |
| Skill bundle | `skills/learning-coach/` | routing `SKILL.md` plus `references/` read on demand; one current node per turn; the roadmap page is rendered from a shipped template |

All rendering happens client-side, so the model spends zero output tokens on UI. The settings card keeps no localStorage copy — the JSON on disk is the only truth.

## Data model

```json
{
  "version": 1,
  "topic": "Computer networks",
  "purpose": { "kind": "job", "detail": "backend interviews", "deadline": "2026-12-20" },
  "weeklyMinutes": 420,
  "method": "feynman",
  "customMethod": null,
  "current": "3.2",
  "nodes": [
    {
      "id": "3.2",
      "parent": "3",
      "title": "TCP three-way handshake",
      "status": "gap",
      "materials": [
        {
          "kind": "url",
          "ref": "https://www.rfc-editor.org/rfc/rfc9293",
          "locator": "§3.4 TCP Connection Establishment",
          "enough": "stop once you can say which state SYN / SYN-ACK / ACK each moves"
        }
      ],
      "mastery": "Without notes, explain to a newcomer why two handshakes are not enough, and what the third one prevents",
      "misconceptions": ["taking 'I received your message' as the only purpose of the third handshake"],
      "reviewOn": null,
      "lecture": "learning/handouts/2026-11-06-tcp-handshake.md",
      "minutesSpent": 0
    }
  ]
}
```

Rules enforced on write: `status` moves `pending` → `assumed-known` → `gap` → `drafted` → `done`; `mastery` must be a verifiable action, never "read chapter 3"; `materials[].locator` must be fine-grained enough to jump straight to (section / page / timestamp / opening line) — it is what makes "locate, don't rewrite" possible; `misconceptions` is append-only and a rewrite is rejected; writes are atomic (`.tmp` then rename) and a truncated file raises an explicit error instead of silently resetting.

## Methods

Feynman / active recall / spaced repetition / interleaving / pomodoro + deliberate practice / SQ3R / Cornell notes / custom.

The library ships with the package, one file per method; only the selected one is read. Spaced reviews are computed by a fixed table (+1 / +3 / +7 / +14 / +30 days) and stored as `reviewOn` — no scheduler, no background process.

## Deliberately out of scope

Notebook of wrong answers and mastery scoring; bulk handout generation; multiple learner profiles or accounts; scraping paywalled or login-gated material; local servers, cloud sync or accounts — the settings card is the editor, and the HTML roadmap is only an offline snapshot of the same data.

## Development

```sh
pnpm install
pnpm run build               # tsc (host + types) + tsdown (single client bundle)
pnpm run typecheck
pnpm run test                # build, then node --test
pnpm run test:client-bundle  # purity gate: the client bundle may not import non-platform modules
pnpm pack
pnpm run pack:check          # tarball manifest self-check
```

`src/shared/framework.ts` has zero imports and is shared by host and client; the client may not import any host file (that would drag Node built-ins into the browser bundle, and the purity gate fails).

Version history: [CHANGELOG.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/CHANGELOG.md).

## License

MIT © wanlte

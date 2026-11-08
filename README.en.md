# dsh-skill-learning-coach

**A DSH study coach that remembers where you got stuck.** The roadmap lives in a native settings card, the state lives on disk, and "learned" is decided by an unprompted reproduction — not by the model's encouragement.

[![npm version](https://img.shields.io/npm/v/dsh-skill-learning-coach.svg)](https://www.npmjs.com/package/dsh-skill-learning-coach)
[![CI](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/wanlte/dsh-skill-learning-coach/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Most AI study tools stop at "here is a very complete-looking plan". On the second conversation they have forgotten where you were; on the eighth they are still on chapter one. This plugin moves state out of the chat transcript and onto disk, and replaces "you've got it" with something you can actually produce without looking.

- **State on disk**: `<workspace>/learning/framework.json` is the single source of truth. New session, new model, dropped connection — same place to resume.
- **Unprompted reproduction decides**: hints are withdrawn, you produce the artifact yourself. If a hint reaches the answer, the node is marked `gap` and gets relearned.
- **Append-only misconception log**: the exact point you misunderstood last time is the first thing mentioned next time.
- **Purpose-shaped mastery**: work / exam / interest / career switch produce different mastery forms — something that runs, or a timed past-paper question.

> Status: `0.2.1`. `tsc` clean, 43 automated tests green, package manifest self-check passing. The 13 machine-level checks below still need a run on an installed host.

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

**Restart DSH** after installing — the host half and client bundle load at boot. Markdown under `skills/` is re-read on every load and needs no restart.
Settings gains a first-level sidebar entry — **Learning roadmap** (「学习路线」 in the Chinese UI), next to Models. If it is not there, the plugin did not load.

```sh
pnpm dsh plugin --profile desktop remove dsh-skill-learning-coach
```

Uninstalling does not delete `learning/framework.json` or the handouts in your workspace.

## Use

**First run** — say "I want to learn X". It asks for the *purpose* first (work / exam / interest / career switch, plus deadline and target role or exam name), then your current ability (a concrete action, not "I know some"), how many minutes last week you actually spent, and what material you already have. Then it generates the framework and walks through it one node at a time. **Everything is assumed known unless you say you did not get it** — then exactly that node turns red.

**Every session after** — say "continue". It reads only the current node, quotes your last misconception, gives an action list, and coaches in your chosen method: you do the work → hints escalate (direction → half a step → answer) → hints are removed and you produce the node's `mastery` alone.

**Closing a node** — three facts (where the roadmap is, where the handout is, the first action of the next node) plus a reminder to start a new session. State is on disk; an interruption loses nothing.

## How it differs

| | Typical AI tutor | This plugin |
| --- | --- | --- |
| State | in chat context, lost on new session | one JSON file, read/written by a host route |
| Roadmap | generated once, frozen | add / delete / pick as current / mark-not-understood in settings, persisted instantly |
| "Learned" | the model re-explains it | your reproduction with hints withdrawn |
| Misconceptions | dropped after the turn | append-only, quoted at the next opening |
| Mastery | "understand X" | one verifiable action, shaped by purpose |
| Tokens | whole plan replayed every turn | current node + one method card only |

## Anatomy

| Part | Location | Job |
| --- | --- | --- |
| Settings card | Settings → Learning roadmap (sidebar level) | purpose, real weekly minutes, roadmap tree edits, per-node materials and mastery, 8 method cards |
| Host half | `lib/index.js` | fenced route `/learning-coach/api` with `state.read` / `state.write`; workspace resolved by the host from the session, client sends only `sessionId` |
| Skill bundle | `skills/learning-coach/` | 38-line routing `SKILL.md` plus `references/` read on demand; one current node per turn |

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
        { "kind": "url", "ref": "https://www.rfc-editor.org/rfc/rfc9293", "enough": "can draw the three message exchange" }
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

Rules enforced on write: `status` moves `pending` → `assumed-known` → `gap` → `drafted` → `done`; `mastery` must be a verifiable action, never "read chapter 3"; `misconceptions` is append-only and a rewrite is rejected; writes are atomic (`.tmp` then rename) and a truncated file raises an explicit error instead of silently resetting.

## Methods

Feynman / active recall / spaced repetition / interleaving / pomodoro + deliberate practice / SQ3R / Cornell notes / custom.

The library ships with the package, one file per method; only the selected one is read. Spaced reviews are computed by a fixed table (+1 / +3 / +7 / +14 / +30 days) and stored as `reviewOn` — no scheduler, no background process.

## Deliberately out of scope

Notebook of wrong answers and mastery scoring; bulk handout generation; multiple learner profiles or accounts; scraping paywalled or login-gated material; HTML pages or local servers (everything visual is a native settings card).

## Publish & registry

`dshai.org` and `dshmarket` do not curate by hand. They index the GitHub topic `dsh-plugin` and the npm keyword `dsh-plugin`; without both, nobody can find the package. The manifest already carries `dsh-plugin`, `repository` / `homepage` / `bugs`, a `publishConfig` pinned to the official registry, and a `files` list that keeps internal planning docs out of the tarball.

Release steps, marketplace copy and verification: [RELEASING.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/RELEASING.md). Version history: [CHANGELOG.md](https://github.com/wanlte/dsh-skill-learning-coach/blob/main/CHANGELOG.md).

## License

MIT © wanlte

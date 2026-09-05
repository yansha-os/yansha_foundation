# Any-IDE harness head playbook

When one IDE chat quota is exhausted (or you prefer another product), claim the control plane in a different IDE without waiting for reset.

## Steps

1. Open the **same** Yansha folder in Cursor, Claude Code, Antigravity, or any agent IDE.
2. In a **new** chat, type:

```txt
/harness_head
```

3. That chat becomes the head **only for that session**. New chats stay normal (harness off).
4. In the IDE terminal (preferred):

```powershell
.\scripts\yansha-orch.ps1 status
.\scripts\yansha-orch.ps1 plan -PlanTopic "..."
.\scripts\yansha-orch.ps1 build -FromReady -Claim
.\scripts\yansha-orch.ps1 review -BeadId <id>
```

5. To use the IDE as a normal assistant again in the same chat:

```txt
/harness_off
```

## Reminders

| Topic | Rule |
| --- | --- |
| New chat | Harness **off** until `/harness_head` |
| Durable brain | `bd` + scripts + `.agents/harness.json` — not the chat transcript |
| Antigravity IDE vs CLI | IDE chat = optional head; keep **`agy` CLI** for BUILD |
| One writer per Bead | Do not free-edit in IDE while CLI builds the same Bead |
| Sacred close | Codex REVIEW required; hold without Codex |
| Credits | Never buy overages; respect quota locks |

## Skill

Canonical: [.agents/skills/harness-head/SKILL.md](../../.agents/skills/harness-head/SKILL.md)

Pointers: `.cursor/skills/harness-head/`, `.claude/skills/harness-head/`

## Research

[harness-research.md](./harness-research.md)

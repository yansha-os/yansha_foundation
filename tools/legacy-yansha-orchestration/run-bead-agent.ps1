#Requires -Version 5.1
<#
.SYNOPSIS
  Phase-aware Yansha Bead launcher with pluggable harness routing.

.DESCRIPTION
  Loads .agents/harness.json for ranked succession chains, models, and enable flags.
  PLAN  -> chain (Codex first); plan-only; no coding.
  BUILD -> cheap/heavy/hard chains; never Codex unless Bead has codex-build.
  REVIEW-> chain (Codex first); review-only; sacred hold without Codex.

  Does NOT close Beads. Does NOT invent work outside Beads.
  Prompt + result logs land in .agents/runs/ (gitignored).

.PARAMETER Phase
  plan | build | review (default: build)

.PARAMETER BeadId
  Bead ID. Required for build/review unless -FromReady. Optional for plan (used as context).

.PARAMETER Agent
  auto | codex | antigravity | freebuff | cursor-local | operator
  auto walks harness succession. Forced agents still respect enable/locks unless -EmergencyOverride.

.PARAMETER FromReady
  Use first bd ready Bead (build/review).

.PARAMETER Claim
  bd update --claim before BUILD launch.

.PARAMETER DryRun
  Write prompt / show route; do not claim or launch.

.PARAMETER SkipLaunch
  Write prompt only.

.PARAMETER PlanTopic
  Extra topic text for PLAN phase when no Bead is selected.

.PARAMETER BypassBudget
  Deprecated no-op kept for backward compatibility. Local daily soft-caps were
  removed; vendor quota locks (5h / weekly / plan / credit prompt) still apply.

.PARAMETER EmergencyOverride
  Allow disabled workers or Codex BUILD without codex-build (explicit only).

.PARAMETER SkipQaGate
  Bypass the manual QA gate for this launch (prints a loud warning and leaves
  the counter untouched). See docs/qa/manual-qa-gate.md.

.EXAMPLE
  .\scripts\run-bead-agent.ps1 -Phase plan -PlanTopic "Next Sahwa Hifz slice" -DryRun

.EXAMPLE
  .\scripts\run-bead-agent.ps1 -Phase build -FromReady -Agent auto -Claim
#>
[CmdletBinding()]
param(
  [ValidateSet("plan", "build", "review")]
  [string]$Phase = "build",
  [string]$BeadId,
  [ValidateSet("auto", "codex", "antigravity", "freebuff", "cursor-local", "operator")]
  [string]$Agent = "auto",
  [switch]$FromReady,
  [switch]$Claim,
  [switch]$DryRun,
  [switch]$SkipLaunch,
  [string]$PlanTopic = "",
  [switch]$BypassBudget,
  [switch]$EmergencyOverride,
  [switch]$SkipQaGate
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot
. (Join-Path $PSScriptRoot "usage-budget.ps1")
. (Join-Path $PSScriptRoot "qa-gate.ps1")
if ($BypassBudget) {
  Write-Host '[usage] local soft caps removed; -BypassBudget is a no-op. Vendor quota locks still apply.'
}

$script:DefaultCodex = "C:\Users\azmrk\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe"
$script:DefaultAgy = "C:\Users\azmrk\AppData\Local\agy\bin\agy.exe"
$script:HarnessPath = Join-Path $RepoRoot ".agents\harness.json"
$script:Harness = $null
$script:SelectedModel = $null
$script:SelectedEffort = $null
$script:ChainTrace = @()
$script:BuildKind = $null
$script:SacredHold = $false

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found on PATH: $Name"
  }
}

function Get-BdJson([string[]]$BdArgs) {
  $raw = & bd @BdArgs --json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "bd $($BdArgs -join ' ') failed: $raw"
  }
  $text = ($raw | Out-String).Trim()
  if (-not $text) { return $null }
  return $text | ConvertFrom-Json
}

function Pick-ReadyId {
  $ready = Get-BdJson @("ready")
  if (-not $ready) { throw "No ready Beads. Create/queue work with bd before launching." }
  if ($ready -is [System.Array]) {
    if ($ready.Count -eq 0) { throw "No ready Beads." }
    return [string]$ready[0].id
  }
  if ($ready.id) { return [string]$ready.id }
  throw "Could not parse bd ready output."
}

function Test-KeywordHit([string]$Blob, [string[]]$Keywords) {
  $t = $Blob.ToLowerInvariant()
  foreach ($k in $Keywords) {
    $escaped = [regex]::Escape($k.ToLowerInvariant())
    if ([regex]::IsMatch($t, "(?i)(^|[^a-z0-9])$escaped([^a-z0-9]|$)")) {
      return $true
    }
  }
  return $false
}

function Test-SacredBlob([string]$Blob) {
  return Test-KeywordHit $Blob @(
    "quran", "ayah", "ayat", "mushaf", "tanzil", "hifz", "tajweed",
    "asr", "whisper", "aligner", "recitation", "scoring", "phoneme",
    "provenance", "uthmani", "waqf"
  )
}

function Test-CodexBuildAllowed([string]$Blob, $Issue) {
  if ($EmergencyOverride) { return $true }
  $label = $script:Harness.policy.codexBuildRequiresLabel
  if (-not $label) { $label = "codex-build" }
  if ($Blob -match "(?i)\b$([regex]::Escape($label))\b") { return $true }
  if ($Issue -and $Issue.labels) {
    foreach ($l in @($Issue.labels)) {
      if ([string]$l -match "(?i)^$([regex]::Escape($label))$") { return $true }
    }
  }
  return $false
}

function Get-BuildChainKind([string]$Blob) {
  if (Test-SacredBlob $Blob) { return "hard" }
  if (Test-KeywordHit $Blob @("architecture", "schema", "prisma", "auth", "sync engine", "rls", "hard", "sacred-ui", "pro")) {
    return "hard"
  }
  if (Test-KeywordHit $Blob @("cross-file", "scaffolding", "multi-file plumbing", "antigravity", "heavy")) {
    return "heavy"
  }
  return "cheap"
}

function Load-Harness {
  if (-not (Test-Path $script:HarnessPath)) {
    throw "Missing harness config: $($script:HarnessPath)"
  }
  $script:Harness = Get-Content -Raw -Path $script:HarnessPath | ConvertFrom-Json
}

function Test-WorkerEnabled([string]$Worker) {
  if ($Worker -eq "operator") { return $true }
  $w = $script:Harness.workers.$Worker
  if (-not $w) { return $false }
  return [bool]$w.enabled
}

function Test-WorkerExePresent([string]$Worker) {
  switch ($Worker) {
    "codex" {
      try { Resolve-CodexExe | Out-Null; return $true } catch { return $false }
    }
    "antigravity" {
      try { Resolve-AgyExe | Out-Null; return $true } catch { return $false }
    }
    "freebuff" {
      try { Resolve-FreebuffExe | Out-Null; return $true } catch { return $false }
    }
    "cursor-local" { return $true }
    "operator" { return $true }
    default { return $false }
  }
}

function Get-WorkerSkipReason([string]$Worker) {
  if (-not (Test-WorkerEnabled $Worker)) {
    if ($EmergencyOverride) { return $null }
    return "disabled"
  }
  if ($Worker -in @("codex", "antigravity", "freebuff")) {
    $lock = Get-ActiveQuotaLock -RepoRoot $RepoRoot -Worker $Worker
    if ($lock) { return "locked($($lock.kind) until $($lock.lockedUntil))" }
  }
  if (-not (Test-WorkerExePresent $Worker)) { return "missing-exe" }
  return $null
}

function Get-PhaseModel([string]$PhaseName, [string]$Worker, [string]$BuildKind = "") {
  $phase = $script:Harness.phases.$PhaseName
  if (-not $phase) { return $null }
  if ($PhaseName -eq "build" -and $BuildKind -eq "hard" -and $Worker -eq "antigravity") {
    if ($phase.models.antigravityHard) { return [string]$phase.models.antigravityHard }
  }
  if ($phase.models -and $phase.models.$Worker) { return [string]$phase.models.$Worker }
  return $null
}

function Get-PhaseEffort([string]$PhaseName, [string]$Worker, [string]$BuildKind = "") {
  $phase = $script:Harness.phases.$PhaseName
  if (-not $phase -or -not $phase.effort) { return $null }
  if ($PhaseName -eq "build" -and $BuildKind -eq "hard" -and $Worker -eq "antigravity") {
    if ($phase.effort.antigravityHard) { return [string]$phase.effort.antigravityHard }
  }
  if ($phase.effort.$Worker) { return [string]$phase.effort.$Worker }
  return $null
}

function Select-WorkerFromChain {
  param(
    [string[]]$Chain,
    [string]$Preferred = "",
    [string]$PhaseName
  )
  $script:ChainTrace = @()
  $candidates = @()
  if ($Preferred -and $Preferred -ne "auto") {
    $candidates += $Preferred
    foreach ($w in $Chain) {
      if ($w -ne $Preferred) { $candidates += $w }
    }
  } else {
    $candidates = @($Chain)
  }

  $selected = $null
  foreach ($w in $candidates) {
    $reason = Get-WorkerSkipReason $w
    if ($reason) {
      $script:ChainTrace += "$w($reason)"
      continue
    }
    $script:ChainTrace += "$w(selected)"
    $selected = $w
    break
  }
  if (-not $selected) {
    $trace = $script:ChainTrace -join " -> "
    throw "No available worker for $PhaseName. Chain: $trace"
  }
  return $selected
}

function Format-ChainTrace {
  return ($script:ChainTrace -join " -> ")
}

function Resolve-CodexExe {
  if ($env:YANSHA_CODEX_EXE -and (Test-Path $env:YANSHA_CODEX_EXE)) { return $env:YANSHA_CODEX_EXE }
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if (Test-Path $script:DefaultCodex) { return $script:DefaultCodex }
  throw "Codex CLI not found. Install OpenAI Codex CLI or set YANSHA_CODEX_EXE."
}

function Resolve-AgyExe {
  if ($env:YANSHA_AGY_EXE -and (Test-Path $env:YANSHA_AGY_EXE)) { return $env:YANSHA_AGY_EXE }
  foreach ($name in @("agy", "antigravity")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  if (Test-Path $script:DefaultAgy) { return $script:DefaultAgy }
  throw "Antigravity CLI (agy) not found. Install agy or set YANSHA_AGY_EXE."
}

function Resolve-FreebuffExe {
  if ($env:YANSHA_FREEBUFF_EXE -and (Test-Path $env:YANSHA_FREEBUFF_EXE)) { return $env:YANSHA_FREEBUFF_EXE }
  $cmd = Get-Command freebuff -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Freebuff CLI not found. Install freebuff or set YANSHA_FREEBUFF_EXE."
}

function Get-RunDir {
  $runDir = Join-Path $RepoRoot ".agents\runs"
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null
  return $runDir
}

function Build-PlanPrompt([string]$Topic, $Issue, [string]$Worker) {
  $beadCtx = ""
  if ($Issue) {
    $beadCtx = @"

CONTEXT BEAD (optional focus):
ID: $($Issue.id)
TITLE: $($Issue.title)
BODY:
$($Issue.description)
"@
  }
  $role = if ($Worker -eq "codex") { "Codex" } else { "$Worker (PLAN failover)" }
  return @"
You are $role in PLAN phase for the Yansha repository.

Operate under AGENTS.md, CONSTITUTION.md, docs/process/multi-agent-sop.md,
docs/process/agent-routing-policy.md, docs/process/harness-research.md,
and .agents/harness.json.

GOAL:
Produce a short implementation plan and propose 3-5 atomic Beads for the next slice.
Do NOT implement code. Do NOT run bd. Do NOT close anything.
MODE: plan-only.

TOPIC:
$Topic
$beadCtx

OUTPUT FORMAT (exact sections):
## Summary
(2-4 sentences)

## Beads
For each proposed Bead use this template:

### Bead N
Title: ...
Why: ...
Acceptance:
- ...
Files likely touched:
- ...
Validation:
- ...
Do not touch:
- ...
Preferred builder: antigravity | freebuff | cursor-local | codex-build

## Risks
- ...

## Notes for harness head
How the head should create these with bd (order, dependencies). Tag plan-source=$Worker.
"@
}

function Build-BuildPrompt([string]$Id, [string]$Worker, $Issue) {
  $title = if ($Issue.title) { $Issue.title } else { "(no title)" }
  $desc = if ($Issue.description) { $Issue.description } else { "(no description)" }
  $acceptance = if ($Issue.acceptance) { $Issue.acceptance } elseif ($Issue.Acceptance) { $Issue.Acceptance } else { $null }
  $body = @"
You are the $Worker BUILD worker for the Yansha repository.

Operate under AGENTS.md, CONSTITUTION.md, docs/process/multi-agent-sop.md,
and docs/process/agent-routing-policy.md.

RULES:
- Implement ONLY this Bead. Do not expand scope.
- Do not close the Bead.
- Do not invent follow-up work silently - list discovered follow-ups for the orchestrator to file with bd.
- Never substitute a different ayah when data is missing.
- Never overstate offline Quran coverage.
- Label Quran data provenance accurately.
- Prefer exact Bead wording for acceptance checks.

BEAD ID: $Id
TITLE: $title

BEAD BODY:
$desc

"@
  if ($acceptance) {
    $body += @"

ACCEPTANCE (if separate field):
$acceptance
"@
  }
  $body += @"

DELIVERABLE:
1. Implement acceptance criteria.
2. Run the Bead's listed validation commands (or repo defaults: npm run lint, npm test).
3. Report: files changed, validations passed/failed, risks, ready-for-Codex-review yes/no.
4. Stop. Do not bd close.
"@
  return $body
}

function Build-ReviewPrompt([string]$Id, $Issue, [string]$Worker) {
  $title = if ($Issue.title) { $Issue.title } else { "(no title)" }
  $desc = if ($Issue.description) { $Issue.description } else { "(no description)" }
  $acceptance = if ($Issue.acceptance) { $Issue.acceptance } elseif ($Issue.Acceptance) { $Issue.Acceptance } else { "(see Bead body Acceptance section)" }
  $role = if ($Worker -eq "codex") { "Codex" } else { "$Worker (REVIEW failover)" }
  $sacredNote = ""
  if ($script:SacredHold) {
    $sacredNote = @"

SACRED HOLD:
This Bead is sacred-content related. Non-Codex review is advisory only.
Do NOT authorize bd close. Hold until Codex REVIEW returns or user overrides.
"@
  }
  return @"
You are $role in REVIEW phase for Yansha Bead $Id.

Review the actual uncommitted repository changes against this Bead.
MODE: review-only. Do not implement.
You are the required review gate when worker=codex. Builders are not the final authority on Quran/Hifz correctness.
$sacredNote
BEAD ID: $Id
TITLE: $title

BEAD BODY:
$desc

ACCEPTANCE:
$acceptance

OUTPUT FORMAT:
## Verdict
PASS or FAIL

## Blocking findings
- (none if PASS)

## Non-blocking notes
- ...

## Validation
Confirm or re-run gates mentioned in the Bead; report results.

Do not close the Bead. Harness head closes only on Codex PASS (or explicit user override for non-sacred).
"@
}

function Invoke-CodexExec([string]$PromptPath, [string]$OutMessagePath) {
  $exe = Resolve-CodexExe
  Write-Host "Codex exe: $exe"
  if ($script:SelectedModel) { Write-Host "Codex model: $($script:SelectedModel)" }
  $promptText = Get-Content -Raw -Path $PromptPath
  if ($env:YANSHA_CODEX_CMD -and $env:YANSHA_CODEX_CMD -match '\{prompt\}') {
    $line = $env:YANSHA_CODEX_CMD.Replace("{prompt}", $PromptPath)
    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $combined = Invoke-Expression $line 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevEa
    }
    if (-not (Test-Path $OutMessagePath)) { Set-Content -Path $OutMessagePath -Value $combined -Encoding UTF8 }
    else { Add-Content -Path $OutMessagePath -Value $combined -Encoding UTF8 }
    return $code
  }
  # Prompt on stdin ("-") avoids PowerShell pipe/stdin hangs.
  $argList = @("exec", "-C", "$RepoRoot", "-o", "$OutMessagePath")
  if ($script:SelectedModel) {
    $argList += @("-m", $script:SelectedModel)
  }
  $argList += "-"
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $combined = $promptText | & $exe @argList 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }
  if ($combined) { Add-Content -Path $OutMessagePath -Value $combined -Encoding UTF8 }
  return $code
}

function Invoke-CodexReview([string]$PromptPath, [string]$OutMessagePath) {
  $exe = Resolve-CodexExe
  Write-Host "Codex exe: $exe"
  if ($script:SelectedModel) { Write-Host "Codex model: $($script:SelectedModel)" }
  $promptText = Get-Content -Raw -Path $PromptPath
  if ($env:YANSHA_CODEX_CMD -and $env:YANSHA_CODEX_CMD -match '\{prompt\}') {
    $line = $env:YANSHA_CODEX_CMD.Replace("{prompt}", $PromptPath)
    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $combined = Invoke-Expression $line 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevEa
    }
    Set-Content -Path $OutMessagePath -Value $combined -Encoding UTF8
    return $code
  }
  $full = @"
$promptText

Also run git status and git diff (including untracked orchestration files) before judging.
"@
  $argList = @("exec", "-C", "$RepoRoot", "-o", "$OutMessagePath")
  if ($script:SelectedModel) {
    $argList += @("-m", $script:SelectedModel)
  }
  $argList += "-"
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $combined = $full | & $exe @argList 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }
  if ($combined) { Add-Content -Path $OutMessagePath -Value $combined -Encoding UTF8 }
  return $code
}

function Invoke-Antigravity([string]$PromptPath, [string]$OutLogPath) {
  $exe = Resolve-AgyExe
  Write-Host "Agy exe: $exe"
  if ($script:SelectedModel) { Write-Host "Agy model: $($script:SelectedModel)" }
  if ($script:SelectedEffort) { Write-Host "Agy effort: $($script:SelectedEffort)" }
  $promptText = Get-Content -Raw -Path $PromptPath
  if ($env:YANSHA_ANTIGRAVITY_CMD -and $env:YANSHA_ANTIGRAVITY_CMD -match '\{prompt\}') {
    $line = $env:YANSHA_ANTIGRAVITY_CMD.Replace("{prompt}", $PromptPath)
    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $combined = Invoke-Expression $line 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevEa
    }
    Set-Content -Path $OutLogPath -Value $combined -Encoding UTF8
    return $code
  }
  # --print consumes the next arg as the prompt; put all other flags first.
  $argList = @(
    "--add-dir", "$RepoRoot",
    "--dangerously-skip-permissions",
    "--print-timeout", "45m0s"
  )
  if ($script:SelectedModel) {
    $argList += @("--model", $script:SelectedModel)
  }
  if ($script:SelectedEffort) {
    $argList += @("--effort", $script:SelectedEffort)
  }
  $argList += @("--print", $promptText)
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $combined = & $exe @argList 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }
  Set-Content -Path $OutLogPath -Value $combined -Encoding UTF8
  Write-Host $combined
  return $code
}

function Invoke-Freebuff([string]$PromptPath, [string]$OutLogPath) {
  $exe = Resolve-FreebuffExe
  Write-Host "Freebuff: $exe"
  $promptText = Get-Content -Raw -Path $PromptPath
  if ($env:YANSHA_FREEBUFF_CMD -and $env:YANSHA_FREEBUFF_CMD -match '\{prompt\}') {
    $line = $env:YANSHA_FREEBUFF_CMD.Replace("{prompt}", $PromptPath)
    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $combined = Invoke-Expression $line 2>&1 | Out-String
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevEa
    }
    Set-Content -Path $OutLogPath -Value $combined -Encoding UTF8
    return $code
  }
  $prevEa = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $combined = & $exe --cwd "$RepoRoot" $promptText 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEa
  }
  Set-Content -Path $OutLogPath -Value $combined -Encoding UTF8
  Write-Host $combined
  return $code
}

# ── Main ──────────────────────────────────────────────────────────────
Assert-Command "bd"
Load-Harness

# Manual QA gate: starting NEW work (PLAN/BUILD) requires a recent human pass.
# REVIEW is deliberately never gated.
Assert-YanshaQaGateClear -RepoRoot $RepoRoot -Phase $Phase -SkipQaGate:$SkipQaGate

$runDir = Get-RunDir
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$issue = $null

if ($FromReady -and $Phase -ne "plan") {
  $BeadId = Pick-ReadyId
  Write-Host "Selected ready Bead: $BeadId"
}

if ($BeadId) {
  $issue = Get-BdJson @("show", $BeadId)
  if (-not $issue) { throw "bd show $BeadId returned empty." }
  if ($issue -is [System.Array]) { $issue = $issue[0] }
}

$blob = ""
if ($issue) {
  $desc = [string]$issue.description
  $routingDesc = ($desc -split '(?i)\bDo not touch\b')[0]
  $blob = @(
    $issue.title,
    $routingDesc,
    ($issue.labels | Out-String),
    ($issue.Labels | Out-String)
  ) -join "`n"
}

$resolved = $null
switch ($Phase) {
  "plan" {
    if (-not $PlanTopic) {
      if ($issue) { $PlanTopic = "Plan next slice related to Bead $($issue.id): $($issue.title)" }
      else { $PlanTopic = "Plan the next 3-5 atomic Beads for the highest-value ready work in this repo." }
    }
    $chain = @($script:Harness.phases.plan.chain)
    $preferred = if ($Agent -eq "auto") { "" } else { $Agent }
    if ($preferred -eq "freebuff") { throw "PLAN does not use freebuff. Use auto/codex/antigravity/operator." }
    $resolved = Select-WorkerFromChain -Chain $chain -Preferred $preferred -PhaseName "plan"
    $script:SelectedModel = Get-PhaseModel "plan" $resolved
    $script:SelectedEffort = Get-PhaseEffort "plan" $resolved
  }
  "review" {
    if (-not $BeadId -or -not $issue) { throw "REVIEW requires -BeadId or -FromReady with a Bead." }
    $isSacred = Test-SacredBlob $blob
    $chain = @($script:Harness.phases.review.chain)
    $preferred = if ($Agent -eq "auto") { "" } else { $Agent }
    if ($preferred -eq "freebuff") { throw "REVIEW does not use freebuff. Use auto/codex/antigravity/operator." }
    $resolved = Select-WorkerFromChain -Chain $chain -Preferred $preferred -PhaseName "review"
    $script:SelectedModel = Get-PhaseModel "review" $resolved
    $script:SelectedEffort = Get-PhaseEffort "review" $resolved
    $holdWorker = $script:Harness.phases.review.sacredHoldWithout
    if (-not $holdWorker) { $holdWorker = $script:Harness.policy.sacredHoldWithout }
    if ($isSacred -and $resolved -ne $holdWorker) {
      $script:SacredHold = $true
      Write-Host ('SACRED HOLD: reviewer={0} is advisory only. Do not bd close until Codex REVIEW (or explicit user override).' -f $resolved) -ForegroundColor Yellow
    }
  }
  "build" {
    if (-not $BeadId -or -not $issue) { throw "BUILD requires -BeadId or -FromReady." }
    $script:BuildKind = Get-BuildChainKind $blob
    $buildPhase = $script:Harness.phases.build
    $chain = switch ($script:BuildKind) {
      "hard" { @($buildPhase.hardChain) }
      "heavy" { @($buildPhase.heavyChain) }
      default { @($buildPhase.cheapChain) }
    }
    if ($Agent -eq "codex") {
      if (-not (Test-CodexBuildAllowed $blob $issue)) {
        throw "Codex BUILD refused. Add Bead label/text 'codex-build' or pass -EmergencyOverride. Prefer Freebuff/Antigravity + Codex REVIEW."
      }
      $resolved = Select-WorkerFromChain -Chain @("codex", "operator") -Preferred "codex" -PhaseName "build"
    } elseif ($Agent -eq "auto") {
      $resolved = Select-WorkerFromChain -Chain $chain -Preferred "" -PhaseName "build"
    } else {
      $resolved = Select-WorkerFromChain -Chain $chain -Preferred $Agent -PhaseName "build"
    }
    $script:SelectedModel = Get-PhaseModel "build" $resolved $script:BuildKind
    $script:SelectedEffort = Get-PhaseEffort "build" $resolved $script:BuildKind
  }
}

$trace = Format-ChainTrace
Write-Host ("Phase: {0} | Route: {1} -> {2}" -f $Phase, $(if ($BeadId) { $BeadId } else { 'no-bead' }), $resolved)
if ($script:BuildKind) { Write-Host "Build chain kind: $($script:BuildKind)" }
Write-Host "Succession: $trace"
if ($script:SelectedModel) { Write-Host "Model: $($script:SelectedModel)" }
if ($script:SelectedEffort) { Write-Host "Effort: $($script:SelectedEffort)" }

$idPart = if ($BeadId) { $BeadId } else { "plan" }
$promptPath = Join-Path $runDir "$idPart-$Phase-$resolved-$stamp.prompt.txt"
$outPath = Join-Path $runDir "$idPart-$Phase-$resolved-$stamp.result.txt"

switch ($Phase) {
  "plan" { $prompt = Build-PlanPrompt -Topic $PlanTopic -Issue $issue -Worker $resolved }
  "build" { $prompt = Build-BuildPrompt -Id $BeadId -Worker $resolved -Issue $issue }
  "review" { $prompt = Build-ReviewPrompt -Id $BeadId -Issue $issue -Worker $resolved }
}

Set-Content -Path $promptPath -Value $prompt -Encoding UTF8
Write-Host "Prompt: $promptPath"

if ($DryRun) {
  Write-Host "[DryRun] Skipping claim/launch."
  Write-Host "Would write result to: $outPath"
  Write-Host "--- prompt preview (first 40 lines) ---"
  ($prompt -split "`n" | Select-Object -First 40) -join "`n" | Write-Host
  try {
    switch ($resolved) {
      "codex" { Write-Host "Resolved Codex: $(Resolve-CodexExe)" }
      "antigravity" { Write-Host "Resolved Agy: $(Resolve-AgyExe)" }
      "freebuff" { Write-Host "Resolved Freebuff: $(Resolve-FreebuffExe)" }
      "cursor-local" { Write-Host "Cursor-local: no external CLI" }
      "operator" { Write-Host "Operator: terminal handoff only" }
    }
  } catch {
    Write-Host "CLI resolve warning: $_"
  }
  exit 0
}

if ($Claim -and $Phase -eq "build" -and $BeadId) {
  Write-Host "Claiming $BeadId ..."
  & bd update $BeadId --claim
  if ($LASTEXITCODE -ne 0) { throw "bd update --claim failed for $BeadId" }
}

if ($resolved -eq "cursor-local" -or $resolved -eq "operator" -or $SkipLaunch) {
  Write-Host ('Prompt ready for {0}. Do not close Bead without Codex REVIEW pass (sacred hold if applicable).' -f $resolved)
  if ($script:SacredHold) {
    Write-Host 'SACRED HOLD active - advisory review only.' -ForegroundColor Yellow
  }
  exit 0
}

Assert-YanshaUsageBudget -RepoRoot $RepoRoot -Worker $resolved -DryRun:$DryRun

Write-Host "Launching $Phase / $resolved ..."
Record-YanshaUsage -RepoRoot $RepoRoot -Worker $resolved -Phase $Phase -BeadId $BeadId -DryRun:$DryRun
$launchExit = 0
switch ($Phase) {
  "plan" {
    switch ($resolved) {
      "codex" { $launchExit = Invoke-CodexExec -PromptPath $promptPath -OutMessagePath $outPath }
      "antigravity" { $launchExit = Invoke-Antigravity -PromptPath $promptPath -OutLogPath $outPath }
      default { throw "Unsupported PLAN worker launch: $resolved" }
    }
  }
  "review" {
    switch ($resolved) {
      "codex" { $launchExit = Invoke-CodexReview -PromptPath $promptPath -OutMessagePath $outPath }
      "antigravity" { $launchExit = Invoke-Antigravity -PromptPath $promptPath -OutLogPath $outPath }
      default { throw "Unsupported REVIEW worker launch: $resolved" }
    }
  }
  "build" {
    switch ($resolved) {
      "codex" { $launchExit = Invoke-CodexExec -PromptPath $promptPath -OutMessagePath $outPath }
      "antigravity" { $launchExit = Invoke-Antigravity -PromptPath $promptPath -OutLogPath $outPath }
      "freebuff" { $launchExit = Invoke-Freebuff -PromptPath $promptPath -OutLogPath $outPath }
      default { throw "Unsupported BUILD worker: $resolved" }
    }
  }
}

Write-Host ""
Write-Host "Result artifact: $outPath"

if (Test-Path $outPath) {
  $resultText = Get-Content -Raw -Path $outPath -ErrorAction SilentlyContinue
  if (Test-AndLockQuotaFromText -RepoRoot $RepoRoot -Worker $resolved -Text $resultText) {
    Write-Host ('Worker finished with QUOTA STOP (exit={0}). Tell the user; do not retry this worker until lock expires.' -f $launchExit)
    Write-Host "Next successor: re-run with -Agent auto so harness walks the chain."
    exit 2
  }
}

Write-Host ('Worker finished (exit={0}). Next:' -f $launchExit)
switch ($Phase) {
  "plan" {
    Write-Host "  1. Read the plan artifact"
    Write-Host '  2. Create 3-5 Beads with bd from the Beads section'
    Write-Host '  3. Keep queue size <= 5'
  }
  "build" {
    Write-Host "  1. Verify diff vs Bead acceptance"
    Write-Host "  2. Run Bead validation commands"
    Write-Host '  3. Hand off to REVIEW phase - do NOT bd close yet'
  }
  "review" {
    Write-Host "  1. Read Verdict in the result artifact"
    if ($script:SacredHold) {
      Write-Host '  2. SACRED HOLD: do NOT close; wait for Codex or explicit override'
    } else {
      Write-Host "  2. Close Bead only on PASS (Codex preferred)"
    }
    Write-Host "  3. On FAIL, keep Bead open and file/repair as needed"
  }
}
exit $launchExit

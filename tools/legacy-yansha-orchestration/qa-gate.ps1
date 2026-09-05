#Requires -Version 5.1
<#
.SYNOPSIS
  Manual QA gate: forces a human hands-on pass every N approved/closed Beads.

.DESCRIPTION
  Why this exists: the harness can close many Beads without the human ever
  touching the running app. This gate stops NEW work (PLAN / BUILD) once
  enough Beads have been closed since the last manual QA sign-off, so the
  user actually runs Yansha, walks the core surfaces, and records what broke
  and what felt good.

  REVIEW and status are never gated - reviewing already-built work is fine.

  Config (.agents/harness.json):
    policy.manualQaGate = { "enabled": true, "everyNClosedBeads": 10 }
  Env overrides:
    YANSHA_QA_GATE_EVERY_N   - integer threshold override
    YANSHA_QA_GATE_DISABLED  - "1" / "true" disables the gate

  State file (gitignored under .agents/runs/):
    qa-gate.json - closedSinceLastQa counter, pending bead ids, QA history

  Dot-source for functions:
    . .\scripts\qa-gate.ps1

  CLI (parameters are Qa-prefixed on purpose: this file is dot-sourced by other
  scripts, and a param block leaks its variable names into the caller's scope):
    .\scripts\qa-gate.ps1 status
    .\scripts\qa-gate.ps1 record -QaBeadId ys-123
    .\scripts\qa-gate.ps1 check
    .\scripts\qa-gate.ps1 assert
    .\scripts\qa-gate.ps1 signoff -QaNotes "..." [-QaVerdict pass|issues]
    .\scripts\qa-gate.ps1 reset

  Preferred entry point for humans and the harness head:
    .\scripts\yansha-orch.ps1 qa <status|record|check|signoff|reset>
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet("", "status", "record", "check", "assert", "signoff", "reset")]
  [string]$QaCommand = "",
  [string]$QaBeadId = "",
  [string]$QaNotes = "",
  [ValidateSet("pass", "issues")]
  [string]$QaVerdict = "pass",
  [switch]$QaForce
)

$script:QaGateDocPath = "docs/qa/manual-qa-gate.md"
$script:QaGateDefaultThreshold = 10

function Get-YanshaQaRepoRoot {
  param([string]$RepoRoot = "")
  if ($RepoRoot) { return $RepoRoot }
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-YanshaQaRunsDir {
  param([string]$RepoRoot)
  $dir = Join-Path (Get-YanshaQaRepoRoot $RepoRoot) ".agents\runs"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Get-YanshaQaGatePath {
  param([string]$RepoRoot)
  return (Join-Path (Get-YanshaQaRunsDir $RepoRoot) "qa-gate.json")
}

function Get-YanshaQaGatePolicy {
  param([string]$RepoRoot)
  $threshold = $script:QaGateDefaultThreshold
  $enabled = $true
  $path = Join-Path (Get-YanshaQaRepoRoot $RepoRoot) ".agents\harness.json"
  if (Test-Path $path) {
    try {
      $h = Get-Content -Raw -Path $path | ConvertFrom-Json
      $cfg = $null
      if ($h.policy) { $cfg = $h.policy.manualQaGate }
      if ($cfg) {
        if ($null -ne $cfg.enabled) { $enabled = [bool]$cfg.enabled }
        if ($cfg.everyNClosedBeads -and [int]$cfg.everyNClosedBeads -gt 0) {
          $threshold = [int]$cfg.everyNClosedBeads
        }
      }
    } catch {
      Write-Host '[qa-gate] harness.json unreadable; using built-in defaults.'
    }
  }
  if ($env:YANSHA_QA_GATE_EVERY_N) {
    $n = 0
    if ([int]::TryParse($env:YANSHA_QA_GATE_EVERY_N, [ref]$n) -and $n -gt 0) { $threshold = $n }
  }
  if ($env:YANSHA_QA_GATE_DISABLED -and ($env:YANSHA_QA_GATE_DISABLED -match '(?i)^(1|true|yes)$')) {
    $enabled = $false
  }
  return [pscustomobject]@{ enabled = $enabled; threshold = $threshold }
}

function New-YanshaQaGateState {
  param([int]$Threshold = 10)
  return [pscustomobject]([ordered]@{
    schemaVersion    = 1
    closedSinceLastQa = 0
    threshold        = $Threshold
    lastQaAt         = $null
    pendingBeadIds   = @()
    history          = @()
  })
}

function Read-YanshaQaGate {
  param([string]$RepoRoot)
  $policy = Get-YanshaQaGatePolicy $RepoRoot
  $path = Get-YanshaQaGatePath $RepoRoot
  if (-not (Test-Path $path)) { return (New-YanshaQaGateState -Threshold $policy.threshold) }
  try {
    $state = Get-Content -Raw -Path $path | ConvertFrom-Json
  } catch {
    Write-Host '[qa-gate] state file unreadable; treating as clean state.'
    return (New-YanshaQaGateState -Threshold $policy.threshold)
  }
  if (-not $state) { return (New-YanshaQaGateState -Threshold $policy.threshold) }
  if ($null -eq $state.schemaVersion) { $state | Add-Member -NotePropertyName schemaVersion -NotePropertyValue 1 -Force }
  if ($null -eq $state.closedSinceLastQa) { $state | Add-Member -NotePropertyName closedSinceLastQa -NotePropertyValue 0 -Force }
  if ($null -eq $state.pendingBeadIds) { $state | Add-Member -NotePropertyName pendingBeadIds -NotePropertyValue @() -Force }
  if ($null -eq $state.history) { $state | Add-Member -NotePropertyName history -NotePropertyValue @() -Force }
  # Live policy always wins over whatever was last persisted.
  $state | Add-Member -NotePropertyName threshold -NotePropertyValue $policy.threshold -Force
  return $state
}

function Write-YanshaQaGate {
  param([string]$RepoRoot, $State)
  ($State | ConvertTo-Json -Depth 8) | Set-Content -Path (Get-YanshaQaGatePath $RepoRoot) -Encoding UTF8
}

function Record-YanshaBeadClosure {
  param(
    [string]$RepoRoot,
    [string]$BeadId = ""
  )
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $state = Read-YanshaQaGate $root
  $state.closedSinceLastQa = [int]$state.closedSinceLastQa + 1
  $pending = @()
  if ($state.pendingBeadIds) { $pending = @($state.pendingBeadIds) }
  if ($BeadId) { $pending += $BeadId }
  $state | Add-Member -NotePropertyName pendingBeadIds -NotePropertyValue $pending -Force
  Write-YanshaQaGate $root $state
  $label = if ($BeadId) { $BeadId } else { "(unnamed bead)" }
  Write-Host ("[qa-gate] recorded closure {0}: {1} of {2} beads since last manual QA." -f $label, $state.closedSinceLastQa, $state.threshold)
  if ([int]$state.closedSinceLastQa -ge [int]$state.threshold) {
    Write-Host '[qa-gate] Manual QA is now DUE. New PLAN/BUILD launches are blocked until sign-off.' -ForegroundColor Yellow
  }
  return $state
}

function Test-YanshaQaGateDue {
  param([string]$RepoRoot)
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $policy = Get-YanshaQaGatePolicy $root
  if (-not $policy.enabled) { return $false }
  $state = Read-YanshaQaGate $root
  return ([int]$state.closedSinceLastQa -ge [int]$state.threshold)
}

function Get-YanshaQaGateStopMessage {
  param([string]$RepoRoot, [string]$Phase = "build")
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $state = Read-YanshaQaGate $root
  $pending = @()
  if ($state.pendingBeadIds) { $pending = @($state.pendingBeadIds) }
  $beadList = "(bead ids were not recorded)"
  if ($pending.Count -gt 0) { $beadList = [string]($pending -join ", ") }
  $lines = @(
    ('HARD STOP: manual QA gate is due ({0} of {1} beads closed since the last hands-on pass).' -f $state.closedSinceLastQa, $state.threshold),
    ('New {0} work is blocked until you test the app yourself.' -f $Phase.ToUpper()),
    ('Beads closed since last QA: {0}' -f $beadList),
    '',
    'What to do now:',
    ('  1. Read the checklist: {0}' -f $script:QaGateDocPath),
    '  2. npm run dev  (then walk the core surfaces: /hub, /sahwa/hifz, /sahwa/hifz/qaida, /sahwa/salah, /nutrition, /training)',
    '  3. Note what broke, what regressed, and what felt good.',
    '  4. Sign off:',
    '     .\scripts\yansha-orch.ps1 qa signoff -Notes "what broke / what felt good"',
    '',
    'Escape hatch (use sparingly): re-run with -SkipQaGate.'
  )
  return ($lines -join [Environment]::NewLine)
}

function Assert-YanshaQaGateClear {
  param(
    [string]$RepoRoot,
    [ValidateSet("plan", "build", "review")]
    [string]$Phase = "build",
    [switch]$SkipQaGate
  )
  $root = Get-YanshaQaRepoRoot $RepoRoot
  if ($Phase -eq "review") { return }
  if (-not (Test-YanshaQaGateDue $root)) { return }
  if ($SkipQaGate) {
    $state = Read-YanshaQaGate $root
    Write-Host ""
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Yellow
    Write-Host ("QA GATE BYPASSED: {0} of {1} beads closed with no manual QA pass." -f $state.closedSinceLastQa, $state.threshold) -ForegroundColor Yellow
    Write-Host "You are shipping unverified work. Regressions will be found late." -ForegroundColor Yellow
    Write-Host ("Checklist: {0}" -f $script:QaGateDocPath) -ForegroundColor Yellow
    Write-Host "The counter is NOT reset by a bypass; the gate will fire again next launch." -ForegroundColor Yellow
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Yellow
    Write-Host ""
    return
  }
  throw (Get-YanshaQaGateStopMessage -RepoRoot $root -Phase $Phase)
}

function Complete-YanshaQaSignoff {
  param(
    [string]$RepoRoot,
    [string]$Notes = "",
    [ValidateSet("pass", "issues")]
    [string]$Verdict = "pass",
    [switch]$Force
  )
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $state = Read-YanshaQaGate $root
  if ([int]$state.closedSinceLastQa -eq 0 -and -not $Force) {
    Write-Host '[qa-gate] Nothing recorded since the last sign-off. Recording this pass anyway is fine with -Force.'
    return $state
  }
  if (-not $Notes) {
    throw 'Sign-off requires -Notes. Say what broke, what regressed, and what felt good.'
  }
  $pending = @()
  if ($state.pendingBeadIds) { $pending = @($state.pendingBeadIds) }
  $entry = [pscustomobject]([ordered]@{
    at        = (Get-Date).ToUniversalTime().ToString("o")
    beadCount = [int]$state.closedSinceLastQa
    beadIds   = $pending
    verdict   = $Verdict
    notes     = $Notes
  })
  $history = @()
  if ($state.history) { $history = @($state.history) }
  $history += $entry
  $state | Add-Member -NotePropertyName history -NotePropertyValue $history -Force
  $state | Add-Member -NotePropertyName lastQaAt -NotePropertyValue $entry.at -Force
  $state.closedSinceLastQa = 0
  $state | Add-Member -NotePropertyName pendingBeadIds -NotePropertyValue @() -Force
  Write-YanshaQaGate $root $state
  Write-Host ("[qa-gate] Manual QA signed off ({0}) covering {1} bead(s). Counter reset to 0 of {2}." -f $Verdict, $entry.beadCount, $state.threshold)
  if ($Verdict -eq "issues") {
    Write-Host '[qa-gate] Verdict=issues: file the regressions as new Beads before queueing more work.' -ForegroundColor Yellow
  }
  return $state
}

function Reset-YanshaQaGate {
  param([string]$RepoRoot, [switch]$KeepHistory)
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $policy = Get-YanshaQaGatePolicy $root
  $state = New-YanshaQaGateState -Threshold $policy.threshold
  if ($KeepHistory) {
    $old = Read-YanshaQaGate $root
    if ($old.history) { $state | Add-Member -NotePropertyName history -NotePropertyValue @($old.history) -Force }
    if ($old.lastQaAt) { $state | Add-Member -NotePropertyName lastQaAt -NotePropertyValue $old.lastQaAt -Force }
  }
  Write-YanshaQaGate $root $state
  Write-Host '[qa-gate] state reset to a clean zeroed counter.'
  return $state
}

function Show-YanshaQaGate {
  param([string]$RepoRoot)
  $root = Get-YanshaQaRepoRoot $RepoRoot
  $policy = Get-YanshaQaGatePolicy $root
  $state = Read-YanshaQaGate $root
  Write-Host "=== Manual QA gate (human hands-on pass) ===" -ForegroundColor Cyan
  if (-not $policy.enabled) {
    Write-Host '  DISABLED by policy/env. No manual QA is enforced.'
  }
  Write-Host ("  {0} of {1} beads since last manual QA" -f $state.closedSinceLastQa, $state.threshold)
  if ($state.lastQaAt) {
    Write-Host ("  Last manual QA: {0} UTC" -f $state.lastQaAt)
  } else {
    Write-Host "  Last manual QA: (never)"
  }
  $pending = @()
  if ($state.pendingBeadIds) { $pending = @($state.pendingBeadIds) }
  if ($pending.Count -gt 0) {
    Write-Host ("  Awaiting QA: {0}" -f ($pending -join ", "))
  }
  if (Test-YanshaQaGateDue $root) {
    Write-Host "  DUE: new PLAN/BUILD launches are blocked until sign-off." -ForegroundColor Yellow
    Write-Host ('  Sign off with: .\scripts\yansha-orch.ps1 qa signoff -Notes "..."') -ForegroundColor Yellow
  }
  Write-Host ("  Checklist: {0}" -f $script:QaGateDocPath)
  $hist = @()
  if ($state.history) { $hist = @($state.history) }
  if ($hist.Count -gt 0) {
    Write-Host "  Recent QA sessions:"
    $hist | Select-Object -Last 3 | ForEach-Object {
      Write-Host ("    {0} [{1}] {2} bead(s): {3}" -f $_.at, $_.verdict, $_.beadCount, $_.notes)
    }
  }
}

if ($QaCommand) {
  $qaRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  switch ($QaCommand) {
    "status" { Show-YanshaQaGate -RepoRoot $qaRoot }
    "record" { Record-YanshaBeadClosure -RepoRoot $qaRoot -BeadId $QaBeadId | Out-Null }
    "check" {
      if (Test-YanshaQaGateDue $qaRoot) {
        Write-Host "DUE"
        exit 1
      }
      Write-Host "OK"
      exit 0
    }
    "assert" { Assert-YanshaQaGateClear -RepoRoot $qaRoot -Phase "build" }
    "signoff" { Complete-YanshaQaSignoff -RepoRoot $qaRoot -Notes $QaNotes -Verdict $QaVerdict -Force:$QaForce | Out-Null }
    "reset" { Reset-YanshaQaGate -RepoRoot $qaRoot -KeepHistory:(-not $QaForce) | Out-Null }
  }
}

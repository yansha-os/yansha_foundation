#Requires -Version 5.1
<#
.SYNOPSIS
  Thin orchestra wrapper for Yansha (any IDE head via /harness_head, or terminal).

.DESCRIPTION
  Shortcuts over scripts/run-bead-agent.ps1 + harness status:

    .\scripts\yansha-orch.ps1 status
    .\scripts\yansha-orch.ps1 plan [-PlanTopic "..."] [-BeadId id] [-DryRun]
    .\scripts\yansha-orch.ps1 build [-FromReady] [-BeadId id] [-Agent auto] [-Claim] [-DryRun]
    .\scripts\yansha-orch.ps1 review -BeadId <id> [-FromReady] [-DryRun]
    .\scripts\yansha-orch.ps1 qa status
    .\scripts\yansha-orch.ps1 qa record -BeadId <id>     # run right after each bd close
    .\scripts\yansha-orch.ps1 qa signoff -Notes "..." [-Verdict pass|issues]
    .\scripts\yansha-orch.ps1 qa reset [-Force]

  Never closes Beads. Codex REVIEW pass is required before close (sacred hold without Codex).

.PARAMETER Command
  status | plan | build | review | qa

.PARAMETER SubCommand
  For qa: status | record | check | signoff | reset

.PARAMETER Notes
  Free-text manual QA notes (what broke, what regressed, what felt good).

.PARAMETER Verdict
  Manual QA verdict: pass | issues

.PARAMETER SkipQaGate
  Bypass the manual QA gate for this plan/build launch (loud warning).

.PARAMETER BeadId
  Bead ID for build/review (optional context for plan).

.PARAMETER Agent
  BUILD worker: auto | codex | antigravity | freebuff | cursor-local | operator

.PARAMETER PlanTopic
  Topic for PLAN phase.

.PARAMETER FromReady
  Pick first ready Bead.

.PARAMETER Claim
  Claim Bead before BUILD.

.PARAMETER DryRun
  Print route/prompt only.

.PARAMETER BypassBudget
  Deprecated no-op kept for backward compatibility (no local daily caps exist).

.PARAMETER EmergencyOverride
  Pass through to launcher (disabled workers / codex-build gate).
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [ValidateSet("status", "plan", "build", "review", "qa")]
  [string]$Command,
  [Parameter(Position = 1)]
  [ValidateSet("", "status", "record", "check", "signoff", "reset")]
  [string]$SubCommand = "",
  [string]$Notes = "",
  [ValidateSet("pass", "issues")]
  [string]$Verdict = "pass",
  [switch]$Force,
  [switch]$SkipQaGate,
  [string]$BeadId,
  [ValidateSet("auto", "codex", "antigravity", "freebuff", "cursor-local", "operator")]
  [string]$Agent = "auto",
  [string]$PlanTopic = "",
  [switch]$FromReady,
  [switch]$Claim,
  [switch]$DryRun,
  [switch]$BypassBudget,
  [switch]$EmergencyOverride
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot
$Launcher = Join-Path $PSScriptRoot "run-bead-agent.ps1"
. (Join-Path $PSScriptRoot "usage-budget.ps1")
. (Join-Path $PSScriptRoot "qa-gate.ps1")
if ($BypassBudget) {
  Write-Host '[usage] local soft caps removed; -BypassBudget is a no-op. Vendor quota locks still apply.'
}

function Show-HarnessStatus {
  $path = Join-Path $RepoRoot ".agents\harness.json"
  Write-Host "=== harness (.agents/harness.json) ===" -ForegroundColor Cyan
  if (-not (Test-Path $path)) {
    Write-Host "  MISSING harness.json"
    return
  }
  $h = Get-Content -Raw -Path $path | ConvertFrom-Json
  Write-Host "  Control: activate /harness_head in any IDE chat; /harness_off to release; new chats default OFF"
  Write-Host ("  Skill: {0}" -f $h.phases.control.skill)
  Write-Host "  Terminal harness is enough without a chat head."
  Write-Host ""
  Write-Host "  Workers:"
  foreach ($prop in $h.workers.PSObject.Properties) {
    $name = $prop.Name
    $w = $prop.Value
    $en = if ($w.enabled) { "on" } else { "OFF" }
    $lock = $null
    if ($name -in @("codex", "antigravity", "freebuff")) {
      $lock = Get-ActiveQuotaLock -RepoRoot $RepoRoot -Worker $name
    }
    $lockNote = if ($lock) { " LOCKED($($lock.kind))" } else { "" }
    $roles = if ($w.roles) { ($w.roles -join ",") } else { "-" }
    Write-Host ("    {0}: {1} roles=[{2}]{3}" -f $name, $en, $roles, $lockNote)
  }
  Write-Host ""
  Write-Host ("  PLAN chain:   {0}" -f ($h.phases.plan.chain -join " -> "))
  Write-Host ("  PLAN models:  codex={0}; agy={1}" -f $h.phases.plan.models.codex, $h.phases.plan.models.antigravity)
  Write-Host ("  REVIEW chain: {0}" -f ($h.phases.review.chain -join " -> "))
  Write-Host ("  BUILD cheap:  {0}" -f ($h.phases.build.cheapChain -join " -> "))
  Write-Host ("  BUILD heavy:  {0}" -f ($h.phases.build.heavyChain -join " -> "))
  Write-Host ("  BUILD hard:   {0}" -f ($h.phases.build.hardChain -join " -> "))
  Write-Host ("  BUILD agy model: {0} (hard={1})" -f $h.phases.build.models.antigravity, $h.phases.build.models.antigravityHard)
  Write-Host ("  Sacred hold without: {0}" -f $h.policy.sacredHoldWithout)
  Write-Host ("  Codex BUILD requires label: {0}" -f $h.policy.codexBuildRequiresLabel)
}

function Show-Status {
  Show-HarnessStatus
  Write-Host ""
  Write-Host "=== bd ready ===" -ForegroundColor Cyan
  & bd ready 2>&1
  Write-Host ""
  Write-Host "=== bd list --status=in_progress ===" -ForegroundColor Cyan
  & bd list --status=in_progress 2>&1
  Write-Host ""
  Show-YanshaUsage $RepoRoot
  Write-Host ""
  Show-YanshaQaGate -RepoRoot $RepoRoot
  Write-Host ""
  Write-Host "=== recent .agents/runs (last 8) ===" -ForegroundColor Cyan
  $runDir = Join-Path $RepoRoot ".agents\runs"
  if (-not (Test-Path $runDir)) {
    Write-Host "(no runs yet)"
    return
  }
  Get-ChildItem $runDir -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 8 |
    ForEach-Object {
      "{0:u}  {1}" -f $_.LastWriteTime.ToUniversalTime(), $_.Name
    }
}

switch ($Command) {
  "status" {
    Show-Status
    exit 0
  }
  "qa" {
    $sub = if ($SubCommand) { $SubCommand } else { "status" }
    switch ($sub) {
      "status" { Show-YanshaQaGate -RepoRoot $RepoRoot }
      "record" { Record-YanshaBeadClosure -RepoRoot $RepoRoot -BeadId $BeadId | Out-Null }
      "check" {
        if (Test-YanshaQaGateDue $RepoRoot) {
          Write-Host "DUE"
          exit 1
        }
        Write-Host "OK"
      }
      "signoff" { Complete-YanshaQaSignoff -RepoRoot $RepoRoot -Notes $Notes -Verdict $Verdict -Force:$Force | Out-Null }
      "reset" { Reset-YanshaQaGate -RepoRoot $RepoRoot -KeepHistory:(-not $Force) | Out-Null }
    }
    exit 0
  }
  "plan" {
    $launchArgs = @{
      Phase = "plan"
      SkipQaGate = $SkipQaGate
      DryRun = $DryRun
      BypassBudget = $BypassBudget
      EmergencyOverride = $EmergencyOverride
    }
    if ($PlanTopic) { $launchArgs.PlanTopic = $PlanTopic }
    if ($BeadId) { $launchArgs.BeadId = $BeadId }
    if ($Agent -ne "auto") { $launchArgs.Agent = $Agent }
    & $Launcher @launchArgs
    exit $LASTEXITCODE
  }
  "build" {
    if (-not $FromReady -and -not $BeadId) { $FromReady = $true }
    $launchArgs = @{
      Phase = "build"
      Agent = $Agent
      SkipQaGate = $SkipQaGate
      FromReady = $FromReady
      Claim = $Claim
      DryRun = $DryRun
      BypassBudget = $BypassBudget
      EmergencyOverride = $EmergencyOverride
    }
    if ($BeadId) { $launchArgs.BeadId = $BeadId; $launchArgs.FromReady = $false }
    & $Launcher @launchArgs
    exit $LASTEXITCODE
  }
  "review" {
    if (-not $FromReady -and -not $BeadId) {
      throw "review requires -BeadId or -FromReady"
    }
    $launchArgs = @{
      Phase = "review"
      FromReady = $FromReady
      DryRun = $DryRun
      BypassBudget = $BypassBudget
      EmergencyOverride = $EmergencyOverride
    }
    if ($BeadId) { $launchArgs.BeadId = $BeadId }
    if ($Agent -ne "auto") { $launchArgs.Agent = $Agent }
    & $Launcher @launchArgs
    exit $LASTEXITCODE
  }
}

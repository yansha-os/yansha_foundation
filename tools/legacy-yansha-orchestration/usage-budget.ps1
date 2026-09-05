#Requires -Version 5.1
<#
.SYNOPSIS
  Launch telemetry + vendor quota locks for Codex / Antigravity / Freebuff.

.DESCRIPTION
  Policy (current):
  - There are NO local daily caps. Local launch counts are informational only
    and never block a worker.
  - The ONLY thing that may stop a worker is a REAL vendor signal parsed from
    CLI output: 5-hour rolling window exhausted, weekly/monthly/plan quota
    exhausted, or a paid-credits / overage prompt.
  - NEVER purchase credits / enable overages / switch to pay-per-token API.
  - Prefer Cursor + Freebuff for cheap work; Codex for PLAN+REVIEW only;
    Antigravity sparingly.

  State files (gitignored under .agents/runs/):
    daily-usage.json   - informational launch counts + history (no enforcement)
    quota-locks.json   - hard locks when the vendor says quota exhausted
#>

function Get-YanshaRunsDir {
  param([string]$RepoRoot)
  $dir = Join-Path $RepoRoot ".agents\runs"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Get-YanshaUsagePath {
  param([string]$RepoRoot)
  return (Join-Path (Get-YanshaRunsDir $RepoRoot) "daily-usage.json")
}

function Get-YanshaQuotaLockPath {
  param([string]$RepoRoot)
  return (Join-Path (Get-YanshaRunsDir $RepoRoot) "quota-locks.json")
}

function Read-YanshaUsage {
  param([string]$RepoRoot)
  $path = Get-YanshaUsagePath $RepoRoot
  $today = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
  $empty = [ordered]@{
    date        = $today
    codex       = 0
    antigravity = 0
    freebuff    = 0
    launches    = @()
  }
  if (-not (Test-Path $path)) { return [pscustomobject]$empty }
  try { $raw = Get-Content -Raw -Path $path | ConvertFrom-Json } catch { return [pscustomobject]$empty }
  if (-not $raw.date -or $raw.date -ne $today) { return [pscustomobject]$empty }
  return $raw
}

function Write-YanshaUsage {
  param([string]$RepoRoot, $Usage)
  ($Usage | ConvertTo-Json -Depth 6) | Set-Content -Path (Get-YanshaUsagePath $RepoRoot) -Encoding UTF8
}

function Read-YanshaQuotaLocks {
  param([string]$RepoRoot)
  $path = Get-YanshaQuotaLockPath $RepoRoot
  if (-not (Test-Path $path)) {
    return [pscustomobject]@{ workers = [pscustomobject]@{} }
  }
  try {
    return (Get-Content -Raw -Path $path | ConvertFrom-Json)
  } catch {
    return [pscustomobject]@{ workers = [pscustomobject]@{} }
  }
}

function Write-YanshaQuotaLocks {
  param([string]$RepoRoot, $Locks)
  ($Locks | ConvertTo-Json -Depth 8) | Set-Content -Path (Get-YanshaQuotaLockPath $RepoRoot) -Encoding UTF8
}

function Get-UsageCount {
  param($Usage, [string]$Worker)
  switch ($Worker) {
    "codex" { return [int]$Usage.codex }
    "antigravity" { return [int]$Usage.antigravity }
    "freebuff" { return [int]$Usage.freebuff }
    default { return 0 }
  }
}

function Set-UsageCount {
  param($Usage, [string]$Worker, [int]$Value)
  switch ($Worker) {
    "codex" { $Usage.codex = $Value }
    "antigravity" { $Usage.antigravity = $Value }
    "freebuff" { $Usage.freebuff = $Value }
  }
}

function Classify-QuotaExhaustionText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
  $t = $Text

  # Antigravity / Gemini
  if ($t -match '(?i)RESOURCE_EXHAUSTED|Individual quota reached|quota.?exhausted|AI credits?|credit overage') {
    if ($t -match '(?i)week|7.?day|monthly|month') {
      return [pscustomobject]@{ Kind = "plan"; Hours = 168; Summary = "Antigravity plan/weekly quota exhausted" }
    }
    return [pscustomobject]@{ Kind = "five_hour"; Hours = 5; Summary = "Antigravity short-window quota exhausted" }
  }

  # Codex ChatGPT subscription
  if ($t -match "(?i)you('ve| have) hit your usage limit|usage limit reached|reached your weekly limit|weekly limit") {
    if ($t -match '(?i)weekly|week') {
      return [pscustomobject]@{ Kind = "plan"; Hours = 168; Summary = "Codex weekly/plan quota exhausted" }
    }
    # "try again at ..." is usually the 5h window
    return [pscustomobject]@{ Kind = "five_hour"; Hours = 5; Summary = "Codex 5-hour usage window exhausted" }
  }

  # Vendor credit-purchase nudges only — do not match our own policy text ("Never buy credits").
  if ($t -match '(?i)purchase more credits|buy credits to (continue|keep)|enable (AI )?credit overage|insufficient_quota|flexible.?usage.?credits') {
    return [pscustomobject]@{ Kind = "credits"; Hours = 24; Summary = "Paid credits / overage path detected - blocked by policy" }
  }

  if ($t -match '(?i)429 Too Many Requests' -and $t -match '(?i)codex|openai|rate.?limit') {
    return [pscustomobject]@{ Kind = "five_hour"; Hours = 1; Summary = "Provider rate limit (429)" }
  }

  return $null
}

function Set-YanshaQuotaLock {
  param(
    [string]$RepoRoot,
    [string]$Worker,
    [string]$Kind,
    [double]$Hours,
    [string]$Summary,
    [string]$Snippet = ""
  )
  $locks = Read-YanshaQuotaLocks $RepoRoot
  if (-not $locks.workers) {
    $locks = [pscustomobject]@{ workers = [pscustomobject]@{} }
  }
  $until = (Get-Date).ToUniversalTime().AddHours($Hours).ToString("o")
  $entry = [pscustomobject]@{
    kind       = $Kind
    summary    = $Summary
    lockedAt   = (Get-Date).ToUniversalTime().ToString("o")
    lockedUntil = $until
    snippet    = if ($Snippet.Length -gt 400) { $Snippet.Substring(0, 400) } else { $Snippet }
    policy     = "Do not launch this worker. Do not buy credits / enable overages. Prefer Cursor+Freebuff until lock expires."
  }

  # Convert workers to hashtable-like via JSON roundtrip for dynamic property set
  $map = @{}
  if ($locks.workers) {
    $locks.workers.PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value }
  }
  $map[$Worker] = $entry
  $workersObj = [pscustomobject]$map
  $out = [pscustomobject]@{ workers = $workersObj }
  Write-YanshaQuotaLocks $RepoRoot $out

  Write-Host ""
  Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Yellow
  Write-Host ("QUOTA STOP: {0}" -f $Summary) -ForegroundColor Yellow
  Write-Host ("Worker '{0}' locked until {1} UTC (kind={2})." -f $Worker, $until, $Kind) -ForegroundColor Yellow
  Write-Host "I will NOT keep calling this CLI or buy credits / overages." -ForegroundColor Yellow
  Write-Host "Use Cursor + Freebuff for cheap work, or wait for the window/plan to reset." -ForegroundColor Yellow
  Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Yellow
  Write-Host ""
}

function Get-ActiveQuotaLock {
  param([string]$RepoRoot, [string]$Worker)
  $locks = Read-YanshaQuotaLocks $RepoRoot
  if (-not $locks.workers) { return $null }
  $prop = $locks.workers.PSObject.Properties[$Worker]
  if (-not $prop) { return $null }
  $entry = $prop.Value
  if (-not $entry.lockedUntil) { return $null }
  $until = [datetime]::Parse($entry.lockedUntil, $null, [System.Globalization.DateTimeStyles]::RoundtripKind)
  $now = (Get-Date).ToUniversalTime()
  if ($now -ge $until.ToUniversalTime()) { return $null }
  return $entry
}

function Assert-YanshaQuotaNotLocked {
  param(
    [string]$RepoRoot,
    [string]$Worker,
    [switch]$DryRun
  )
  if ($DryRun -or $Worker -eq "cursor-local") { return }
  $lock = Get-ActiveQuotaLock -RepoRoot $RepoRoot -Worker $Worker
  if (-not $lock) { return }
  $msg = 'HARD STOP: {0} is quota-locked until {1} UTC ({2}). {3} Policy: do not buy credits or enable overages. Prefer Cursor+Freebuff.'
  throw ($msg -f $Worker, $lock.lockedUntil, $lock.kind, $lock.summary)
}

function Test-AndLockQuotaFromText {
  param(
    [string]$RepoRoot,
    [string]$Worker,
    [string]$Text
  )
  $hit = Classify-QuotaExhaustionText -Text $Text
  if (-not $hit) { return $false }
  Set-YanshaQuotaLock -RepoRoot $RepoRoot -Worker $Worker -Kind $hit.Kind -Hours $hit.Hours -Summary $hit.Summary -Snippet $Text
  return $true
}

function Show-YanshaUsage {
  param([string]$RepoRoot)
  $usage = Read-YanshaUsage $RepoRoot
  Write-Host ("=== CLI launch counts today (UTC {0}) - informational only ===" -f $usage.date) -ForegroundColor Cyan
  Write-Host ("  Codex launches today:       {0} (no local cap; PLAN+REVIEW only)" -f $usage.codex)
  Write-Host ("  Antigravity launches today: {0} (no local cap; use sparingly)" -f $usage.antigravity)
  Write-Host ("  Freebuff launches today:    {0} (no local cap; preferred cheap builder)" -f $usage.freebuff)
  Write-Host '  No local daily caps. Only vendor quota locks below can stop a worker.'
  Write-Host ""
  Write-Host "=== Vendor quota locks (hard) ===" -ForegroundColor Cyan
  $any = $false
  foreach ($w in @("codex", "antigravity", "freebuff")) {
    $lock = Get-ActiveQuotaLock -RepoRoot $RepoRoot -Worker $w
    if ($lock) {
      $any = $true
      Write-Host ("  LOCKED {0}: {1} until {2} UTC [{3}]" -f $w, $lock.summary, $lock.lockedUntil, $lock.kind) -ForegroundColor Yellow
    }
  }
  if (-not $any) { Write-Host "  (none active)" }
  Write-Host "  Policy: never purchase credits / enable overages from the orchestra."
}

function Assert-YanshaUsageBudget {
  param(
    [string]$RepoRoot,
    [ValidateSet("codex", "antigravity", "freebuff", "cursor-local")]
    [string]$Worker,
    [switch]$DryRun
  )
  if ($DryRun -or $Worker -eq "cursor-local") { return }

  # Only real vendor quota locks can block a launch. No local daily caps.
  Assert-YanshaQuotaNotLocked -RepoRoot $RepoRoot -Worker $Worker -DryRun:$DryRun

  $usage = Read-YanshaUsage $RepoRoot
  $used = Get-UsageCount -Usage $usage -Worker $Worker
  Write-Host ("[usage] {0}: {1} launches today before this one (informational; no local cap)" -f $Worker, $used)
}

function Record-YanshaUsage {
  param(
    [string]$RepoRoot,
    [ValidateSet("codex", "antigravity", "freebuff", "cursor-local")]
    [string]$Worker,
    [string]$Phase,
    [string]$BeadId = "",
    [switch]$DryRun
  )
  if ($DryRun -or $Worker -eq "cursor-local") { return }
  $usage = Read-YanshaUsage $RepoRoot
  $next = (Get-UsageCount -Usage $usage -Worker $Worker) + 1
  Set-UsageCount -Usage $usage -Worker $Worker -Value $next
  $entry = [pscustomobject]@{
    at     = (Get-Date).ToUniversalTime().ToString("o")
    worker = $Worker
    phase  = $Phase
    bead   = $BeadId
  }
  $list = @()
  if ($usage.launches) { $list = @($usage.launches) }
  $list += $entry
  $usage | Add-Member -NotePropertyName launches -NotePropertyValue $list -Force
  Write-YanshaUsage $RepoRoot $usage
  Write-Host ("[usage] recorded {0} launch #{1} today (telemetry only)" -f $Worker, $next)
}

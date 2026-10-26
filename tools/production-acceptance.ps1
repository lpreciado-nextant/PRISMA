param(
    [ValidateSet('Inspect', 'Create', 'Cleanup')]
    [string]$Phase = 'Inspect',
    [switch]$KeepUploadsEnabled
)

$ErrorActionPreference = 'Stop'
$org = 'https://org08fa4839.crm.dynamics.com'
$statePath = Join-Path $env:TEMP 'PRISMA-production-acceptance-20261026.json'
$label = '[PRISMA TEST] Production acceptance 2026-10-26'
$token = az account get-access-token --resource $org --query accessToken --output tsv
if ($LASTEXITCODE -ne 0) { throw 'Production authentication failed.' }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json' }

function Read-Data([string]$Path) { Invoke-RestMethod -Headers $headers -Uri "$org/api/data/v9.2/$Path" }
function Call-Api([string]$Name, [hashtable]$Body) {
    $result = Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' -Uri "$org/api/data/v9.2/$Name" -Body ([Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20 -Compress)))
    if (-not $result.ResultJson) { throw "Missing API confirmation: $Name." }
    if ($result.ResultJson.Contains('blob.core.windows.net') -or $result.ResultJson.Contains('nx_blobname')) { throw 'Storage reference escaped the API.' }
    return $result.ResultJson | ConvertFrom-Json -Depth 50
}
function Save-State { [IO.File]::WriteAllText($statePath, ($script:state | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false)) }
function Parent-Version {
    $row = Read-Data "nx_solutions($($script:state.id))?`$select=nx_solutionname,_ownerid_value"
    if ($row.nx_solutionname -cne $label -or $row._ownerid_value -ne $script:who.UserId) { throw 'Refusing an unrelated solution.' }
    if ($row.'@odata.etag' -notmatch '^W/"(\d+)"$') { throw 'Missing parent row version.' }
    return $Matches[1]
}
function Transition([string]$Action, [string]$Comments = '', [bool]$Cleared = $false) {
    Call-Api 'nx_TransitionSubmission' @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); Action = $Action; Comments = $Comments; Cleared = $Cleared }
}
function Upload-Setting([string]$Value) {
    $definition = @( (Read-Data "environmentvariabledefinitions?`$select=environmentvariabledefinitionid&`$filter=schemaname eq 'nx_MediaBlobUploads'").value )
    if ($definition.Count -ne 1) { throw 'Upload setting definition is ambiguous.' }
    $values = @( (Read-Data "environmentvariablevalues?`$select=environmentvariablevalueid,value&`$filter=_environmentvariabledefinitionid_value eq $($definition[0].environmentvariabledefinitionid)").value )
    if ($values.Count -ne 1) { throw 'Upload setting value is ambiguous.' }
    if ($Value -and $values[0].value -ne $Value) {
        $writeHeaders = $headers.Clone()
        $writeHeaders['If-Match'] = $values[0].'@odata.etag'
        Invoke-RestMethod -Method Patch -Headers $writeHeaders -ContentType 'application/json' -Uri "$org/api/data/v9.2/environmentvariablevalues($($values[0].environmentvariablevalueid))" -Body (@{ value = $Value } | ConvertTo-Json) | Out-Null
        $readback = Read-Data "environmentvariablevalues($($values[0].environmentvariablevalueid))?`$select=value"
        if ($readback.value -ne $Value) { throw 'Upload setting readback mismatch.' }
    }
    return $values[0].value
}
function Expect-Rejection([string]$Name, [hashtable]$Body) {
    try { Call-Api $Name $Body | Out-Null } catch {
        if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -notin @(400, 403, 404)) { throw }
        Write-Host "PASS expected denial: $Name."
        return
    }
    throw "Expected rejection did not occur: $Name."
}
function Read-Media($Item, [string]$Mode) {
    $hash = [Security.Cryptography.IncrementalHash]::CreateHash([Security.Cryptography.HashAlgorithmName]::SHA256)
    $offset = 0
    $version = ''
    try {
        while ($offset -lt $Item.size) {
            $range = Call-Api 'nx_ReadVideoRange' @{ SolutionId = $script:state.id; AssetId = $Item.id; Mode = $Mode; Offset = $offset; Count = [Math]::Min(8388608, $Item.size - $offset); Version = $version }
            if (-not $version) { $version = $range.version }
            if ($range.version -ne $version -or $range.offset -ne $offset) { throw 'Media range identity changed.' }
            $bytes = [Convert]::FromBase64String($range.content)
            if (-not $bytes.Length -or $offset + $bytes.Length -gt $Item.size) { throw 'Invalid range length.' }
            $hash.AppendData($bytes)
            $offset += $bytes.Length
        }
        if ([Convert]::ToHexString($hash.GetHashAndReset()) -ne $Item.sha256) { throw "Media checksum mismatch: $($Item.name)." }
        Write-Host "PASS $Mode media checksum: $($Item.name), $offset bytes."
    } finally { $hash.Dispose() }
}
function Upload-Media([string]$Name, [byte[]]$Bytes, [string]$Kind, [switch]$Resumable) {
    $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes))
    $body = @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); FileName = $Name; Size = $Bytes.Length }
    if ($Resumable) {
        $body.Sha256 = $digest.ToLowerInvariant()
        $body.BlockSize = 16777216
        $begin = Call-Api 'nx_BeginResumableUpload' $body
    } else {
        $body.Kind = if ($Kind -eq 'attachment') { 'attachment:v5' } else { $Kind }
        $begin = Call-Api 'nx_BeginMediaUpload' $body
    }
    $session = $begin.sessionId
    $item = @($begin.media | Where-Object sessionId -eq $session)
    if ($item.Count -ne 1) { throw 'Upload session snapshot missing.' }
    if ($Kind -eq 'attachment' -and $item[0].storage -ne 'blob') { throw 'Attachment did not select production Blob storage.' }
    $blockSize = [int]$begin.blockSize
    if ($blockSize -le 0 -or $blockSize -gt 16777216) { throw 'Unexpected upload block size.' }
    $index = 0
    for ($offset = 0; $offset -lt $Bytes.Length; $offset += $blockSize) {
        $length = [Math]::Min($blockSize, $Bytes.Length - $offset)
        $content = [Convert]::ToBase64String($Bytes, $offset, $length)
        Call-Api 'nx_UploadMediaBlock' @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); SessionId = $session; BlockIndex = $index; Content = $content } | Out-Null
        $index++
        if ($Resumable -and $index -eq 1) {
            $checkpoint = Call-Api 'nx_GetUploadCheckpoint' @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); SessionId = $session; FileName = $Name; Size = $Bytes.Length; Sha256 = $digest.ToLowerInvariant() }
            if (@($checkpoint.media | Where-Object sessionId -eq $session)[0].received -ne $length) { throw 'Resume checkpoint mismatch.' }
            Expect-Rejection 'nx_GetUploadCheckpoint' @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); SessionId = $session; FileName = $Name; Size = $Bytes.Length; Sha256 = ('0' * 64) }
        }
    }
    Call-Api 'nx_FinishMediaUpload' @{ SolutionId = $script:state.id; ExpectedRowVersion = (Parent-Version); SessionId = $session } | Out-Null
    $saved = [ordered]@{ id = $item[0].id; session = $session; name = $Name; kind = $Kind; size = $Bytes.Length; sha256 = $digest }
    $script:state.media += $saved
    Save-State
    Read-Media $saved $(if ($Kind -eq 'image') { 'image' } else { 'submission' })
    if ($Kind -eq 'attachment') {
        Expect-Rejection 'nx_ReadVideoRange' @{ SolutionId = $script:state.id; AssetId = $saved.id; Mode = 'present'; Offset = 0; Count = 1; Version = '' }
        Expect-Rejection 'nx_ReadVideoRange' @{ SolutionId = $script:state.id; AssetId = $saved.id; Mode = 'submission'; Offset = 0; Count = 1; Version = 'stale' }
    }
}

$script:who = Read-Data 'WhoAmI'
if ($who.OrganizationId -ne 'b3aa4d34-8957-f011-8ee3-7c1e52172903') { throw 'Unexpected production organization.' }
$user = Read-Data "systemusers($($who.UserId))?`$select=internalemailaddress"
if ($user.internalemailaddress -ine 'lpreciado@nextant.com') { throw 'Only the approved Luis test identity may run this script.' }
$containerDefinition = @( (Read-Data "environmentvariabledefinitions?`$select=environmentvariabledefinitionid&`$filter=schemaname eq 'nx_MediaBlobContainerUrl'").value )
if ($containerDefinition.Count -ne 1) { throw 'Container setting missing.' }
$containerValues = @( (Read-Data "environmentvariablevalues?`$select=value&`$filter=_environmentvariabledefinitionid_value eq $($containerDefinition[0].environmentvariabledefinitionid)").value )
if ($containerValues.Count -ne 1 -or $containerValues[0].value -ne 'https://stprismamediaiwguqp7gvh.blob.core.windows.net/media-prod') { throw 'Refusing unexpected storage target.' }
$queue = Call-Api 'nx_GetSubmissions' @{ ReviewQueue = $true; PageNumber = 1 }
Write-Host "Verified production identity and reviewer access; Blob uploads: $(Upload-Setting '')."
if ($Phase -eq 'Inspect') { return }

if ($Phase -eq 'Cleanup') {
    $script:state = Get-Content -Raw $statePath | ConvertFrom-Json -AsHashtable
    if ($state.label -cne $label -or $state.phase -ne 'published') { throw 'Unexpected fixture checkpoint.' }
    try {
        Transition 'withdraw' | Out-Null
        Expect-Rejection 'nx_GetPublishedDetail' @{ SolutionId = $state.id; Present = $true }
        foreach ($item in $state.media | Where-Object kind -eq 'attachment') {
            Expect-Rejection 'nx_ReadVideoRange' @{ SolutionId = $state.id; AssetId = $item.id; Mode = 'present'; Offset = 0; Count = 1; Version = '' }
        }
        Transition 'delete' | Out-Null
        $state.phase = 'deleted'
        Save-State
        if (-not $KeepUploadsEnabled) { Upload-Setting 'no' | Out-Null }
        Write-Host "PASS withdrawal denies published reads and controlled fixture deletion; parent $($state.id). Verify asynchronous Blob deletion separately."
    } catch { Upload-Setting 'no' | Out-Null; throw }
    return
}

if (Test-Path $statePath) { throw "A fixture checkpoint already exists: $statePath. Inspect it rather than creating another fixture." }
$capability = @( (Read-Data "nx_capabilities?`$select=nx_capabilityid,_nx_specializationarea_value&`$filter=nx_capabilityname eq 'Analytics Consulting' and statecode eq 0").value )
$person = @( (Read-Data "cr6b0_consultants?`$select=cr6b0_consultantid&`$filter=cr6b0_email eq 'lpreciado@nextant.com' and statecode eq 0").value )
if ($capability.Count -ne 1 -or $person.Count -ne 1) { throw 'Test reference mapping is ambiguous.' }
$core = @{ name = $label; summary = 'Disposable synthetic production acceptance fixture.'; capabilityId = $capability[0].nx_capabilityid; maturity = 125060004; whatItDoes = 'Verifies controlled production media and review operations.'; businessValue = 'Confirms setup without copying business content.'; clientContext = 'INTERNAL-PROD-ACCEPTANCE-ONLY'; clientContextRedacted = 'Synthetic acceptance example.'; challenges = 'INTERNAL-PROD-ACCEPTANCE-ONLY'; lessonsLearned = ''; safetyAcknowledged = $false; complexityValue = 125060000; estimatedMinimumHours = 1 }
$script:state = [ordered]@{ label = $label; id = ''; phase = 'creating'; media = @() }
try {
    Upload-Setting 'yes' | Out-Null
    $draft = Call-Api 'nx_SaveCoreDraft' @{ DraftJson = ($core | ConvertTo-Json -Compress) }
    $state.id = $draft.id
    Save-State
    $graph = @{ contributors = @(@{ personId = $person[0].cr6b0_consultantid }); technologyIds = @(); industryIds = @(); projectIds = @(); areaIds = @($capability[0]._nx_specializationarea_value); clientRoleIds = @(); secondaryCapabilityIds = @() }
    Call-Api 'nx_SaveDraftGraph' @{ SolutionId = $state.id; ExpectedRowVersion = (Parent-Version); GraphJson = ($graph | ConvertTo-Json -Depth 5 -Compress) } | Out-Null
    Add-Type -AssemblyName System.Drawing
    $bitmap = [Drawing.Bitmap]::new(640, 360)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $stream = [IO.MemoryStream]::new()
    try {
        $graphics.Clear([Drawing.Color]::LightSteelBlue)
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        Upload-Media 'production-acceptance.png' $stream.ToArray() 'image'
    } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    $html = '<!doctype html><html lang="en"><meta charset="utf-8"><title>PRISMA production acceptance</title><h1>Production acceptance</h1><button onclick="document.getElementById(''result'').textContent=''Approved sample''">Approve sample</button><p id="result">Synthetic test only</p></html>'
    Upload-Media 'production-acceptance.html' ([Text.Encoding]::UTF8.GetBytes($html)) 'attachment'
    Upload-Media 'production-acceptance.pdf' ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '../test-data/documents/acceptance/acceptance.pdf'))) 'attachment'
    Upload-Media 'production-acceptance.mp4' ([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '../test-data/videos/synthetic/sample-50mb.mp4'))) 'attachment' -Resumable
    $core.safetyAcknowledged = $true
    Call-Api 'nx_SaveCoreDraft' @{ SolutionId = $state.id; ExpectedRowVersion = (Parent-Version); DraftJson = ($core | ConvertTo-Json -Compress) } | Out-Null
    Transition 'submit' | Out-Null
    Transition 'return' 'Synthetic acceptance: verify reviewer feedback and resubmission.' | Out-Null
    Call-Api 'nx_SaveCoreDraft' @{ SolutionId = $state.id; ExpectedRowVersion = (Parent-Version); DraftJson = ($core | ConvertTo-Json -Compress) } | Out-Null
    Transition 'submit' | Out-Null
    Transition 'approve' 'Synthetic fixture reviewed for production acceptance.' $true | Out-Null
    $present = Call-Api 'nx_GetPublishedDetail' @{ SolutionId = $state.id; Present = $true }
    if (($present | ConvertTo-Json -Depth 50 -Compress).Contains('INTERNAL-PROD-ACCEPTANCE-ONLY')) { throw 'Present-mode internal marker leaked.' }
    foreach ($item in $state.media | Where-Object kind -eq 'attachment') { Read-Media $item 'present' }
    $state.phase = 'published'
    Save-State
    Write-Host "PASS backend lifecycle and media integrity. Disposable published fixture $($state.id); checkpoint $statePath. Complete hosted checks, then Cleanup."
    $state.media | Format-Table name, id, size
} catch {
    Upload-Setting 'no' | Out-Null
    if ($state.id) {
        try { Transition 'delete' | Out-Null; $state.phase = 'deleted-after-failure'; Save-State } catch { Write-Warning "Fixture cleanup requires inspection: $($state.id). $($_.Exception.Message)" }
    }
    throw
}
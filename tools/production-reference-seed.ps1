param(
    [switch]$Execute,
    [string]$ExpectedPlanHash
)

$ErrorActionPreference = 'Stop'
$source = 'https://nextantpulse.crm.dynamics.com'
$target = 'https://org08fa4839.crm.dynamics.com'

function Connect-Organization([string]$Url, [string]$OrganizationId) {
    $token = az account get-access-token --resource $Url --query accessToken --output tsv
    if ($LASTEXITCODE -ne 0) { throw "Authentication failed for $Url." }
    $headers = @{ Authorization = "Bearer $token"; Accept = 'application/json' }
    $who = Invoke-RestMethod -Headers $headers -Uri "$Url/api/data/v9.2/WhoAmI"
    if ($who.OrganizationId -ne $OrganizationId) { throw "Unexpected organization at $Url." }
    return $headers
}

function Read-Rows([string]$Url, [hashtable]$Headers, [string]$Path) {
    $next = "$Url/api/data/v9.2/$Path"
    do {
        if (-not $next.StartsWith("$Url/api/data/", [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected paging origin.' }
        $page = Invoke-RestMethod -Headers $Headers -Uri $next
        $page.value
        $next = $page.'@odata.nextLink'
    } while ($next)
}

function Name-Key([string]$Name) {
    if ([string]::IsNullOrWhiteSpace($Name)) { throw 'Reference name is empty.' }
    return $Name.Trim().ToUpperInvariant()
}

function Name-Index($Rows, [string]$Field) {
    $index = @{}
    foreach ($row in $Rows) {
        $key = Name-Key $row.$Field
        if ($index.ContainsKey($key)) { throw "Duplicate reference name: $($row.$Field)." }
        $index[$key] = $row
    }
    return $index
}

$sourceHeaders = Connect-Organization $source 'cd98dcb3-db3b-f011-be51-00224820bb36'
$targetHeaders = Connect-Organization $target 'b3aa4d34-8957-f011-8ee3-7c1e52172903'
$release = @(Read-Rows $target $targetHeaders "solutions?`$select=uniquename,ismanaged&`$filter=uniquename eq 'PRISMA_Release'")
if ($release.Count -ne 1 -or -not $release[0].ismanaged) { throw 'Expected installed managed PRISMA_Release.' }

$definitions = @(
    @{ Set = 'nx_specializationareas'; Id = 'nx_specializationareaid'; Name = 'nx_specializationareaname'; Fields = @('nx_specializationareaname', 'nx_description', 'nx_sortordernumber') },
    @{ Set = 'nx_capabilities'; Id = 'nx_capabilityid'; Name = 'nx_capabilityname'; Fields = @('nx_capabilityname', 'nx_sortordernumber'); Lookups = @('_nx_specializationarea_value', '_nx_capabilityowner_value') },
    @{ Set = 'nx_industries'; Id = 'nx_industryid'; Name = 'nx_industryname'; Fields = @('nx_industryname', 'nx_sortordernumber') },
    @{ Set = 'nx_technologies'; Id = 'nx_technologyid'; Name = 'nx_technologyname'; Fields = @('nx_technologyname') },
    @{ Set = 'nx_clientroles'; Id = 'nx_clientroleid'; Name = 'nx_clientrolename'; Fields = @('nx_clientrolename') }
)
$peoplePath = 'cr6b0_consultants?$select=cr6b0_consultantid,cr6b0_email,statecode'
$sourcePeople = @(Read-Rows $source $sourceHeaders $peoplePath)
$targetPeople = @(Read-Rows $target $targetHeaders $peoplePath)
$areaMap = @{}
$plan = [System.Collections.Generic.List[object]]::new()
$checks = [System.Collections.Generic.List[object]]::new()
$originals = @{}

foreach ($definition in $definitions) {
    $columns = @($definition.Id, 'statecode') + $definition.Fields + @($definition.Lookups)
    $path = "$($definition.Set)?`$select=$($columns -join ',')"
    $sourceRows = @(Read-Rows $source $sourceHeaders $path)
    $targetRows = @(Read-Rows $target $targetHeaders $path)
    $sourceIndex = Name-Index $sourceRows $definition.Name
    $targetIndex = Name-Index $targetRows $definition.Name
    $originals[$definition.Set] = $targetRows
    $active = @($sourceIndex.Values | Where-Object statecode -eq 0 | Sort-Object { Name-Key $_.($definition.Name) })
    if ($active.Count -eq 0 -or $active.Count -gt 500) { throw "Unexpected source count for $($definition.Set)." }
    $added = 0
    foreach ($row in $active) {
        $name = $row.($definition.Name)
        $key = Name-Key $name
        $existing = $targetIndex[$key]
        if ($existing -and $existing.statecode -ne 0) { throw "Inactive production match: $name." }
        $id = if ($existing) { $existing.($definition.Id) } else { $row.($definition.Id) }
        if (-not $existing -and @($targetRows | Where-Object { $_.($definition.Id) -eq $id }).Count) { throw "Production ID collision: $name." }
        $body = [ordered]@{ $definition.Id = $id }
        $expected = [ordered]@{ $definition.Id = $id; statecode = 0 }
        foreach ($field in $definition.Fields) {
            $expected[$field] = $row.$field
            if ($null -ne $row.$field) { $body[$field] = $row.$field }
        }
        if ($definition.Set -eq 'nx_specializationareas') { $areaMap[$row.($definition.Id)] = $id }
        if ($definition.Set -eq 'nx_capabilities') {
            $areaId = $areaMap[$row._nx_specializationarea_value]
            if (-not $areaId) { throw "Capability has no mapped active area: $name." }
            $owner = @($sourcePeople | Where-Object { $_.cr6b0_consultantid -eq $row._nx_capabilityowner_value -and $_.statecode -eq 0 })
            if ($owner.Count -ne 1 -or [string]::IsNullOrWhiteSpace($owner[0].cr6b0_email)) { throw "Capability owner identity missing: $name." }
            $email = $owner[0].cr6b0_email.Trim()
            $matches = @($targetPeople | Where-Object { $_.statecode -eq 0 -and $_.cr6b0_email -and $_.cr6b0_email.Trim() -ieq $email })
            if ($matches.Count -ne 1) { throw "Capability owner mapping ambiguous or absent: $email." }
            $ownerId = $matches[0].cr6b0_consultantid
            $body['nx_SpecializationArea@odata.bind'] = "/nx_specializationareas($areaId)"
            $body['nx_CapabilityOwner@odata.bind'] = "/cr6b0_consultants($ownerId)"
            $expected['_nx_specializationarea_value'] = $areaId
            $expected['_nx_capabilityowner_value'] = $ownerId
        }
        if ($existing) {
            foreach ($field in $expected.Keys) {
                if ($existing.$field -cne $expected[$field]) { throw "Existing production reference differs: $name / $field. No overwrite permitted." }
            }
        } else {
            $plan.Add([ordered]@{ Set = $definition.Set; Name = $name; Body = $body })
            $added++
        }
        $checks.Add(@{ Definition = $definition; Expected = $expected; Name = $name })
    }
    Write-Host "$($definition.Set): $($active.Count) active source rows; $($targetRows.Count) existing target rows; $added creates."
}

$json = ConvertTo-Json -InputObject $plan.ToArray() -Depth 8 -Compress
$hash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($json)))
Write-Host "Plan SHA256: $hash"
Write-Host "Plan: $($plan.Count) creates in five reference tables; no updates, deletes, user assignments, Consultant/Project writes or solution content."
if (-not $Execute) { Write-Host 'Read-only preview. Execute requires -ExpectedPlanHash from this preview.'; return }
if ($ExpectedPlanHash -cne $hash) { throw 'Plan hash does not match the reviewed preview.' }

if ($plan.Count -gt 0) {
    $batchBoundary = 'batch_' + [Guid]::NewGuid().ToString('N')
    $changeBoundary = 'changeset_' + [Guid]::NewGuid().ToString('N')
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("--$batchBoundary")
    $lines.Add("Content-Type: multipart/mixed; boundary=$changeBoundary")
    $lines.Add('')
    $number = 0
    foreach ($item in $plan) {
        $number++
        $lines.Add("--$changeBoundary")
        $lines.Add('Content-Type: application/http')
        $lines.Add('Content-Transfer-Encoding: binary')
        $lines.Add("Content-ID: $number")
        $lines.Add('')
        $lines.Add("POST $target/api/data/v9.2/$($item.Set) HTTP/1.1")
        $lines.Add('Content-Type: application/json; charset=utf-8')
        $lines.Add('Accept: application/json')
        $lines.Add('Prefer: return=representation')
        $lines.Add('')
        $lines.Add(($item.Body | ConvertTo-Json -Depth 5 -Compress))
    }
    $lines.Add("--$changeBoundary--")
    $lines.Add("--$batchBoundary--")
    $lines.Add('')
    $response = Invoke-WebRequest -Method Post -Headers $targetHeaders -Uri "$target/api/data/v9.2/`$batch" -ContentType "multipart/mixed; boundary=$batchBoundary" -Body ([Text.Encoding]::UTF8.GetBytes(($lines -join "`r`n")))
    $responseText = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { [string]$response.Content }
    $statuses = [regex]::Matches($responseText, '(?m)^HTTP/1\.1 (\d{3})')
    if ($statuses.Count -ne $plan.Count -or @($statuses | Where-Object { $_.Groups[1].Value -ne '201' }).Count) {
        throw "Seed batch did not report all creates successful. Inspect production before retrying. Statuses: $(($statuses | ForEach-Object { $_.Groups[1].Value }) -join ',')."
    }
}

foreach ($definition in $definitions) {
    $columns = @($definition.Id, 'statecode') + $definition.Fields + @($definition.Lookups)
    $rows = @(Read-Rows $target $targetHeaders "$($definition.Set)?`$select=$($columns -join ',')")
    $index = Name-Index $rows $definition.Name
    foreach ($check in @($checks | Where-Object { $_.Definition.Set -eq $definition.Set })) {
        $current = $index[(Name-Key $check.Name)]
        if (-not $current) { throw "Seeded reference missing: $($check.Name)." }
        foreach ($field in $check.Expected.Keys) {
            if ($current.$field -cne $check.Expected[$field]) { throw "Readback mismatch: $($check.Name) / $field." }
        }
    }
    foreach ($original in $originals[$definition.Set]) {
        $current = @($rows | Where-Object { $_.($definition.Id) -eq $original.($definition.Id) })
        if ($current.Count -ne 1 -or $current[0].'@odata.etag' -ne $original.'@odata.etag') { throw 'An existing production reference changed during seeding.' }
    }
}
Write-Host 'PASS exact seeded values and mapped lookups; existing production reference versions preserved.'
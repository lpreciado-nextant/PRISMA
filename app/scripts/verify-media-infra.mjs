import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const compiler = process.env.BICEP_BIN || "bicep";
const directory = mkdtempSync(join(tmpdir(), "prisma-infra-check-"));
const source = fileURLToPath(new URL("../../infra/media/", import.meta.url));

function compile(command, name, output, env = {}) {
  const path = join(directory, output);
  const result = spawnSync(compiler, [command, join(source, name), "--outfile", path], { encoding: "utf8", timeout: 60_000, maxBuffer: 5 * 1024 * 1024, env: { ...process.env, ...env } });
  assert.equal(result.status, 0, result.error?.message || result.stderr || "Bicep failed; install it or set BICEP_BIN to its executable.");
  assert.equal(result.stderr.trim(), "", "Resolve Bicep diagnostics before acceptance.");
  return JSON.parse(readFileSync(path, "utf8"));
}

try {
  const template = compile("build", "main.bicep", "main.json");
  const parameters = compile("build-params", "example.bicepparam", "parameters.json");
  const resources = type => template.resources.filter(resource => resource.type === type);
  const only = type => {
    const matches = resources(type);
    assert.equal(matches.length, 1, type);
    return matches[0];
  };
  assert.equal(template.resources.length, 15, "Review additions to this storage-only foundation.");
  assert.deepEqual(Object.keys(parameters.parameters).sort(), Object.keys(template.parameters).sort());
  for (const name of ["location", "storageAccountName", "storageSku", "owner", "costCenter", "privateEndpointSubnetResourceId", "blobPrivateDnsZoneResourceId", "alertActionGroupResourceId"]) {
    assert.equal(template.parameters[name].defaultValue, undefined, `${name} requires explicit IT input`);
  }
  console.log(`PASS template and example parameters compile (Bicep ${template.metadata._generator.version})`);

  const storage = only("Microsoft.Storage/storageAccounts").properties;
  for (const name of ["allowBlobPublicAccess", "allowSharedKeyAccess", "allowCrossTenantReplication", "isHnsEnabled", "isLocalUserEnabled", "isSftpEnabled", "isNfsV3Enabled"]) assert.equal(storage[name], false, name);
  assert.equal(storage.publicNetworkAccess, "Disabled");
  assert.equal(storage.minimumTlsVersion, "TLS1_2");
  assert.equal(storage.supportsHttpsTrafficOnly, true);
  assert.equal(storage.defaultToOAuthAuthentication, true);
  assert.deepEqual(storage.networkAcls, { defaultAction: "Deny", bypass: "None", ipRules: [], virtualNetworkRules: [] });
  assert.equal(storage.encryption.requireInfrastructureEncryption, true);
  assert.deepEqual(template.variables.containerNames, ["staging", "quarantine", "final"]);
  const containers = only("Microsoft.Storage/storageAccounts/blobServices/containers");
  assert.deepEqual(containers.properties, { publicAccess: "None" });
  assert.equal(containers.copy.count, "[length(variables('containerNames'))]");
  assert.ok(containers.name.includes("variables('containerNames')[copyIndex()]"));
  const blobs = only("Microsoft.Storage/storageAccounts/blobServices").properties;
  assert.equal(blobs.isVersioningEnabled, true);
  assert.deepEqual(blobs.cors, { corsRules: [] });
  assert.deepEqual(blobs.deleteRetentionPolicy, { enabled: true, days: "[parameters('softDeleteDays')]", allowPermanentDelete: false });
  assert.deepEqual(blobs.containerDeleteRetentionPolicy, { enabled: true, days: "[parameters('softDeleteDays')]" });
  assert.deepEqual(blobs.changeFeed, { enabled: true, retentionInDays: "[parameters('softDeleteDays')]" });
  assert.equal(resources("Microsoft.Storage/storageAccounts/managementPolicies").length, 0);
  assert.equal(only("Microsoft.Authorization/locks").properties.level, "CanNotDelete");
  console.log("PASS private containers, transport restrictions, retention and no automatic deletion");

  assert.equal(resources("Microsoft.ManagedIdentity/userAssignedIdentities").length, 2);
  assert.equal(template.variables.blobContributor, "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')]");
  assert.equal(template.variables.blobReader, "[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')]");
  const roles = resources("Microsoft.Authorization/roleAssignments");
  assert.equal(roles.length, 3);
  const scope = index => `[resourceId('Microsoft.Storage/storageAccounts/blobServices/containers', parameters('storageAccountName'), 'default', variables('containerNames')[${index}])]`;
  const apiRoles = roles.filter(role => role.properties.principalId.includes("format('{0}-api'"));
  assert.equal(apiRoles.length, 2);
  assert.deepEqual(apiRoles.map(role => [role.scope, role.properties.roleDefinitionId]), [[scope(0), "[variables('blobContributor')]"], [scope(2), "[variables('blobReader')]"]]);
  for (const role of apiRoles) assert.equal(role.copy, undefined);
  const worker = roles.find(role => role.properties.principalId.includes("format('{0}-worker'"));
  assert.equal(worker.scope, scope("copyIndex()"));
  assert.equal(worker.copy.count, "[length(variables('containerNames'))]");
  assert.equal(worker.properties.roleDefinitionId, "[variables('blobContributor')]");
  for (const role of roles) assert.equal(role.properties.principalType, "ServicePrincipal");
  console.log("PASS separate managed identities and container-scoped API/worker roles");

  const endpoint = only("Microsoft.Network/privateEndpoints").properties;
  assert.equal(endpoint.subnet.id, "[parameters('privateEndpointSubnetResourceId')]");
  assert.equal(endpoint.privateLinkServiceConnections.length, 1);
  assert.deepEqual(endpoint.privateLinkServiceConnections[0].properties, { privateLinkServiceId: "[resourceId('Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]", groupIds: ["blob"] });
  const dns = only("Microsoft.Network/privateEndpoints/privateDnsZoneGroups").properties;
  assert.deepEqual(dns.privateDnsZoneConfigs, [{ name: "blob", properties: { privateDnsZoneId: "[parameters('blobPrivateDnsZoneResourceId')]" } }]);
  console.log("PASS private endpoint and explicit existing subnet/DNS dependencies");

  const logs = only("Microsoft.OperationalInsights/workspaces").properties;
  assert.equal(logs.features.disableLocalAuth, true);
  assert.equal(logs.features.enableLogAccessUsingOnlyResourcePermissions, false);
  assert.equal(logs.retentionInDays, "[parameters('logRetentionDays')]");
  const diagnostics = only("Microsoft.Insights/diagnosticSettings");
  const blobScope = "[resourceId('Microsoft.Storage/storageAccounts/blobServices', parameters('storageAccountName'), 'default')]";
  assert.equal(diagnostics.scope, blobScope);
  assert.equal(diagnostics.properties.workspaceId, "[resourceId('Microsoft.OperationalInsights/workspaces', format('{0}-logs', variables('prefix')))]");
  assert.deepEqual(diagnostics.properties.copy, [{ name: "logs", count: "[length(createArray('StorageRead', 'StorageWrite', 'StorageDelete'))]", input: { category: "[createArray('StorageRead', 'StorageWrite', 'StorageDelete')[copyIndex('logs')]]", enabled: true } }]);
  assert.deepEqual(diagnostics.properties.metrics, [{ category: "Transaction", enabled: true }]);
  const alerts = resources("Microsoft.Insights/metricAlerts");
  assert.equal(alerts.length, 2);
  for (const alert of alerts) {
    assert.equal(alert.properties.enabled, true);
    assert.deepEqual(alert.properties.scopes, [blobScope]);
    assert.deepEqual(alert.properties.actions, [{ actionGroupId: "[parameters('alertActionGroupResourceId')]" }]);
  }
  assert.deepEqual(alerts.map(alert => alert.properties.criteria.allOf[0].metricName), ["Availability", "Transactions"]);
  assert.deepEqual(alerts[1].properties.criteria.allOf[0].dimensions, [{ name: "ResponseType", operator: "Include", values: ["AuthorizationError"] }]);
  console.log("PASS Blob diagnostics, workspace restrictions and routed storage alerts");

  assert.deepEqual(Object.keys(template.outputs).sort(), ["storageAccountResourceId", "blobEndpoint", "apiIdentityResourceId", "apiIdentityClientId", "workerIdentityResourceId", "workerIdentityClientId", "logWorkspaceResourceId", "privateEndpointResourceId"].sort());
  assert.doesNotMatch(JSON.stringify(template.outputs), /listKeys|listAccountSas|listServiceSas/i);
  console.log("PASS non-secret outputs; local validation only, no Azure deployment");

  const lab = compile("build", "lab.bicep", "lab.json");
  const labParameters = compile("build-params", "lab.bicepparam", "lab.parameters.json",
    { PRISMA_LAB_ALLOWED_IPS: "203.0.113.10", PRISMA_LAB_PRINCIPAL_IDS: "00000000-0000-0000-0000-000000000001", PRISMA_LAB_OWNER: "check" });
  assert.deepEqual(Object.keys(labParameters.parameters).sort(), ["allowedIpAddresses", "developerPrincipalIds", "owner"]);
  assert.deepEqual(lab.resources.map(resource => resource.type), ["Microsoft.Storage/storageAccounts", "Microsoft.Storage/storageAccounts/blobServices",
    "Microsoft.Storage/storageAccounts/blobServices/containers", "Microsoft.Authorization/roleAssignments"], "Review additions to the dev lab.");
  const labStorage = lab.resources[0].properties;
  for (const name of ["allowBlobPublicAccess", "allowSharedKeyAccess", "allowCrossTenantReplication", "isHnsEnabled", "isLocalUserEnabled", "isSftpEnabled", "isNfsV3Enabled"]) assert.equal(labStorage[name], false, name);
  assert.equal(labStorage.minimumTlsVersion, "TLS1_2");
  assert.equal(labStorage.supportsHttpsTrafficOnly, true);
  assert.equal(labStorage.defaultToOAuthAuthentication, true);
  assert.equal(labStorage.networkAcls.defaultAction, "Deny");
  assert.equal(labStorage.networkAcls.bypass, "None");
  assert.deepEqual(labStorage.networkAcls.virtualNetworkRules, []);
  assert.deepEqual(labStorage.networkAcls.copy[0].input, { value: "[parameters('allowedIpAddresses')[copyIndex('ipRules')]]", action: "Allow" });
  assert.deepEqual(lab.variables.containerNames, ["staging", "assets"]);
  assert.deepEqual(lab.resources[2].properties, { publicAccess: "None" });
  assert.deepEqual(lab.resources[1].properties.cors, { corsRules: [] });
  const labRole = lab.resources[3];
  assert.match(labRole.scope, /^\[resourceId\('Microsoft\.Storage\/storageAccounts\/blobServices\/containers'/);
  assert.equal(labRole.properties.principalType, "User");
  assert.equal(labRole.properties.roleDefinitionId, "[variables('blobContributor')]");
  assert.equal(lab.variables.blobContributor, template.variables.blobContributor);
  assert.doesNotMatch(JSON.stringify(lab.outputs), /listKeys|listAccountSas|listServiceSas/i);
  console.log("PASS dev lab: Entra-only, IP allow-listed, container-scoped developer roles (not the production foundation)");

  const pilot = compile("build", "pilot.bicep", "pilot.json");
  const pilotParameters = compile("build-params", "pilot.bicepparam", "pilot.parameters.json", { PRISMA_PILOT_OWNER: "check" });
  assert.deepEqual(Object.keys(pilotParameters.parameters).sort(), ["budgetContactEmails", "budgetStartDate", "monthlyBudget", "owner", "pluginFederatedSubject"]);
  const pilotType = type => pilot.resources.filter(resource => resource.type === type);
  assert.deepEqual(pilot.resources.map(resource => resource.type), ["Microsoft.Storage/storageAccounts", "Microsoft.Storage/storageAccounts/blobServices",
    "Microsoft.Storage/storageAccounts/blobServices/containers", "Microsoft.ManagedIdentity/userAssignedIdentities", "Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials",
    "Microsoft.Authorization/roleAssignments", "Microsoft.OperationalInsights/workspaces", "Microsoft.Insights/diagnosticSettings", "Microsoft.Authorization/locks", "Microsoft.Consumption/budgets"], "Review additions to the pilot.");
  const pilotStorage = pilot.resources[0].properties;
  for (const name of ["allowBlobPublicAccess", "allowSharedKeyAccess", "allowCrossTenantReplication", "isHnsEnabled", "isLocalUserEnabled", "isSftpEnabled", "isNfsV3Enabled"]) assert.equal(pilotStorage[name], false, name);
  assert.equal(pilotStorage.minimumTlsVersion, "TLS1_2");
  assert.equal(pilotStorage.defaultToOAuthAuthentication, true);
  assert.equal(pilotStorage.encryption.requireInfrastructureEncryption, true);
  assert.deepEqual(pilot.resources[2].properties, { publicAccess: "None" });
  assert.deepEqual(pilot.resources[1].properties.cors, { corsRules: [] });
  assert.equal(pilot.resources[1].properties.deleteRetentionPolicy.allowPermanentDelete, false);
  const federation = pilot.resources[4];
  assert.equal(federation.condition, "[not(empty(parameters('pluginFederatedSubject')))]");
  assert.deepEqual(federation.properties.audiences, ["api://AzureADTokenExchange"]);
  const pilotRoles = pilotType("Microsoft.Authorization/roleAssignments");
  assert.equal(pilotRoles.length, 1);
  assert.equal(pilotRoles[0].scope, "[resourceId('Microsoft.Storage/storageAccounts/blobServices/containers', parameters('storageAccountName'), 'default', 'media')]");
  assert.equal(pilotRoles[0].properties.principalType, "ServicePrincipal");
  assert.equal(pilotRoles[0].properties.roleDefinitionId, "[variables('blobContributor')]");
  assert.equal(pilot.variables.blobContributor, template.variables.blobContributor);
  const pilotDiagnostics = pilotType("Microsoft.Insights/diagnosticSettings")[0].properties;
  assert.equal(pilotDiagnostics.copy[0].count, "[length(createArray('StorageRead', 'StorageWrite', 'StorageDelete'))]");
  assert.deepEqual(pilotDiagnostics.metrics, [{ category: "Transaction", enabled: true }]);
  assert.equal(pilotType("Microsoft.Authorization/locks")[0].properties.level, "CanNotDelete");
  assert.equal(pilotType("Microsoft.OperationalInsights/workspaces")[0].properties.features.disableLocalAuth, true);
  assert.equal(pilotType("Microsoft.Consumption/budgets")[0].condition, "[greater(parameters('monthlyBudget'), 0)]");
  assert.doesNotMatch(JSON.stringify(pilot.outputs), /listKeys|listAccountSas|listServiceSas/i);
  console.log("PASS pilot: Entra-only storage, one container-scoped plug-in identity, audit logs, lock and optional budget");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
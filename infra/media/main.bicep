targetScope = 'resourceGroup'

@allowed(['dev', 'test', 'prod'])
param environmentName string

@description('Approved Azure region; no production location is assumed.')
param location string

@minLength(3)
@maxLength(24)
@description('Globally unique lowercase alphanumeric name for a NEW environment-isolated account.')
param storageAccountName string

@allowed(['Standard_LRS', 'Standard_ZRS', 'Standard_GRS', 'Standard_GZRS'])
param storageSku string

@minLength(1)
param owner string

@minLength(1)
param costCenter string

@description('Existing approved private endpoint subnet in the chosen region, reachable by the future API/worker.')
@minLength(1)
param privateEndpointSubnetResourceId string

@description('Existing privatelink.blob.core.windows.net zone, already linked to the approved client VNet/DNS resolver.')
@minLength(1)
param blobPrivateDnsZoneResourceId string

@description('Existing tested Azure Monitor action group; no unowned alerts.')
@minLength(1)
param alertActionGroupResourceId string

@minValue(1)
@maxValue(365)
param softDeleteDays int = 30

@minValue(30)
@maxValue(730)
param logRetentionDays int = 30

@minValue(1)
param authorizationErrorThreshold int = 10

var prefix = 'prisma-${environmentName}-${uniqueString(resourceGroup().id, storageAccountName)}'
var tags = { application: 'PRISMA', environment: environmentName, owner: owner, costCenter: costCenter }
var containerNames = ['staging', 'quarantine', 'final']
var blobContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var blobReader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: storageSku }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    allowCrossTenantReplication: false
    defaultToOAuthAuthentication: true
    isHnsEnabled: false
    isLocalUserEnabled: false
    isSftpEnabled: false
    isNfsV3Enabled: false
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'None', ipRules: [], virtualNetworkRules: [] }
    encryption: {
      keySource: 'Microsoft.Storage'
      requireInfrastructureEncryption: true
      services: { blob: { enabled: true, keyType: 'Account' } }
    }
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: softDeleteDays, allowPermanentDelete: false }
    containerDeleteRetentionPolicy: { enabled: true, days: softDeleteDays }
    changeFeed: { enabled: true, retentionInDays: softDeleteDays }
    cors: { corsRules: [] }
  }
}

resource containers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for containerName in containerNames: {
  parent: blobs
  name: containerName
  properties: { publicAccess: 'None' }
}]

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-api'
  location: location
  tags: tags
}

resource workerIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-worker'
  location: location
  tags: tags
}

resource apiStageAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containers[0].id, apiIdentity.id, blobContributor)
  scope: containers[0]
  properties: {
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobContributor
  }
}

resource apiFinalRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containers[2].id, apiIdentity.id, blobReader)
  scope: containers[2]
  properties: {
    principalId: apiIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobReader
  }
}

resource workerAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (containerName, index) in containerNames: {
  name: guid(containers[index].id, workerIdentity.id, blobContributor)
  scope: containers[index]
  properties: {
    principalId: workerIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobContributor
  }
}]

resource endpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-blob'
  location: location
  tags: tags
  properties: {
    subnet: { id: privateEndpointSubnetResourceId }
    privateLinkServiceConnections: [{
      name: '${prefix}-blob'
      properties: { privateLinkServiceId: storage.id, groupIds: ['blob'] }
    }]
  }
}

resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: endpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [{ name: 'blob', properties: { privateDnsZoneId: blobPrivateDnsZoneResourceId } }]
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: logRetentionDays
    features: { disableLocalAuth: true, enableLogAccessUsingOnlyResourcePermissions: false }
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'blob-audit'
  scope: blobs
  properties: {
    workspaceId: logs.id
    logAnalyticsDestinationType: 'Dedicated'
    logs: [for category in ['StorageRead', 'StorageWrite', 'StorageDelete']: { category: category, enabled: true }]
    metrics: [{ category: 'Transaction', enabled: true }]
  }
}

resource availability 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-availability'
  location: 'global'
  tags: tags
  properties: {
    description: 'Blob availability below 99 percent over 5 minutes; tune after the approved pilot.'
    severity: 2
    enabled: true
    autoMitigate: true
    scopes: [blobs.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{
        name: 'availability'
        metricNamespace: 'Microsoft.Storage/storageAccounts/blobServices'
        metricName: 'Availability'
        operator: 'LessThan'
        threshold: 99
        timeAggregation: 'Average'
        criterionType: 'StaticThresholdCriterion'
      }]
    }
    actions: [{ actionGroupId: alertActionGroupResourceId }]
  }
}

resource authorizationErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${prefix}-authorization-errors'
  location: 'global'
  tags: tags
  properties: {
    description: 'Repeated storage authorization failures; does not detect Dataverse/API denials.'
    severity: 2
    enabled: true
    autoMitigate: true
    scopes: [blobs.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [{
        name: 'authorization-errors'
        metricNamespace: 'Microsoft.Storage/storageAccounts/blobServices'
        metricName: 'Transactions'
        operator: 'GreaterThan'
        threshold: authorizationErrorThreshold
        timeAggregation: 'Total'
        criterionType: 'StaticThresholdCriterion'
        dimensions: [{ name: 'ResponseType', operator: 'Include', values: ['AuthorizationError'] }]
      }]
    }
    actions: [{ actionGroupId: alertActionGroupResourceId }]
  }
}

resource storageLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: 'protect-media-account'
  scope: storage
  properties: { level: 'CanNotDelete', notes: 'Account deletion requires explicit recovery/retirement approval. Not a data-plane blob lock.' }
}

output storageAccountResourceId string = storage.id
output blobEndpoint string = storage.properties.primaryEndpoints.blob
output apiIdentityResourceId string = apiIdentity.id
output apiIdentityClientId string = apiIdentity.properties.clientId
output workerIdentityResourceId string = workerIdentity.id
output workerIdentityClientId string = workerIdentity.properties.clientId
output logWorkspaceResourceId string = logs.id
output privateEndpointResourceId string = endpoint.id

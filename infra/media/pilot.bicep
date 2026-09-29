targetScope = 'resourceGroup'

// Pilot media storage for the connected PRISMA app. Only the Dataverse plug-in identity reaches the data plane.

param location string = resourceGroup().location

@minLength(3)
@maxLength(24)
param storageAccountName string = 'stprismamedia${take(uniqueString(resourceGroup().id), 10)}'

@minLength(1)
param owner string

@minValue(7)
@maxValue(365)
param softDeleteDays int = 30

@minValue(30)
@maxValue(730)
param logRetentionDays int = 30

@description('Power Platform plug-in subject (/eid1/c/pub/t/.../n/plugin/e/{environmentId}/...). Empty until the signing certificate exists.')
param pluginFederatedSubject string = ''

@minValue(0)
@description('Monthly resource-group budget in the billing currency; 0 skips the budget.')
param monthlyBudget int = 0

@description('First day of the current or a future month, yyyy-MM-01.')
param budgetStartDate string = ''

param budgetContactEmails array = []

var tags = { application: 'PRISMA', environment: 'pilot', owner: owner }
var blobContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
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
    // Dataverse plug-ins egress from shared platform addresses, so access is Entra-only rather than IP-restricted.
    publicNetworkAccess: 'Enabled'
    networkAcls: { defaultAction: 'Allow', bypass: 'None', ipRules: [], virtualNetworkRules: [] }
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
    isVersioningEnabled: false
    deleteRetentionPolicy: { enabled: true, days: softDeleteDays, allowPermanentDelete: false }
    containerDeleteRetentionPolicy: { enabled: true, days: softDeleteDays }
    cors: { corsRules: [] }
  }
}

resource media 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'media'
  properties: { publicAccess: 'None' }
}

resource pluginIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-prisma-media-plugin'
  location: location
  tags: tags
}

resource pluginFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(pluginFederatedSubject)) {
  parent: pluginIdentity
  name: 'nextant-pulse-plugin'
  properties: {
    issuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
    subject: pluginFederatedSubject
    audiences: ['api://AzureADTokenExchange']
  }
}

resource pluginAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(media.id, pluginIdentity.id, blobContributor)
  scope: media
  properties: {
    principalId: pluginIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobContributor
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-prisma-media-pilot'
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

resource storageLock 'Microsoft.Authorization/locks@2020-05-01' = {
  name: 'protect-media-account'
  scope: storage
  properties: { level: 'CanNotDelete', notes: 'Holds pilot media referenced by Dataverse. Not a data-plane blob lock.' }
}

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = if (monthlyBudget > 0) {
  name: 'prisma-media-pilot'
  properties: {
    category: 'Cost'
    amount: monthlyBudget
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate }
    notifications: {
      actual80: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 80, thresholdType: 'Actual', contactEmails: budgetContactEmails }
      forecast100: { enabled: true, operator: 'GreaterThanOrEqualTo', threshold: 100, thresholdType: 'Forecasted', contactEmails: budgetContactEmails }
    }
  }
}

output storageAccountResourceId string = storage.id
output mediaContainerUrl string = '${storage.properties.primaryEndpoints.blob}media'
output pluginIdentityClientId string = pluginIdentity.properties.clientId
output pluginIdentityPrincipalId string = pluginIdentity.properties.principalId
output tenantId string = tenant().tenantId
output logWorkspaceResourceId string = logs.id

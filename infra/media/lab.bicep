targetScope = 'resourceGroup'

// Development lab only: real Blob Storage behind the local media workbench. Not the production foundation (main.bicep).

param location string = resourceGroup().location

@minLength(3)
@maxLength(24)
param storageAccountName string = 'stprismalab${take(uniqueString(resourceGroup().id), 10)}'

@minLength(1)
@description('Public IPv4 addresses of developer machines allowed through the storage firewall.')
param allowedIpAddresses array

@minLength(1)
@description('Entra object IDs of developers who receive Blob data access on the lab containers only.')
param developerPrincipalIds array

@minLength(1)
param owner string

@minValue(1)
@maxValue(30)
param softDeleteDays int = 7

var tags = { application: 'PRISMA', environment: 'dev-lab', owner: owner }
var containerNames = ['staging', 'assets']
var blobContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var grants = flatten(map(developerPrincipalIds, principalId => map(range(0, length(containerNames)), index => { principalId: principalId, container: index })))

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
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'
      ipRules: [for ip in allowedIpAddresses: { value: ip, action: 'Allow' }]
      virtualNetworkRules: []
    }
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

resource containers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for containerName in containerNames: {
  parent: blobs
  name: containerName
  properties: { publicAccess: 'None' }
}]

resource developerAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for grant in grants: {
  name: guid(containers[grant.container].id, grant.principalId, blobContributor)
  scope: containers[grant.container]
  properties: {
    principalId: grant.principalId
    principalType: 'User'
    roleDefinitionId: blobContributor
  }
}]

output storageAccountResourceId string = storage.id
output blobEndpoint string = storage.properties.primaryEndpoints.blob

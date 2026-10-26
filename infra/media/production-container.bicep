targetScope = 'resourceGroup'

param location string = resourceGroup().location

@description('Existing PRISMA media account in this resource group. Deploy only in incremental mode.')
@allowed(['stprismamediaiwguqp7gvh'])
param storageAccountName string = 'stprismamediaiwguqp7gvh'

@minLength(1)
param owner string

@description('Certificate v2 subject for production environment bce2c94a-b2b3-e487-b368-b8d7c931f90b. Self-signed use requires the documented deployment exception. Leave empty for a storage-only preview; runtime access remains unavailable.')
param pluginFederatedSubject string = ''

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storage
  name: 'default'
}

resource media 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'media-prod'
  properties: { publicAccess: 'None' }
}

resource pluginIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-prisma-media-plugin-prod'
  location: location
  tags: { application: 'PRISMA', environment: 'production', owner: owner }
}

resource pluginFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(pluginFederatedSubject)) {
  parent: pluginIdentity
  name: 'nextant-pulse-prod-plugin'
  properties: {
    issuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
    subject: pluginFederatedSubject
    audiences: ['api://AzureADTokenExchange']
  }
}

var blobContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')

resource pluginAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(media.id, pluginIdentity.id, blobContributor)
  scope: media
  properties: {
    principalId: pluginIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: blobContributor
  }
}

output storageAccountResourceId string = storage.id
output mediaContainerUrl string = '${storage.properties.primaryEndpoints.blob}media-prod'
output pluginIdentityClientId string = pluginIdentity.properties.clientId
output pluginIdentityPrincipalId string = pluginIdentity.properties.principalId
output tenantId string = tenant().tenantId

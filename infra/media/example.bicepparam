using './main.bicep'

param environmentName = 'dev'
param location = 'eastus'
param storageAccountName = 'replacewithapprovedname'
param storageSku = 'Standard_LRS'
param owner = 'REPLACE_WITH_APPROVED_OWNER'
param costCenter = 'REPLACE_WITH_APPROVED_COST_CENTER'
param privateEndpointSubnetResourceId = '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/REPLACE/providers/Microsoft.Network/virtualNetworks/REPLACE/subnets/REPLACE'
param blobPrivateDnsZoneResourceId = '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/REPLACE/providers/Microsoft.Network/privateDnsZones/privatelink.blob.core.windows.net'
param alertActionGroupResourceId = '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/REPLACE/providers/Microsoft.Insights/actionGroups/REPLACE'
param softDeleteDays = 30
param logRetentionDays = 30
param authorizationErrorThreshold = 10

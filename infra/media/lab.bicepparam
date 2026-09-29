using './lab.bicep'

// Supply comma-separated values through environment variables; nothing personal is committed.
param allowedIpAddresses = split(readEnvironmentVariable('PRISMA_LAB_ALLOWED_IPS'), ',')
param developerPrincipalIds = split(readEnvironmentVariable('PRISMA_LAB_PRINCIPAL_IDS'), ',')
param owner = readEnvironmentVariable('PRISMA_LAB_OWNER')

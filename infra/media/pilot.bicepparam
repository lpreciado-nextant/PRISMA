using './pilot.bicep'

// Supply values through environment variables; nothing personal is committed.
param owner = readEnvironmentVariable('PRISMA_PILOT_OWNER')
param pluginFederatedSubject = readEnvironmentVariable('PRISMA_PILOT_PLUGIN_SUBJECT', '')
param monthlyBudget = int(readEnvironmentVariable('PRISMA_PILOT_MONTHLY_BUDGET', '0'))
param budgetStartDate = readEnvironmentVariable('PRISMA_PILOT_BUDGET_START', '')
param budgetContactEmails = empty(readEnvironmentVariable('PRISMA_PILOT_BUDGET_EMAILS', '')) ? [] : split(readEnvironmentVariable('PRISMA_PILOT_BUDGET_EMAILS', ''), ',')

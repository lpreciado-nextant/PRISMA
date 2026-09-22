using System;
using Microsoft.Xrm.Sdk;

namespace Prisma.Plugins
{
    public sealed class SolutionWriteGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.PrimaryEntityName != "nx_solution") throw new InvalidPluginExecutionException("Invalid PRISMA guard registration.");
            if (context.MessageName == "Delete" && DraftPolicy.IsDeleteContext(context)) return;
            if (context.MessageName == "Create" || context.MessageName == "Update")
            {
                if (DraftPolicy.IsSaveContext(context)) return;
            }
            throw new InvalidPluginExecutionException("Use the PRISMA draft API. Direct Solution writes are disabled.");
        }
    }
}
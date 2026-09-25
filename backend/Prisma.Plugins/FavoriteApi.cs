using System;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    [DataContract]
    public sealed class FavoriteResult
    {
        [DataMember(Name = "saved")] public bool Saved { get; set; }
    }

    [DataContract]
    public sealed class FavoriteList
    {
        [DataMember(Name = "solutionIds")] public string[] SolutionIds { get; set; }
    }

    /// <summary>
    /// `nx_solutionfavorite` create/delete and list, scoped to the signed-in caller's own
    /// `cr6b0_consultant` record. The client never writes `nx_user` itself: it is always
    /// resolved here from the caller's identity, the same way the person picker matches a
    /// contributor by email, so one person can never read, create or remove another's rows.
    /// </summary>
    public sealed class FavoriteApi : IPlugin
    {
        public const string SetMessage = "nx_SetFavorite";
        public const string ListMessage = "nx_GetMyFavorites";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            if (context.MessageName == ListMessage) { List(context, caller); return; }
            if (context.MessageName != SetMessage) throw new InvalidPluginExecutionException("Invalid favorite operation.");
            var solutionId = (Guid)context.InputParameters["SolutionId"];
            var saved = (bool)context.InputParameters["Saved"];
            // The solution must exist and be readable by the caller before it can be favorited.
            caller.Retrieve("nx_solution", solutionId, new ColumnSet(false));
            var consultantId = ResolveConsultant(caller, context.InitiatingUserId);
            var existing = Find(caller, solutionId, consultantId);
            if (saved && existing == null)
            {
                caller.Create(new Entity("nx_solutionfavorite") {
                    ["nx_solution"] = new EntityReference("nx_solution", solutionId),
                    ["nx_user"] = new EntityReference("cr6b0_consultant", consultantId),
                    ["ownerid"] = new EntityReference("systemuser", context.InitiatingUserId)
                });
            }
            else if (!saved && existing != null)
            {
                caller.Delete("nx_solutionfavorite", existing.Id);
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new FavoriteResult { Saved = saved });
        }

        private static void List(IPluginExecutionContext context, IOrganizationService caller)
        {
            var consultantId = ResolveConsultant(caller, context.InitiatingUserId);
            var query = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet("nx_solution"), TopCount = 5000 };
            query.Criteria.AddCondition("nx_user", ConditionOperator.Equal, consultantId);
            query.Orders.Add(new OrderExpression("createdon", OrderType.Descending));
            var rows = caller.RetrieveMultiple(query).Entities;
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new FavoriteList {
                SolutionIds = rows.Select(row => row.GetAttributeValue<EntityReference>("nx_solution")?.Id.ToString("D")).Where(id => id != null).ToArray()
            });
        }

        private static Entity Find(IOrganizationService caller, Guid solutionId, Guid consultantId)
        {
            var query = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, solutionId);
            query.Criteria.AddCondition("nx_user", ConditionOperator.Equal, consultantId);
            return caller.RetrieveMultiple(query).Entities.SingleOrDefault();
        }

        /// <summary>Resolves the signed-in systemuser to their active `cr6b0_consultant` row by email, same rule as the person picker.</summary>
        private static Guid ResolveConsultant(IOrganizationService caller, Guid userId)
        {
            var user = caller.Retrieve("systemuser", userId, new ColumnSet("internalemailaddress"));
            var email = user.GetAttributeValue<string>("internalemailaddress");
            if (string.IsNullOrWhiteSpace(email)) throw new InvalidPluginExecutionException("Signed-in user has no email on file.");
            var query = new QueryExpression("cr6b0_consultant") { ColumnSet = new ColumnSet(false), TopCount = 2 };
            query.Criteria.AddCondition("cr6b0_email", ConditionOperator.Equal, email);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            var rows = caller.RetrieveMultiple(query).Entities;
            if (rows.Count != 1) throw new InvalidPluginExecutionException("No unique active consultant record matches the signed-in user.");
            return rows[0].Id;
        }
    }
}

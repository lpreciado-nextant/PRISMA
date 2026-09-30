using System;
using System.Collections.Generic;
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

    /// <summary>Ranks solutions by how many people saved them. Ties go to the most recently saved, then to the id, so the order is stable.</summary>
    public static class FavoriteRanking
    {
        public const int TopCount = 10;

        public static Guid[] Top(IEnumerable<KeyValuePair<Guid, DateTime>> saves, int count = TopCount)
        {
            return saves.GroupBy(save => save.Key)
                .Select(group => new { Id = group.Key, Saves = group.Count(), Latest = group.Max(save => save.Value) })
                .OrderByDescending(entry => entry.Saves).ThenByDescending(entry => entry.Latest).ThenBy(entry => entry.Id)
                .Take(count).Select(entry => entry.Id).ToArray();
        }
    }

    /// <summary>
    /// `nx_solutionfavorite` create/delete and list, scoped to the signed-in caller's own
    /// `cr6b0_consultant` record. The client never writes `nx_user` itself: it is always
    /// resolved here from the caller's identity, the same way the person picker matches a
    /// contributor by email, so one person can never read, create or remove another's rows.
    /// Setting the two lookups needs Append on the favorite and AppendTo on `nx_solution`,
    /// which the roles deliberately lack, so the row is written by the server service only
    /// after the caller has proven Read on the solution; the caller still owns the row.
    /// </summary>
    public sealed class FavoriteApi : IPlugin
    {
        public const string SetMessage = "nx_SetFavorite";
        public const string ListMessage = "nx_GetMyFavorites";
        public const string TopMessage = "nx_GetTopFavorites";

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            if (context.MessageName == ListMessage) { List(context, caller, server); return; }
            if (context.MessageName == TopMessage) { Top(context, server, (ITracingService)serviceProvider.GetService(typeof(ITracingService))); return; }
            if (context.MessageName != SetMessage) throw new InvalidPluginExecutionException("Invalid favorite operation.");
            var solutionId = (Guid)context.InputParameters["SolutionId"];
            var saved = (bool)context.InputParameters["Saved"];
            // The solution must exist and be readable by the caller before it can be favorited.
            caller.Retrieve("nx_solution", solutionId, new ColumnSet(false));
            var consultantId = ResolveConsultant(server, context.InitiatingUserId);
            var existing = Find(server, solutionId, consultantId);
            if (saved && existing == null)
            {
                server.Create(new Entity("nx_solutionfavorite") {
                    ["nx_solution"] = new EntityReference("nx_solution", solutionId),
                    ["nx_user"] = new EntityReference("cr6b0_consultant", consultantId),
                    ["ownerid"] = new EntityReference("systemuser", context.InitiatingUserId)
                });
            }
            else if (!saved && existing != null)
            {
                server.Delete("nx_solutionfavorite", existing.Id);
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new FavoriteResult { Saved = saved });
        }

        /// <summary>Reads through the caller, so User-depth Read keeps the list to rows they own.</summary>
        private static void List(IPluginExecutionContext context, IOrganizationService caller, IOrganizationService server)
        {
            var consultantId = ResolveConsultant(server, context.InitiatingUserId);
            var query = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet("nx_solution"), TopCount = 5000 };
            query.Criteria.AddCondition("nx_user", ConditionOperator.Equal, consultantId);
            query.Orders.Add(new OrderExpression("createdon", OrderType.Descending));
            var rows = caller.RetrieveMultiple(query).Entities;
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new FavoriteList {
                SolutionIds = rows.Select(row => row.GetAttributeValue<EntityReference>("nx_solution")?.Id.ToString("D")).Where(id => id != null).ToArray()
            });
        }

        /// <summary>
        /// Counts every person's favorites, so it reads as the server. It returns only the ranked solution ids of
        /// Published, active solutions: never who saved them or how many times. Rows without a consultant are ignored.
        /// </summary>
        private static void Top(IPluginExecutionContext context, IOrganizationService server, ITracingService tracing)
        {
            var saves = new List<KeyValuePair<Guid, DateTime>>();
            var query = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet("nx_solution", "createdon") };
            query.Criteria.AddCondition("nx_user", ConditionOperator.NotNull);
            var solution = query.AddLink("nx_solution", "nx_solution", "nx_solutionid");
            solution.LinkCriteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, ReviewPolicy.Published);
            solution.LinkCriteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 };
            while (true)
            {
                var page = server.RetrieveMultiple(query);
                foreach (var row in page.Entities)
                {
                    var target = row.GetAttributeValue<EntityReference>("nx_solution");
                    if (target != null) saves.Add(new KeyValuePair<Guid, DateTime>(target.Id, row.GetAttributeValue<DateTime>("createdon")));
                }
                if (!page.MoreRecords || query.PageInfo.PageNumber >= 20) break;
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            tracing?.Trace("Top favorites ranked {0} saves across {1} pages.", saves.Count, query.PageInfo.PageNumber);
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new FavoriteList {
                SolutionIds = FavoriteRanking.Top(saves).Select(id => id.ToString("D")).ToArray()
            });
        }

        private static Entity Find(IOrganizationService server, Guid solutionId, Guid consultantId)
        {
            var query = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            query.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, solutionId);
            query.Criteria.AddCondition("nx_user", ConditionOperator.Equal, consultantId);
            return server.RetrieveMultiple(query).Entities.SingleOrDefault();
        }

        /// <summary>
        /// Resolves the signed-in systemuser to their active `cr6b0_consultant` row by email, same rule as the person picker.
        /// Uses the server service: the identity comes from the execution context, never from the client.
        /// </summary>
        private static Guid ResolveConsultant(IOrganizationService server, Guid userId)
        {
            var user = server.Retrieve("systemuser", userId, new ColumnSet("internalemailaddress"));
            var email = user.GetAttributeValue<string>("internalemailaddress");
            if (string.IsNullOrWhiteSpace(email)) throw new InvalidPluginExecutionException("Signed-in user has no email on file.");
            var query = new QueryExpression("cr6b0_consultant") { ColumnSet = new ColumnSet(false), TopCount = 2 };
            query.Criteria.AddCondition("cr6b0_email", ConditionOperator.Equal, email);
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            var rows = server.RetrieveMultiple(query).Entities;
            if (rows.Count != 1) throw new InvalidPluginExecutionException("No unique active consultant record matches the signed-in user.");
            return rows[0].Id;
        }
    }
}

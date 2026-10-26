using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    public sealed class LibrarianAccess
    {
        public const string ScopedRole = "PRISMA Librarian";
        public const string GlobalRole = "PRISMA Global Librarian";
        private readonly HashSet<Guid> areas = new HashSet<Guid>();
        public bool Global { get; private set; }
        public bool Available { get { return Global || areas.Count != 0; } }

        public static LibrarianAccess Resolve(IOrganizationService server, Guid user)
        {
            var access = new LibrarianAccess { Global = HasRole(server, user, GlobalRole) };
            if (access.Global || !HasRole(server, user, ScopedRole)) return access;
            var consultant = FavoriteApi.ResolveConsultant(server, user);
            var query = new QueryExpression("nx_capability") {
                ColumnSet = new ColumnSet("nx_specializationarea"),
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 }
            };
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.Criteria.AddCondition("nx_capabilityowner", ConditionOperator.Equal, consultant);
            query.AddLink("nx_specializationarea", "nx_specializationarea", "nx_specializationareaid")
                .LinkCriteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            query.AddOrder("nx_capabilityid", OrderType.Ascending);
            while (true)
            {
                var page = server.RetrieveMultiple(query);
                foreach (var row in page.Entities)
                {
                    var area = row.GetAttributeValue<EntityReference>("nx_specializationarea");
                    if (area != null) access.areas.Add(area.Id);
                }
                if (!page.MoreRecords) return access;
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }

        public bool CanManage(IOrganizationService server, Entity solution)
        {
            if (Global) return true;
            var capability = solution.GetAttributeValue<EntityReference>("nx_capability");
            if (!Available || capability == null) return false;
            var row = server.Retrieve("nx_capability", capability.Id, new ColumnSet("statecode", "nx_specializationarea"));
            var area = row.GetAttributeValue<EntityReference>("nx_specializationarea");
            return row.GetAttributeValue<OptionSetValue>("statecode")?.Value == 0 && area != null && areas.Contains(area.Id);
        }

        public void FilterQueue(QueryExpression query)
        {
            if (!Available) throw MediaPolicy.Invalid("Capability-owner librarian access or the PRISMA Global Librarian role is required.");
            if (Global) return;
            var capability = query.AddLink("nx_capability", "nx_capability", "nx_capabilityid");
            capability.LinkCriteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            capability.LinkCriteria.AddCondition("nx_specializationarea", ConditionOperator.In, areas.Select(id => (object)id).ToArray());
        }

        public Entity ReadSolution(IOrganizationService caller, IOrganizationService server, Guid user, Guid id, ColumnSet columns, out bool librarian)
        {
            var selected = new ColumnSet(columns.Columns.Concat(new[] { "ownerid", "nx_capability" }).Distinct().ToArray());
            var solution = server.Retrieve("nx_solution", id, selected);
            librarian = CanManage(server, solution);
            var owner = solution.GetAttributeValue<EntityReference>("ownerid");
            if (owner?.LogicalName == "systemuser" && owner.Id == user) return caller.Retrieve("nx_solution", id, selected);
            if (librarian) return solution;
            throw MediaPolicy.Invalid("Submission access denied. Librarian access is limited to the main capability's specialization area.");
        }

        private static bool HasRole(IOrganizationService server, Guid user, string name)
        {
            var direct = new QueryExpression("role") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            direct.Criteria.AddCondition("name", ConditionOperator.Equal, name);
            direct.AddLink("systemuserroles", "roleid", "roleid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (server.RetrieveMultiple(direct).Entities.Count != 0) return true;
            var inherited = new QueryExpression("role") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            inherited.Criteria.AddCondition("name", ConditionOperator.Equal, name);
            inherited.AddLink("teamroles", "roleid", "roleid").AddLink("teammembership", "teamid", "teamid")
                .LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            return server.RetrieveMultiple(inherited).Entities.Count != 0;
        }
    }
}

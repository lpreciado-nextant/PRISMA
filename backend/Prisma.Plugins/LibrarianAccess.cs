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
        private readonly HashSet<Guid> capabilities = new HashSet<Guid>();
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
                    if (area == null) continue;
                    access.areas.Add(area.Id);
                    access.capabilities.Add(row.Id);
                }
                if (!page.MoreRecords) return access;
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }

        /// <summary>
        /// What the review queue shows of this access, for its filters only: global, or the managed areas and the active
        /// capabilities the librarian owns in them. Never used to authorize; `null` without librarian access.
        /// </summary>
        public LibrarianScope Scope()
        {
            if (!Available) return null;
            return Global ? new LibrarianScope { Global = true, AreaIds = new List<string>(), CapabilityIds = new List<string>() }
                : new LibrarianScope { AreaIds = areas.OrderBy(id => id).Select(id => id.ToString("D")).ToList(), CapabilityIds = capabilities.OrderBy(id => id).Select(id => id.ToString("D")).ToList() };
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

        /// <summary>
        /// Any librarian may read a record in the review queue (Pending review, Published, or returned with Changes requested),
        /// in every area, with its feedback and suggestions. Deciding and editing stay with <see cref="CanManage"/>.
        /// </summary>
        public bool CanView(IOrganizationService server, Entity solution)
        {
            return Available && (InQueue(solution) || CanManage(server, solution));
        }

        /// <summary>Pending review, Published, or a Draft returned with Changes requested. Needs nx_publicationstatus and nx_reviewoutcome.</summary>
        public static bool InQueue(Entity solution)
        {
            var publication = solution.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value;
            return publication == ReviewPolicy.Pending || publication == ReviewPolicy.Published
                || (publication == DraftPolicy.DraftStatus && solution.GetAttributeValue<OptionSetValue>("nx_reviewoutcome")?.Value == SuggestionPolicy.ChangesRequested);
        }

        /// <summary>The review queue shows every area to any librarian; each row says whether the caller may manage it.</summary>
        public void FilterQueue(QueryExpression query)
        {
            if (!Available) throw MediaPolicy.Invalid("Capability-owner librarian access or the PRISMA Global Librarian role is required.");
        }

        /// <summary>
        /// The submission page: like <see cref="ReadSolution"/>, but a librarian outside the record's area may still read a
        /// queue record (`viewer`, read-only). Only reads may use it; every write goes through <see cref="ReadSolution"/>.
        /// </summary>
        public Entity ReadForReview(IOrganizationService caller, IOrganizationService server, Guid user, Guid id, ColumnSet columns, out bool librarian, out bool viewer)
        {
            var selected = new ColumnSet(columns.Columns.Concat(new[] { "ownerid", "nx_capability", "nx_publicationstatus", "nx_reviewoutcome" }).Distinct().ToArray());
            var solution = server.Retrieve("nx_solution", id, selected);
            librarian = CanManage(server, solution);
            viewer = !librarian && Available && InQueue(solution);
            var owner = solution.GetAttributeValue<EntityReference>("ownerid");
            if (owner?.LogicalName == "systemuser" && owner.Id == user) return caller.Retrieve("nx_solution", id, selected);
            if (librarian || viewer) return solution;
            throw MediaPolicy.Invalid("Submission access denied. Librarian access is limited to records in the review queue.");
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

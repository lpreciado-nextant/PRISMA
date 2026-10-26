using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using System.Text.Json;

internal static class LibrarianRoleMigration
{
    private const string ScopedRole = "PRISMA Librarian";
    private const string GlobalRole = "PRISMA Global Librarian";

    public static void VerifyReads(IOrganizationService service)
    {
        using var own = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_GetSubmissions") {
            ["ReviewQueue"] = false, ["PageNumber"] = 1
        })["ResultJson"]);
        var librarian = own.RootElement.GetProperty("librarian").GetBoolean();
        Console.WriteLine($"Caller submission read succeeded; librarian scope available: {librarian}.");
        if (librarian)
        {
            using var queue = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_GetSubmissions") {
                ["ReviewQueue"] = true, ["PageNumber"] = 1
            })["ResultJson"]);
            Console.WriteLine($"Scoped review queue read succeeded: {queue.RootElement.GetProperty("records").GetArrayLength()} records on first page.");
        }
        var published = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false), TopCount = 10 };
        published.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
        published.Criteria.AddCondition("nx_publicationstatus", ConditionOperator.Equal, 125060000);
        published.AddOrder("nx_solutionid", OrderType.Ascending);
        var images = 0;
        var attachments = 0;
        foreach (var solution in service.RetrieveMultiple(published).Entities)
        {
            using var detail = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_GetPublishedDetail") {
                ["SolutionId"] = solution.Id, ["Present"] = false
            })["ResultJson"]);
            foreach (var media in detail.RootElement.GetProperty("media").EnumerateArray())
            {
                var kind = media.GetProperty("kind").GetString();
                var image = kind == "image" || kind == "thumbnail";
                if (!media.GetProperty("complete").GetBoolean() || (image ? images > 0 : attachments > 0)
                    || media.GetProperty("mime").GetString() == "application/vnd.prisma.link") continue;
                if (Guid.Parse(media.GetProperty("solutionId").GetString()!) != solution.Id)
                    throw new InvalidOperationException("Media response lacks the expected parent identity.");
                var size = media.GetProperty("size").GetInt32();
                var count = Math.Min(size, 1024);
                using var range = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_ReadVideoRange") {
                    ["SolutionId"] = solution.Id, ["AssetId"] = Guid.Parse(media.GetProperty("id").GetString()!),
                    ["Mode"] = image ? "image" : "published", ["Offset"] = 0, ["Count"] = count
                })["ResultJson"]);
                var result = range.RootElement;
                if (result.GetProperty("id").GetGuid() != solution.Id || result.GetProperty("assetId").GetString() != media.GetProperty("id").GetString()
                    || result.GetProperty("size").GetInt32() != size || result.GetProperty("mime").GetString() != media.GetProperty("mime").GetString()
                    || Convert.FromBase64String(result.GetProperty("content").GetString()!).Length != count)
                    throw new InvalidOperationException("Protected media read did not match its metadata.");
                if (image) images++; else attachments++;
                Console.WriteLine($"Verified protected {(image ? "image" : "attachment")} read: {count} bytes, expected parent/type/size.");
            }
            if (images > 0 && attachments > 0) break;
        }
        if (images == 0) throw new InvalidOperationException("No published image available for verification.");
        if (attachments == 0) Console.WriteLine("No downloadable published attachment found in the sampled solutions; attachment acceptance remains open.");
        Console.WriteLine("Read-only verification completed. This privileged-account check is not least-privilege acceptance.");
    }

    public static void Run(IOrganizationService service, bool execute)
    {
        var roleQuery = new QueryExpression("role") { ColumnSet = new ColumnSet("businessunitid", "ismanaged") };
        roleQuery.Criteria.AddCondition("name", ConditionOperator.Equal, ScopedRole);
        var roles = All(service, roleQuery).ToList();
        if (roles.Count == 0 || roles.Any(role => role.GetAttributeValue<bool>("ismanaged")))
            throw new InvalidOperationException("Expected existing unmanaged PRISMA Librarian roles. No changes made.");

        var privileges = new Dictionary<Guid, bool>();
        foreach (var table in new[] { "nx_solution", "nx_solutioncontributor", "nx_demoasset", "nx_solutionimage" })
        {
            var metadata = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
                LogicalName = table, EntityFilters = EntityFilters.Privileges
            })).EntityMetadata;
            foreach (var privilege in metadata.Privileges)
                privileges[privilege.PrivilegeId] = privilege.PrivilegeType == PrivilegeType.Read
                    || (table == "nx_solution" && new[] { PrivilegeType.Create, PrivilegeType.Write, PrivilegeType.Append, PrivilegeType.AppendTo }.Contains(privilege.PrivilegeType))
                    || (table == "nx_solutioncontributor" && new[] { PrivilegeType.Create, PrivilegeType.Write, PrivilegeType.Delete, PrivilegeType.Append }.Contains(privilege.PrivilegeType));
        }
        var roleChanges = new List<OrganizationRequest>();
        foreach (var role in roles)
        {
            var existing = ((RetrieveRolePrivilegesRoleResponse)service.Execute(new RetrieveRolePrivilegesRoleRequest { RoleId = role.Id })).RolePrivileges;
            foreach (var privilege in existing.Where(privilege => privileges.ContainsKey(privilege.PrivilegeId)))
                roleChanges.Add(new RemovePrivilegeRoleRequest { RoleId = role.Id, PrivilegeId = privilege.PrivilegeId });
            roleChanges.Add(new AddPrivilegesRoleRequest {
                RoleId = role.Id,
                Privileges = privileges.Where(pair => pair.Value).Select(pair => new RolePrivilege((int)PrivilegeDepth.Basic, pair.Key)).ToArray()
            });
            Console.WriteLine($"{ScopedRole} {role.Id}: replace solution/contributor/media privileges with Basic depth; remove unsupported operations. Preserve all other privileges.");
        }

        var mediaChanges = new List<OrganizationRequest>();
        var sessions = new QueryExpression("nx_uploadsession") { ColumnSet = new ColumnSet("nx_parentid", "nx_targetid", "nx_callerid", "nx_kind") };
        sessions.Criteria.AddCondition("nx_complete", ConditionOperator.Equal, true);
        foreach (var session in All(service, sessions))
        {
            var parentId = Guid.Parse(session.GetAttributeValue<string>("nx_parentid"));
            var uploader = Guid.Parse(session.GetAttributeValue<string>("nx_callerid"));
            var owner = service.Retrieve("nx_solution", parentId, new ColumnSet("ownerid")).GetAttributeValue<EntityReference>("ownerid");
            if (owner == null) throw new InvalidOperationException("Media parent has no owner.");
            if (owner.LogicalName == "systemuser" && owner.Id == uploader) continue;
            var table = session.GetAttributeValue<string>("nx_kind") == "attachment" ? "nx_demoasset" : "nx_solutionimage";
            var target = new EntityReference(table, Guid.Parse(session.GetAttributeValue<string>("nx_targetid")));
            var shares = ((RetrieveSharedPrincipalsAndAccessResponse)service.Execute(new RetrieveSharedPrincipalsAndAccessRequest { Target = target })).PrincipalAccesses;
            if (shares.Any(share => share.Principal.LogicalName == "systemuser" && share.Principal.Id == uploader))
            {
                mediaChanges.Add(new RevokeAccessRequest { Target = target, Revokee = new EntityReference("systemuser", uploader) });
                Console.WriteLine($"{table} {target.Id}: revoke historical non-owner uploader {uploader}; scoped API access replaces the permanent share.");
            }
            if (!shares.Any(share => share.Principal.LogicalName == owner.LogicalName && share.Principal.Id == owner.Id && (share.AccessMask & AccessRights.ReadAccess) != 0))
            {
                Console.WriteLine($"{table} {target.Id}: grant read to solution owner {owner.LogicalName} {owner.Id}.");
                mediaChanges.Add(new GrantAccessRequest { Target = target, PrincipalAccess = new PrincipalAccess { Principal = owner, AccessMask = AccessRights.ReadAccess } });
            }
        }

        var rootQuery = new QueryExpression("businessunit") { ColumnSet = new ColumnSet(false) };
        rootQuery.Criteria.AddCondition("parentbusinessunitid", ConditionOperator.Null);
        var root = service.RetrieveMultiple(rootQuery).Entities.Single().Id;
        var globalQuery = new QueryExpression("role") { ColumnSet = new ColumnSet(false) };
        globalQuery.Criteria.AddCondition("name", ConditionOperator.Equal, GlobalRole);
        globalQuery.Criteria.AddCondition("businessunitid", ConditionOperator.Equal, root);
        var global = service.RetrieveMultiple(globalQuery).Entities.SingleOrDefault();
        Console.WriteLine($"{GlobalRole}: {(global == null ? "create an unassigned marker role" : "preserve existing role and assignments")}; grant no organization-wide data privileges.");
        Console.WriteLine("Deploy the scoped plug-in and connected image client FIRST. No user/team/profile assignments are made by this command.");
        Console.WriteLine("Acceptance must separately audit additive roles, team membership and ad-hoc shares. Platform administrators remain privileged.");
        if (!execute) { Console.WriteLine("Read-only preview. No changes made."); return; }

        // Role removal and replacement must be atomic; AddPrivilegesRole alone cannot safely lower existing depth.
        if (roleChanges.Count > 1000) throw new InvalidOperationException("Too many role changes for one transaction.");
        var requests = new OrganizationRequestCollection();
        requests.AddRange(roleChanges);
        service.Execute(new ExecuteTransactionRequest { Requests = requests, ReturnResponses = false });
        foreach (var request in mediaChanges) service.Execute(request);
        if (global == null)
        {
            var id = service.Create(new Entity("role") { ["name"] = GlobalRole, ["businessunitid"] = new EntityReference("businessunit", root) });
            service.Execute(new AddSolutionComponentRequest { ComponentId = id, ComponentType = 20, SolutionUniqueName = "PRISMA_Dev", AddRequiredComponents = false });
        }
        foreach (var role in roles)
        {
            var actual = ((RetrieveRolePrivilegesRoleResponse)service.Execute(new RetrieveRolePrivilegesRoleRequest { RoleId = role.Id })).RolePrivileges;
            if (actual.Any(privilege => privileges.TryGetValue(privilege.PrivilegeId, out var allowed) && (!allowed || privilege.Depth != PrivilegeDepth.Basic))
                || privileges.Where(pair => pair.Value).Any(pair => !actual.Any(privilege => privilege.PrivilegeId == pair.Key && privilege.Depth == PrivilegeDepth.Basic)))
                throw new InvalidOperationException("Librarian privilege verification failed.");
        }
        Console.WriteLine("Verified Basic-depth PRISMA librarian table privileges. Complete cross-account acceptance before declaring scoped access live.");
    }

    private static IEnumerable<Entity> All(IOrganizationService service, QueryExpression query)
    {
        query.PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 };
        query.AddOrder(query.EntityName + "id", OrderType.Ascending);
        while (true)
        {
            var page = service.RetrieveMultiple(query);
            foreach (var row in page.Entities) yield return row;
            if (!page.MoreRecords) yield break;
            query.PageInfo.PageNumber++;
            query.PageInfo.PagingCookie = page.PagingCookie;
        }
    }
}

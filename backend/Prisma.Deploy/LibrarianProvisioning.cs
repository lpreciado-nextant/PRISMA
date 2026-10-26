using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

internal static class LibrarianProvisioning
{
    private const string ScopedRole = "PRISMA Librarian";
    private const string GlobalRole = "PRISMA Global Librarian";
    private const string Profile = "PRISMA Core Draft Librarian";
    private const string Readers = "PRISMA Published Readers";

    public static void Run(IOrganizationService service, string[] options)
    {
        var owners = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var globals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var execute = false;
        for (var index = 0; index < options.Length; index++)
        {
            var option = options[index];
            if (option == "--execute" && !execute) { execute = true; continue; }
            if ((option != "--owner" && option != "--global") || index + 1 >= options.Length || !options[index + 1].Contains('@'))
                throw new ArgumentException("Use librarian-provision [--owner <email>] [--global <email>] [--execute]. No recipients: read-only inventory.");
            var email = options[++index].Trim();
            if (!(option == "--owner" ? owners : globals).Add(email)) throw new ArgumentException($"Duplicate {option} recipient.");
        }
        if (execute && owners.Count + globals.Count == 0) throw new ArgumentException("Execution requires explicitly named recipients.");
        var identity = (WhoAmIResponse)service.Execute(new WhoAmIRequest());
        var current = service.Retrieve("systemuser", identity.UserId, new ColumnSet("fullname", "internalemailaddress"));
        Console.WriteLine($"Deploying account: {current.GetAttributeValue<string>("fullname")} <{current.GetAttributeValue<string>("internalemailaddress")}>.");

        var capabilities = new QueryExpression("nx_capability") { ColumnSet = new ColumnSet("nx_capabilityname", "nx_capabilityowner", "nx_specializationarea") };
        capabilities.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
        var eligible = new Dictionary<string, Entity>(StringComparer.OrdinalIgnoreCase);
        var ownedAreas = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var capability in All(service, capabilities))
        {
            var name = capability.GetAttributeValue<string>("nx_capabilityname");
            var personRef = capability.GetAttributeValue<EntityReference>("nx_capabilityowner");
            var areaRef = capability.GetAttributeValue<EntityReference>("nx_specializationarea");
            if (personRef == null || areaRef == null)
            {
                Console.WriteLine($"UNMAPPED capability: {name}; {(personRef == null ? "owner" : "SA")} missing. No assignment proposed.");
                continue;
            }
            var person = service.Retrieve("cr6b0_consultant", personRef.Id, new ColumnSet("cr6b0_consultantname", "cr6b0_email", "statecode"));
            var area = service.Retrieve("nx_specializationarea", areaRef.Id, new ColumnSet("nx_specializationareaname", "statecode"));
            var email = person.GetAttributeValue<string>("cr6b0_email")?.Trim();
            if (person.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0 || area.GetAttributeValue<OptionSetValue>("statecode")?.Value != 0 || string.IsNullOrWhiteSpace(email))
            {
                Console.WriteLine($"BLOCKED capability: {name}; inactive Consultant/SA or missing Consultant email. No assignment proposed.");
                continue;
            }
            var matches = Matching(service, "cr6b0_consultant", "cr6b0_email", email, new ColumnSet(false), "statecode", 0);
            var users = Matching(service, "systemuser", "internalemailaddress", email, UserColumns(), "isdisabled", false);
            if (matches.Count != 1 || matches[0].Id != person.Id || users.Count != 1 || users[0].Contains("applicationid"))
            {
                Console.WriteLine($"BLOCKED owner: {person.GetAttributeValue<string>("cr6b0_consultantname")} <{email}>; active Consultants={matches.Count}, enabled human-user matches={users.Count}. No assignment proposed.");
                if (users.Count == 0)
                {
                    var account = new QueryExpression("systemuser") { ColumnSet = new ColumnSet("isdisabled", "internalemailaddress"), TopCount = 3 };
                    account.Criteria.FilterOperator = LogicalOperator.Or;
                    account.Criteria.AddCondition("internalemailaddress", ConditionOperator.Equal, email);
                    account.Criteria.AddCondition("domainname", ConditionOperator.Equal, email);
                    var existing = service.RetrieveMultiple(account).Entities;
                    Console.WriteLine(existing.Count == 0 ? "  No Dataverse user matches this email or sign-in name; environment onboarding is required."
                        : $"  Existing user records: {existing.Count}; disabled: {existing.Count(row => row.GetAttributeValue<bool>("isdisabled"))}; verify identity/enabled state before provisioning.");
                }
                continue;
            }
            eligible[email] = users[0];
            if (!ownedAreas.TryGetValue(email, out var areas)) ownedAreas[email] = areas = new HashSet<string>();
            areas.Add(area.GetAttributeValue<string>("nx_specializationareaname") ?? area.Id.ToString());
        }
        foreach (var pair in eligible.OrderBy(pair => pair.Key))
        {
            Console.WriteLine($"OWNER: {pair.Value.GetAttributeValue<string>("fullname")} <{pair.Key}>; SAs: {string.Join(", ", ownedAreas[pair.Key].OrderBy(value => value))}; "
                + $"librarian role={Has(service, pair.Value.Id, "role", ScopedRole)}; profile={Has(service, pair.Value.Id, "fieldsecurityprofile", Profile)}; readers={Reader(service, pair.Value.Id)}; global={Has(service, pair.Value.Id, "role", GlobalRole)}.");
        }
        Console.WriteLine($"Current account: librarian role={Has(service, identity.UserId, "role", ScopedRole)}; profile={Has(service, identity.UserId, "fieldsecurityprofile", Profile)}; readers={Reader(service, identity.UserId)}; global={Has(service, identity.UserId, "role", GlobalRole)}.");
        if (owners.Count + globals.Count == 0) { Console.WriteLine("Read-only inventory. No assignments changed."); return; }

        var targets = new Dictionary<string, Entity>(StringComparer.OrdinalIgnoreCase);
        foreach (var email in owners)
        {
            if (!eligible.TryGetValue(email, out var user)) throw new InvalidOperationException($"Selected owner {email} has no unique eligible active capability mapping.");
            targets[email] = user;
        }
        foreach (var email in globals)
        {
            var users = Matching(service, "systemuser", "internalemailaddress", email, UserColumns(), "isdisabled", false);
            if (users.Count != 1 || users[0].Contains("applicationid")) throw new InvalidOperationException($"Global recipient {email} must resolve to exactly one enabled human user.");
            targets[email] = users[0];
        }
        var profile = Unique(service, "fieldsecurityprofile", Profile);
        var readers = Unique(service, "team", Readers, columns: new ColumnSet("teamtype"));
        if (readers.GetAttributeValue<OptionSetValue>("teamtype")?.Value != 0) throw new InvalidOperationException("Published Readers must be an owner team.");
        var requests = new OrganizationRequestCollection();
        var before = new Dictionary<Guid, Dictionary<string, HashSet<Guid>>>();
        foreach (var pair in targets.OrderBy(pair => pair.Key))
        {
            var user = pair.Value;
            before[user.Id] = Memberships(service, user.Id);
            var unit = user.GetAttributeValue<EntityReference>("businessunitid")?.Id ?? throw new InvalidOperationException("User business unit is missing.");
            var roles = globals.Contains(pair.Key) ? new[] { ScopedRole, GlobalRole } : new[] { ScopedRole };
            foreach (var role in roles)
                Plan(requests, user, pair.Key, Unique(service, "role", role, unit), "systemuserroles_association", Has(service, user.Id, "role", role), role);
            Plan(requests, user, pair.Key, profile, "systemuserprofiles_association", Has(service, user.Id, "fieldsecurityprofile", Profile), Profile);
            if (!Reader(service, user.Id))
            {
                Console.WriteLine($"ADD: {pair.Key} -> team {Readers}");
                requests.Add(new AddMembersTeamRequest { TeamId = readers.Id, MemberIds = new[] { user.Id } });
            }
        }
        Console.WriteLine($"{requests.Count} additive associations planned. No role/profile definitions, ownership, schema, app sharing, licences or existing assignments will change.");
        if (!execute) { Console.WriteLine("Read-only preview. --execute requires approval of these named recipients and assignments."); return; }
        if (requests.Count > 1000) throw new InvalidOperationException("Too many assignments for one transaction.");
        if (requests.Count > 0) service.Execute(new ExecuteTransactionRequest { Requests = requests, ReturnResponses = false });
        foreach (var pair in targets)
        {
            var user = pair.Value;
            var after = Memberships(service, user.Id);
            if (before[user.Id].Any(entry => !entry.Value.IsSubsetOf(after[entry.Key]))
                || !Has(service, user.Id, "role", ScopedRole) || !Has(service, user.Id, "fieldsecurityprofile", Profile) || !Reader(service, user.Id)
                || (globals.Contains(pair.Key) && !Has(service, user.Id, "role", GlobalRole)))
                throw new InvalidOperationException($"Assignment verification failed for {pair.Key}; inspect before retrying.");
            Console.WriteLine($"VERIFIED: {pair.Key}; required role/profile/readers access present; global={(globals.Contains(pair.Key) ? "assigned" : "not requested")}; prior direct memberships preserved.");
        }
    }

    private static void Plan(OrganizationRequestCollection requests, Entity user, string email, Entity target, string relationship, bool effective, string label)
    {
        if (effective) { Console.WriteLine($"Already effective: {email} -> {label}"); return; }
        Console.WriteLine($"ADD: {email} -> {label}");
        requests.Add(new AssociateRequest { Target = user.ToEntityReference(), Relationship = new Relationship(relationship), RelatedEntities = new EntityReferenceCollection { target.ToEntityReference() } });
    }

    private static bool Has(IOrganizationService service, Guid user, string table, string name)
    {
        var member = table == "role" ? "roles" : "profiles";
        var id = table + "id";
        foreach (var team in new[] { false, true })
        {
            var query = new QueryExpression(table) { ColumnSet = new ColumnSet(false), TopCount = 1 };
            query.Criteria.AddCondition("name", ConditionOperator.Equal, name);
            var link = query.AddLink((team ? "team" : "systemuser") + member, id, id);
            if (team) link = link.AddLink("teammembership", "teamid", "teamid");
            link.LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            if (service.RetrieveMultiple(query).Entities.Count != 0) return true;
        }
        return false;
    }

    private static bool Reader(IOrganizationService service, Guid user)
    {
        var query = new QueryExpression("team") { ColumnSet = new ColumnSet(false), TopCount = 1 };
        query.Criteria.AddCondition("name", ConditionOperator.Equal, Readers);
        query.AddLink("teammembership", "teamid", "teamid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
        return service.RetrieveMultiple(query).Entities.Count != 0;
    }

    private static Dictionary<string, HashSet<Guid>> Memberships(IOrganizationService service, Guid user)
    {
        var result = new Dictionary<string, HashSet<Guid>>();
        foreach (var definition in new[] { (Table: "systemuserroles", Column: "roleid"), (Table: "systemuserprofiles", Column: "fieldsecurityprofileid"), (Table: "teammembership", Column: "teamid") })
        {
            var query = new QueryExpression(definition.Table) { ColumnSet = new ColumnSet(definition.Column), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
            query.Criteria.AddCondition("systemuserid", ConditionOperator.Equal, user);
            query.AddOrder(definition.Column, OrderType.Ascending);
            var members = new HashSet<Guid>();
            while (true)
            {
                var page = service.RetrieveMultiple(query);
                foreach (var row in page.Entities) members.Add(row.GetAttributeValue<Guid>(definition.Column));
                if (!page.MoreRecords) break;
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            result[definition.Table] = members;
        }
        return result;
    }

    private static Entity Unique(IOrganizationService service, string table, string name, Guid? unit = null, ColumnSet? columns = null)
    {
        var query = new QueryExpression(table) { ColumnSet = columns ?? new ColumnSet(false), TopCount = 2 };
        query.Criteria.AddCondition("name", ConditionOperator.Equal, name);
        if (unit.HasValue) query.Criteria.AddCondition("businessunitid", ConditionOperator.Equal, unit.Value);
        var rows = service.RetrieveMultiple(query).Entities;
        if (rows.Count != 1) throw new InvalidOperationException($"Expected one {table} named {name} in the required scope.");
        return rows[0];
    }

    private static List<Entity> Matching(IOrganizationService service, string table, string column, string value, ColumnSet columns, string activeColumn, object activeValue)
    {
        var query = new QueryExpression(table) { ColumnSet = columns, TopCount = 2 };
        query.Criteria.AddCondition(column, ConditionOperator.Equal, value);
        query.Criteria.AddCondition(activeColumn, ConditionOperator.Equal, activeValue);
        return service.RetrieveMultiple(query).Entities.ToList();
    }

    private static ColumnSet UserColumns() { return new ColumnSet("fullname", "internalemailaddress", "businessunitid", "applicationid"); }

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

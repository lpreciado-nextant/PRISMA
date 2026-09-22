using System.Reflection;
using System.Text.Json;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;

const string organizationUrl = "https://nextantpulse.crm.dynamics.com";
const string solutionName = "PRISMA_Dev";
var organizationId = Guid.Parse("cd98dcb3-db3b-f011-be51-00224820bb36");
var command = args.FirstOrDefault() ?? "inspect";
if (!new[] { "inspect", "apply", "smoke", "smoke-graph", "smoke-media", "smoke-review", "smoke-delete" }.Contains(command)) throw new ArgumentException("Use inspect, apply, smoke, smoke-graph, smoke-media, smoke-review or smoke-delete.");
using var client = new ServiceClient($"AuthType=OAuth;Url={organizationUrl};AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;RedirectUri=http://localhost;LoginPrompt=Auto;RequireNewInstance=True");
if (!client.IsReady) throw new InvalidOperationException("Dataverse sign-in failed. " + client.LastError);
var identity = (WhoAmIResponse)client.Execute(new WhoAmIRequest());
if (identity.OrganizationId != organizationId) throw new InvalidOperationException("Refusing to operate against a different organization.");
Console.WriteLine($"Verified Nextant Pulse organization {identity.OrganizationId}; command {command}.");
if (command == "inspect") return;
if (command == "smoke") { Smoke(client); return; }
if (command == "smoke-graph") { SmokeGraph(client); return; }
if (command == "smoke-media") { SmokeMedia(client); return; }
if (command == "smoke-review") { SmokeReview(client); return; }
if (command == "smoke-delete") { SmokeDelete(client); return; }

var existingAssembly = Find(client, "pluginassembly", "name", "Prisma.Plugins");
var solutionMetadata = Metadata(client, "nx_solution");
if (solutionMetadata.IsOptimisticConcurrencyEnabled != true)
    throw new InvalidOperationException("Solution optimistic concurrency is disabled. Resolve this before deployment.");
if (existingAssembly == null && client.RetrieveMultiple(new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false), TopCount = 1 }).Entities.Count != 0)
    throw new InvalidOperationException("Solution rows now exist. Review the rollout before installing direct-write guards.");
var assemblyPath = Path.GetFullPath(args.Length > 1 ? args[1] : "backend/Prisma.Plugins/bin/Release/net462/Prisma.Plugins.dll");
var assemblyName = AssemblyName.GetAssemblyName(assemblyPath);
if (assemblyName.Name != "Prisma.Plugins") throw new InvalidOperationException("Unexpected plug-in assembly.");
var assembly = new Entity("pluginassembly") {
    ["name"] = assemblyName.Name,
    ["version"] = assemblyName.Version!.ToString(),
    ["culture"] = "neutral",
    ["publickeytoken"] = Convert.ToHexString(assemblyName.GetPublicKeyToken()!).ToLowerInvariant(),
    ["isolationmode"] = new OptionSetValue(2),
    ["sourcetype"] = new OptionSetValue(0),
    ["content"] = Convert.ToBase64String(File.ReadAllBytes(assemblyPath))
};
var assemblyId = Save(client, assembly, existingAssembly);
AddComponent(client, assemblyId, 91);
var apiType = PluginType(client, assemblyId, "Prisma.Plugins.DraftApi");
var guardType = PluginType(client, assemblyId, "Prisma.Plugins.SolutionWriteGuard");
foreach (var message in new[] { "Create", "Update", "Delete", "Assign", "SetState" }) RegisterGuard(client, guardType, message);
var graphType = PluginType(client, assemblyId, "Prisma.Plugins.DraftGraphApi");
var graphGuard = PluginType(client, assemblyId, "Prisma.Plugins.DraftGraphGuard");
foreach (var message in new[] { "Create", "Update", "Delete", "Assign", "SetState" }) RegisterGuard(client, graphGuard, message, "nx_solutioncontributor");
foreach (var message in new[] { "Associate", "Disassociate" }) RegisterGuard(client, graphGuard, message, null);

foreach (var column in new[] { "nx_reviewoutcome", "nx_reviewcomments" })
{
    var metadata = ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_solution", LogicalName = column, RetrieveAsIfPublished = true })).AttributeMetadata;
    if (metadata.IsSecured != true)
    {
        metadata.IsSecured = true;
        client.Execute(new UpdateAttributeRequest { EntityName = "nx_solution", Attribute = metadata, SolutionUniqueName = solutionName, MergeLabels = false });
    }
}
var capability = ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_solution", LogicalName = "nx_capability", RetrieveAsIfPublished = true })).AttributeMetadata;
if (capability.RequiredLevel.Value != AttributeRequiredLevel.None)
{
    capability.RequiredLevel = new AttributeRequiredLevelManagedProperty(AttributeRequiredLevel.None);
    client.Execute(new UpdateAttributeRequest { EntityName = "nx_solution", Attribute = capability, SolutionUniqueName = solutionName, MergeLabels = false });
}
client.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_solution</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>" });

var businessUnitQuery = new QueryExpression("businessunit") { ColumnSet = new ColumnSet(false) };
businessUnitQuery.Criteria.AddCondition("parentbusinessunitid", ConditionOperator.Null);
var rootBusinessUnit = client.RetrieveMultiple(businessUnitQuery).Entities.Single().Id;
EnsureMediaSchema(client, rootBusinessUnit);
foreach (var roleName in new[] { "PRISMA Contributor", "PRISMA CSM", "PRISMA Librarian" })
{
    var existingRole = Find(client, "role", "name", roleName);
    if (existingRole != null && existingAssembly == null) throw new InvalidOperationException($"Role {roleName} already exists; review it instead of changing it.");
    var roleId = existingRole?.Id ?? Create(client, new Entity("role") { ["name"] = roleName, ["businessunitid"] = new EntityReference("businessunit", rootBusinessUnit) });
    var privileges = new List<RolePrivilege>();
    foreach (var privilege in solutionMetadata.Privileges)
    {
        var allowed = privilege.PrivilegeType == PrivilegeType.Read ||
            (roleName != "PRISMA CSM" && new[] { PrivilegeType.Create, PrivilegeType.Write, PrivilegeType.Append }.Contains(privilege.PrivilegeType));
        if (allowed) privileges.Add(new RolePrivilege((int)(roleName == "PRISMA Librarian" ? PrivilegeDepth.Global : PrivilegeDepth.Basic), privilege.PrivilegeId));
    }
    foreach (var table in new[] { "nx_specializationarea", "nx_capability", "nx_technology", "nx_industry" })
        foreach (var privilege in Metadata(client, table).Privileges)
            if (privilege.PrivilegeType == PrivilegeType.Read || (roleName != "PRISMA CSM" && privilege.PrivilegeType == PrivilegeType.AppendTo))
                privileges.Add(new RolePrivilege((int)PrivilegeDepth.Global, privilege.PrivilegeId));
    foreach (var privilege in Metadata(client, "nx_solutioncontributor").Privileges)
    {
        var allowed = privilege.PrivilegeType == PrivilegeType.Read ||
            (roleName != "PRISMA CSM" && new[] { PrivilegeType.Create, PrivilegeType.Write, PrivilegeType.Delete, PrivilegeType.Append }.Contains(privilege.PrivilegeType));
        if (allowed) privileges.Add(new RolePrivilege((int)(roleName == "PRISMA Librarian" ? PrivilegeDepth.Global : PrivilegeDepth.Basic), privilege.PrivilegeId));
    }
    foreach (var table in new[] { "nx_demoasset", "nx_solutionimage" })
        foreach (var privilege in Metadata(client, table).Privileges.Where(privilege => privilege.PrivilegeType == PrivilegeType.Read))
            privileges.Add(new RolePrivilege((int)(roleName == "PRISMA Librarian" ? PrivilegeDepth.Global : PrivilegeDepth.Basic), privilege.PrivilegeId));
    if (roleName != "PRISMA CSM")
        foreach (var privilege in solutionMetadata.Privileges.Where(privilege => privilege.PrivilegeType == PrivilegeType.AppendTo))
            privileges.Add(new RolePrivilege((int)(roleName == "PRISMA Librarian" ? PrivilegeDepth.Global : PrivilegeDepth.Basic), privilege.PrivilegeId));
    client.Execute(new AddPrivilegesRoleRequest { RoleId = roleId, Privileges = privileges.ToArray() });
    AddComponent(client, roleId, 20);
    var profileName = roleName == "PRISMA Librarian" ? "PRISMA Core Draft Librarian" : roleName;
    var profileId = Find(client, "fieldsecurityprofile", "name", profileName)?.Id ?? Create(client, new Entity("fieldsecurityprofile") { ["name"] = profileName, ["description"] = "PRISMA core draft access; no automatic user assignments." });
    foreach (var column in new[] { "nx_publicationstatus", "nx_clientsafereviewed", "nx_reviewoutcome", "nx_reviewcomments" })
    {
        var read = roleName != "PRISMA CSM" || column == "nx_publicationstatus" || column == "nx_clientsafereviewed";
        var query = new QueryExpression("fieldpermission") { ColumnSet = new ColumnSet(false) };
        query.Criteria.AddCondition("fieldsecurityprofileid", ConditionOperator.Equal, profileId);
        query.Criteria.AddCondition("entityname", ConditionOperator.Equal, "nx_solution");
        query.Criteria.AddCondition("attributelogicalname", ConditionOperator.Equal, column);
        var existing = client.RetrieveMultiple(query).Entities.SingleOrDefault();
        Save(client, new Entity("fieldpermission") {
            ["fieldsecurityprofileid"] = new EntityReference("fieldsecurityprofile", profileId),
            ["entityname"] = "nx_solution", ["attributelogicalname"] = column,
            ["canread"] = new OptionSetValue(read ? 4 : 0), ["cancreate"] = new OptionSetValue(0), ["canupdate"] = new OptionSetValue(0)
        }, existing);
    }
    AddComponent(client, profileId, 70);
    Console.WriteLine($"Configured {roleName} and {profileName}; no users or teams assigned.");
}
RegisterApi(client, apiType, "nx_SaveCoreDraft", "prvCreatenx_Solution", new[] {
    ("DraftJson", 10, false), ("SolutionId", 12, true), ("ExpectedRowVersion", 10, true)
});
RegisterApi(client, apiType, "nx_GetMyCoreDrafts", "prvReadnx_Solution", new[] {
    ("PageNumber", 7, true), ("PagingCookie", 10, true)
});
RegisterApi(client, graphType, "nx_GetDraftGraph", "prvReadnx_Solution", new[] { ("SolutionId", 12, false) });
RegisterApi(client, graphType, "nx_SaveDraftGraph", "prvWritenx_Solution", new[] {
    ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("GraphJson", 10, false)
});
var mediaType = PluginType(client, assemblyId, "Prisma.Plugins.MediaApi");
var retiredProbe = Find(client, "customapi", "uniquename", "nx_VerifyMediaStaging");
if (retiredProbe != null) client.Delete("customapi", retiredProbe.Id);
var mediaGuard = PluginType(client, assemblyId, "Prisma.Plugins.MediaWriteGuard");
foreach (var table in new[] { "nx_demoasset", "nx_solutionimage", "nx_uploadsession" })
    foreach (var message in table == "nx_uploadsession" ? new[] { "Create", "Update", "Delete" } : new[] { "Create", "Update", "Delete", "Assign", "SetState" })
        RegisterGuard(client, mediaGuard, message, table);
RegisterApi(client, mediaType, "nx_GetDraftMedia", "prvReadnx_Solution", new[] { ("SolutionId", 12, false) });
RegisterApi(client, mediaType, "nx_BeginMediaUpload", "prvWritenx_Solution", new[] {
    ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("Kind", 10, false), ("FileName", 10, false), ("Size", 7, false)
});
RegisterApi(client, mediaType, "nx_UploadMediaBlock", "prvWritenx_Solution", new[] {
    ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("SessionId", 12, false), ("BlockIndex", 7, false), ("Content", 10, false)
});
foreach (var name in new[] { "nx_FinishMediaUpload", "nx_RemoveDraftMedia" })
    RegisterApi(client, mediaType, name, "prvWritenx_Solution", new[] { ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("SessionId", 12, false) });
var readersId = Find(client, "team", "name", "PRISMA Published Readers")?.Id ?? client.Create(new Entity("team") {
    ["name"] = "PRISMA Published Readers", ["businessunitid"] = new EntityReference("businessunit", rootBusinessUnit), ["teamtype"] = new OptionSetValue(0)
});
var csmRole = Find(client, "role", "name", "PRISMA CSM")!.Id;
var readerRoles = new QueryExpression("teamroles") { ColumnSet = new ColumnSet(false) };
readerRoles.Criteria.AddCondition("teamid", ConditionOperator.Equal, readersId);
readerRoles.Criteria.AddCondition("roleid", ConditionOperator.Equal, csmRole);
if (client.RetrieveMultiple(readerRoles).Entities.Count == 0)
    client.Associate("team", readersId, new Relationship("teamroles_association"), new EntityReferenceCollection { new EntityReference("role", csmRole) });
var reviewType = PluginType(client, assemblyId, "Prisma.Plugins.ReviewApi");
RegisterApi(client, reviewType, "nx_GetSubmissions", "prvReadnx_Solution", new[] { ("ReviewQueue", 0, false), ("PageNumber", 7, true), ("PagingCookie", 10, true) });
RegisterApi(client, reviewType, "nx_GetSubmission", "prvReadnx_Solution", new[] { ("SolutionId", 12, false) });
RegisterApi(client, reviewType, "nx_TransitionSubmission", "prvWritenx_Solution", new[] {
    ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("Action", 10, false), ("Comments", 10, true), ("Cleared", 0, true)
});
var publishedType = PluginType(client, assemblyId, "Prisma.Plugins.PublishedApi");
RegisterApi(client, publishedType, "nx_GetPublishedDetail", "prvReadnx_Solution", new[] { ("SolutionId", 12, false), ("Present", 0, false) });
Console.WriteLine("Draft graph and media APIs/guards registered. Application roles remain unassigned. No code app was published.");

static void EnsureMediaSchema(IOrganizationService service, Guid businessUnit)
{
    var tables = ((RetrieveAllEntitiesResponse)service.Execute(new RetrieveAllEntitiesRequest { EntityFilters = EntityFilters.Entity, RetrieveAsIfPublished = true })).EntityMetadata;
    if (!tables.Any(table => table.LogicalName == "nx_uploadsession"))
        service.Execute(new CreateEntityRequest {
            SolutionUniqueName = "PRISMA_Dev", HasActivities = false, HasNotes = false,
            Entity = new EntityMetadata {
                SchemaName = "nx_UploadSession", DisplayName = new Label("PRISMA Upload Session", 1033),
                DisplayCollectionName = new Label("PRISMA Upload Sessions", 1033),
                Description = new Label("Private server-side upload protocol state. Never grant application users table privileges.", 1033),
                OwnershipType = OwnershipTypes.OrganizationOwned, IsActivity = false
            },
            PrimaryAttribute = new StringAttributeMetadata { SchemaName = "nx_Name", DisplayName = new Label("Name", 1033), MaxLength = 100, RequiredLevel = new AttributeRequiredLevelManagedProperty(AttributeRequiredLevel.ApplicationRequired) }
        });
    var attributes = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest { LogicalName = "nx_uploadsession", EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = true })).EntityMetadata.Attributes;
    var fields = new List<AttributeMetadata>();
    foreach (var field in new[] { "ParentId", "CallerId", "TargetId" }) fields.Add(new StringAttributeMetadata { SchemaName = "nx_" + field, MaxLength = 36 });
    fields.Add(new StringAttributeMetadata { SchemaName = "nx_Kind", MaxLength = 20 });
    fields.Add(new StringAttributeMetadata { SchemaName = "nx_FileName", MaxLength = 200 });
    fields.Add(new StringAttributeMetadata { SchemaName = "nx_Mime", MaxLength = 120 });
    fields.Add(new MemoAttributeMetadata { SchemaName = "nx_Token", MaxLength = 10000 });
    foreach (var field in new[] { "Bytes", "Received", "NextBlock" }) fields.Add(new IntegerAttributeMetadata { SchemaName = "nx_" + field, MinValue = 0, MaxValue = 524288000 });
    fields.Add(new DateTimeAttributeMetadata { SchemaName = "nx_Expires", Format = DateTimeFormat.DateAndTime, DateTimeBehavior = DateTimeBehavior.TimeZoneIndependent });
    fields.Add(new BooleanAttributeMetadata { SchemaName = "nx_Complete", DefaultValue = false, OptionSet = new BooleanOptionSetMetadata(new OptionMetadata(new Label("Yes", 1033), 1), new OptionMetadata(new Label("No", 1033), 0)) });
    foreach (var field in fields.Where(field => !attributes.Any(existing => existing.LogicalName == field.SchemaName.ToLowerInvariant())))
    {
        field.DisplayName = new Label(field.SchemaName.Substring(3), 1033);
        service.Execute(new CreateAttributeRequest { EntityName = "nx_uploadsession", Attribute = field, SolutionUniqueName = "PRISMA_Dev" });
    }
    var teamId = Find(service, "team", "name", "PRISMA Media Custodian")?.Id ?? service.Create(new Entity("team") {
        ["name"] = "PRISMA Media Custodian", ["businessunitid"] = new EntityReference("businessunit", businessUnit), ["teamtype"] = new OptionSetValue(0)
    });
    var members = new QueryExpression("teammembership") { ColumnSet = new ColumnSet(false), TopCount = 1 };
    members.Criteria.AddCondition("teamid", ConditionOperator.Equal, teamId);
    if (service.RetrieveMultiple(members).Entities.Count != 0) throw new InvalidOperationException("Media custodian must have no members.");
    var roleId = Find(service, "role", "name", "PRISMA Media Custodian")?.Id ?? Create(service, new Entity("role") { ["name"] = "PRISMA Media Custodian", ["businessunitid"] = new EntityReference("businessunit", businessUnit) });
    var privileges = new[] { "nx_demoasset", "nx_solutionimage" }.SelectMany(table => Metadata(service, table).Privileges)
        .Where(privilege => privilege.PrivilegeType == PrivilegeType.Read).Select(privilege => new RolePrivilege((int)PrivilegeDepth.Basic, privilege.PrivilegeId)).ToArray();
    service.Execute(new AddPrivilegesRoleRequest { RoleId = roleId, Privileges = privileges });
    AddComponent(service, roleId, 20);
    var assigned = new QueryExpression("teamroles") { ColumnSet = new ColumnSet(false) };
    assigned.Criteria.AddCondition("teamid", ConditionOperator.Equal, teamId);
    assigned.Criteria.AddCondition("roleid", ConditionOperator.Equal, roleId);
    if (service.RetrieveMultiple(assigned).Entities.Count == 0)
        service.Associate("team", teamId, new Relationship("teamroles_association"), new EntityReferenceCollection { new EntityReference("role", roleId) });
    service.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_uploadsession</entity></entities></importexportxml>" });
    Console.WriteLine("Private media session schema and empty custodian team configured; application users remain unassigned.");
}

static EntityMetadata Metadata(IOrganizationService service, string table) => ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest {
    LogicalName = table, EntityFilters = EntityFilters.Entity | EntityFilters.Privileges, RetrieveAsIfPublished = true
})).EntityMetadata;

static Entity? Find(IOrganizationService service, string table, string field, object value)
{
    var query = new QueryExpression(table) { ColumnSet = new ColumnSet(false) };
    query.Criteria.AddCondition(field, ConditionOperator.Equal, value);
    var rows = service.RetrieveMultiple(query).Entities;
    if (rows.Count > 1) throw new InvalidOperationException($"Multiple {table} components match {field}; refusing an ambiguous change.");
    return rows.SingleOrDefault();
}

static Guid Create(IOrganizationService service, Entity entity)
{
    var request = new CreateRequest { Target = entity };
    request["SolutionUniqueName"] = "PRISMA_Dev";
    return ((CreateResponse)service.Execute(request)).id;
}

static Guid Save(IOrganizationService service, Entity entity, Entity? existing)
{
    if (existing == null) return Create(service, entity);
    entity.Id = existing.Id;
    service.Update(entity);
    return entity.Id;
}

static void AddComponent(IOrganizationService service, Guid identifier, int type) => service.Execute(new AddSolutionComponentRequest {
    ComponentId = identifier, ComponentType = type, SolutionUniqueName = "PRISMA_Dev", AddRequiredComponents = false
});

static Guid PluginType(IOrganizationService service, Guid assemblyId, string name)
{
    var query = new QueryExpression("plugintype") { ColumnSet = new ColumnSet(false) };
    query.Criteria.AddCondition("pluginassemblyid", ConditionOperator.Equal, assemblyId);
    query.Criteria.AddCondition("typename", ConditionOperator.Equal, name);
    return service.RetrieveMultiple(query).Entities.SingleOrDefault()?.Id ?? Create(service, new Entity("plugintype") {
        ["pluginassemblyid"] = new EntityReference("pluginassembly", assemblyId), ["typename"] = name, ["name"] = name, ["friendlyname"] = name
    });
}

static void RegisterGuard(IOrganizationService service, Guid guardType, string message, string? table = "nx_solution")
{
    var sdkMessage = Find(service, "sdkmessage", "name", message) ?? throw new InvalidOperationException($"Missing SDK message {message}.");
    EntityReference? filterReference = null;
    if (table != null)
    {
        var filter = new QueryExpression("sdkmessagefilter") { ColumnSet = new ColumnSet(false) };
        filter.Criteria.AddCondition("sdkmessageid", ConditionOperator.Equal, sdkMessage.Id);
        filter.Criteria.AddCondition("primaryobjecttypecode", ConditionOperator.Equal, table);
        filterReference = new EntityReference("sdkmessagefilter", service.RetrieveMultiple(filter).Entities.Single().Id);
    }
    var name = table == "nx_solution" ? "PRISMA.CoreDraft.Guard." + message : "PRISMA.Graph.Guard." + (table ?? "Relationships") + "." + message;
    var existing = Find(service, "sdkmessageprocessingstep", "name", name);
    var identifier = Save(service, new Entity("sdkmessageprocessingstep") {
        ["name"] = name, ["eventhandler"] = new EntityReference("plugintype", guardType),
        ["sdkmessageid"] = new EntityReference("sdkmessage", sdkMessage.Id), ["sdkmessagefilterid"] = filterReference,
        ["stage"] = new OptionSetValue(20), ["mode"] = new OptionSetValue(0), ["rank"] = 1, ["supporteddeployment"] = new OptionSetValue(0)
    }, existing);
    AddComponent(service, identifier, 92);
}

static void RegisterApi(IOrganizationService service, Guid pluginType, string name, string privilege, (string Name, int Type, bool Optional)[] parameters)
{
    var existing = Find(service, "customapi", "uniquename", name);
    var identifier = existing?.Id ?? Create(service, new Entity("customapi") {
        ["uniquename"] = name, ["name"] = name, ["displayname"] = name,
        ["description"] = "PRISMA authenticated core draft operation with server-enforced ownership and concurrency.",
        ["plugintypeid"] = new EntityReference("plugintype", pluginType), ["executeprivilegename"] = privilege,
        ["bindingtype"] = new OptionSetValue(0), ["allowedcustomprocessingsteptype"] = new OptionSetValue(0),
        ["isfunction"] = false, ["isprivate"] = false, ["iscustomizable"] = new BooleanManagedProperty(true)
    });
    foreach (var parameter in parameters)
    {
        var parameterName = name + "." + parameter.Name;
        if (Find(service, "customapirequestparameter", "name", parameterName) != null) continue;
        Create(service, new Entity("customapirequestparameter") {
            ["customapiid"] = new EntityReference("customapi", identifier), ["uniquename"] = parameter.Name,
            ["name"] = parameterName, ["displayname"] = parameter.Name, ["description"] = "PRISMA draft " + parameter.Name,
            ["type"] = new OptionSetValue(parameter.Type), ["isoptional"] = parameter.Optional
        });
    }
    if (Find(service, "customapiresponseproperty", "name", name + ".ResultJson") == null) Create(service, new Entity("customapiresponseproperty") {
        ["customapiid"] = new EntityReference("customapi", identifier), ["uniquename"] = "ResultJson",
        ["name"] = name + ".ResultJson", ["displayname"] = "ResultJson", ["description"] = "Server-read draft data and string row versions.", ["type"] = new OptionSetValue(10)
    });
}

static void Smoke(IOrganizationService service)
{
    var areas = new QueryExpression("nx_specializationarea") { ColumnSet = new ColumnSet(false), TopCount = 1 };
    areas.Criteria.AddCondition("nx_specializationareaname", ConditionOperator.Equal, "ai");
    var area = service.RetrieveMultiple(areas).Entities.Single().Id;
    var label = "[PRISMA TEST] Core draft " + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
    var payload = JsonSerializer.Serialize(new { name = label, areaId = area.ToString(), summary = "Non-sensitive persistence verification." });
    var create = new OrganizationRequest("nx_SaveCoreDraft") { ["DraftJson"] = payload };
    var created = JsonDocument.Parse((string)service.Execute(create)["ResultJson"]).RootElement;
    var identifier = Guid.Parse(created.GetProperty("id").GetString()!);
    var version = created.GetProperty("rowVersion").GetString()!;
    var update = new OrganizationRequest("nx_SaveCoreDraft") { ["DraftJson"] = payload, ["SolutionId"] = identifier, ["ExpectedRowVersion"] = version };
    var updated = JsonDocument.Parse((string)service.Execute(update)["ResultJson"]).RootElement;
    if (updated.GetProperty("rowVersion").GetString() == version) throw new InvalidOperationException("Row version did not advance.");
    AssertRejected(() => service.Execute(update), "stale update");
    AssertRejected(() => service.Update(new Entity("nx_solution", identifier) { ["nx_solutionname"] = "Bypass attempt" }), "direct update");
    AssertRejected(() => service.Create(new Entity("nx_solution") { ["nx_solutionname"] = "[PRISMA TEST] Bypass create" }), "direct create");
    var saved = service.Retrieve("nx_solution", identifier, new ColumnSet("nx_publicationstatus", "nx_clientsafereviewed"));
    if (saved.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value != 125060003 || saved.GetAttributeValue<bool>("nx_clientsafereviewed"))
        throw new InvalidOperationException("Draft state is incorrect.");
    service.Execute(new OrganizationRequest("nx_GetMyCoreDrafts"));
    Console.WriteLine($"PASS: create/retrieve/update/version conflict/direct-write guards. Retained labelled test draft: {identifier}.");
}

static void AssertRejected(Action action, string label)
{
    try { action(); }
    catch (System.ServiceModel.FaultException<OrganizationServiceFault>) { Console.WriteLine("Rejected: " + label); return; }
    throw new InvalidOperationException("Expected rejection: " + label);
}

static void SmokeMedia(IOrganizationService service)
{
    var identifier = Guid.Parse("595ea718-1cb6-f111-aaac-6045bd049fba");
    var parent = service.Retrieve("nx_solution", identifier, new ColumnSet("nx_solutionname"));
    if (parent.GetAttributeValue<string>("nx_solutionname") != "[PRISMA TEST] Browser core draft") throw new InvalidOperationException("Unexpected fixture.");
    var version = parent.RowVersion;
    JsonElement Call(string name, params (string Name, object Value)[] values)
    {
        var request = new OrganizationRequest(name) { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = version };
        foreach (var value in values) request[value.Name] = value.Value;
        var result = JsonDocument.Parse((string)service.Execute(request)["ResultJson"]).RootElement;
        version = result.GetProperty("rowVersion").GetString()!;
        if (result.ToString().Contains("nx_token", StringComparison.Ordinal)) throw new InvalidOperationException("Token escaped.");
        return result;
    }
    foreach (var kind in new[] { "attachment", "image" })
    {
        var bytes = kind == "attachment" ? System.Text.Encoding.UTF8.GetBytes("<!doctype html><html><body><h1>PRISMA media test</h1></body></html>")
            : Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=");
        var started = Call("nx_BeginMediaUpload", ("Kind", kind), ("FileName", kind == "image" ? "prisma-test.png" : "prisma-test.html"), ("Size", bytes.Length));
        var session = Guid.Parse(started.GetProperty("sessionId").GetString()!);
        var record = started.GetProperty("media").EnumerateArray().Single(item => item.GetProperty("sessionId").GetString() == session.ToString());
        var target = new EntityReference(kind == "image" ? "nx_solutionimage" : "nx_demoasset", Guid.Parse(record.GetProperty("id").GetString()!));
        AssertRejected(() => Call("nx_FinishMediaUpload", ("SessionId", session)), "incomplete upload finalize");
        AssertRejected(() => Call("nx_UploadMediaBlock", ("SessionId", session), ("BlockIndex", 1), ("Content", Convert.ToBase64String(bytes))), "out-of-order upload block");
        Call("nx_UploadMediaBlock", ("SessionId", session), ("BlockIndex", 0), ("Content", Convert.ToBase64String(bytes)));
        var completed = Call("nx_FinishMediaUpload", ("SessionId", session));
        if (!completed.GetProperty("media").EnumerateArray().Single(item => item.GetProperty("sessionId").GetString() == session.ToString()).GetProperty("complete").GetBoolean()) throw new InvalidOperationException("Media not finalized.");
        AssertRejected(() => service.Update(new Entity(target.LogicalName, target.Id) { ["nx_sortorder"] = 999 }), "direct media metadata update");
        AssertRejected(() => Call("nx_UploadMediaBlock", ("SessionId", session), ("BlockIndex", 1), ("Content", Convert.ToBase64String(bytes))), "finalized media mutation");
        var download = (InitializeFileBlocksDownloadResponse)service.Execute(new InitializeFileBlocksDownloadRequest { Target = target, FileAttributeName = kind == "image" ? "nx_imagefile" : "nx_filemedia" });
        var data = (DownloadBlockResponse)service.Execute(new DownloadBlockRequest { FileContinuationToken = download.FileContinuationToken, Offset = 0, BlockLength = download.FileSizeInBytes });
        if (kind == "attachment" && !data.Data.SequenceEqual(bytes)) throw new InvalidOperationException("File round trip differs.");
        if (data.Data.Length == 0) throw new InvalidOperationException("Empty download.");
        Call("nx_RemoveDraftMedia", ("SessionId", session));
        Console.WriteLine($"PASS: {kind} staged, committed, downloaded and removed; negative checks passed.");
    }
}

static void SmokeReview(IOrganizationService service)
{
    var identifier = Guid.Parse("595ea718-1cb6-f111-aaac-6045bd049fba");
    var list = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_GetSubmissions") { ["ReviewQueue"] = false })["ResultJson"]).RootElement;
    var record = list.GetProperty("records").EnumerateArray().Single(item => item.GetProperty("core").GetProperty("id").GetString() == identifier.ToString());
    var core = record.GetProperty("core");
    if (core.GetProperty("name").GetString() != "[PRISMA TEST] Browser core draft") throw new InvalidOperationException("Unexpected fixture.");
    var values = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(core.GetRawText())!;
    values.Remove("id");
    values.Remove("rowVersion");
    var capabilities = new QueryExpression("nx_capability") { ColumnSet = new ColumnSet(false), TopCount = 1 };
    capabilities.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
    values["capabilityId"] = JsonSerializer.SerializeToElement(service.RetrieveMultiple(capabilities).Entities.First().Id.ToString());
    values["safetyAcknowledged"] = JsonSerializer.SerializeToElement(true);
    var saved = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_SaveCoreDraft") {
        ["SolutionId"] = identifier, ["ExpectedRowVersion"] = core.GetProperty("rowVersion").GetString(), ["DraftJson"] = JsonSerializer.Serialize(values)
    })["ResultJson"]).RootElement;
    var transition = new OrganizationRequest("nx_TransitionSubmission") { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = saved.GetProperty("rowVersion").GetString(), ["Action"] = "submit" };
    var submitted = JsonDocument.Parse((string)service.Execute(transition)["ResultJson"]).RootElement;
    if (submitted.GetProperty("record").GetProperty("publication").GetInt32() != 125060002) throw new InvalidOperationException("Not pending review.");
    AssertRejected(() => service.Execute(transition), "stale submission transition");
    var pendingVersion = submitted.GetProperty("record").GetProperty("core").GetProperty("rowVersion").GetString();
    if (!list.GetProperty("librarian").GetBoolean())
        AssertRejected(() => service.Execute(new OrganizationRequest("nx_TransitionSubmission") { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = pendingVersion, ["Action"] = "approve", ["Cleared"] = true }), "approval without explicit Librarian role");
    var withdrawn = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_TransitionSubmission") { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = pendingVersion, ["Action"] = "withdraw" })["ResultJson"]).RootElement;
    if (withdrawn.GetProperty("record").GetProperty("publication").GetInt32() != 125060003 || withdrawn.GetProperty("record").GetProperty("core").GetProperty("safetyAcknowledged").GetBoolean()) throw new InvalidOperationException("Withdrawal did not restore an unacknowledged Draft.");
    Console.WriteLine("PASS: persisted completeness, submit, stale transition, explicit-role denial and withdraw. Test draft retained; no publication performed.");
}

static void SmokeDelete(IOrganizationService service)
{
    Guid Reference(string table)
    {
        var query = new QueryExpression(table) { ColumnSet = new ColumnSet(false), TopCount = 1 };
        query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
        return service.RetrieveMultiple(query).Entities.First().Id;
    }
    var area = Reference("nx_specializationarea");
    var consultant = Reference("cr6b0_consultant");
    var technology = Reference("nx_technology");
    var project = Reference("cr6b0_project");
    var label = "[PRISMA TEST] Disposable delete " + Guid.NewGuid().ToString("N");
    var created = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_SaveCoreDraft") {
        ["DraftJson"] = JsonSerializer.Serialize(new { name = label, areaId = area.ToString(), summary = "Non-sensitive deletion verification." })
    })["ResultJson"]).RootElement;
    var identifier = Guid.Parse(created.GetProperty("id").GetString()!);
    Console.WriteLine($"Created disposable deletion fixture {identifier}.");
    var version = created.GetProperty("rowVersion").GetString()!;
    var originalVersion = version;
    JsonElement Call(string name, params (string Name, object Value)[] values)
    {
        var request = new OrganizationRequest(name) { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = version };
        foreach (var value in values) request[value.Name] = value.Value;
        var result = JsonDocument.Parse((string)service.Execute(request)["ResultJson"]).RootElement;
        if (result.TryGetProperty("rowVersion", out var next)) version = next.GetString()!;
        return result;
    }
    var technologyName = "[PRISMA TEST] Technology " + Guid.NewGuid().ToString("N");
    var createdTechnology = Call("nx_TransitionSubmission", ("Action", "technology"), ("Comments", technologyName));
    var createdTechnologyId = Guid.Parse(createdTechnology.GetProperty("technologyId").GetString()!);
    var reusedTechnology = Call("nx_TransitionSubmission", ("Action", "technology"), ("Comments", technologyName.ToUpperInvariant()));
    if (reusedTechnology.GetProperty("technologyId").GetString() != createdTechnologyId.ToString()) throw new InvalidOperationException("Technology case-insensitive reuse failed.");
    AssertRejected(() => service.Execute(new OrganizationRequest("nx_TransitionSubmission") { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = originalVersion, ["Action"] = "technology", ["Comments"] = technologyName }), "stale technology creation");
    Call("nx_SaveDraftGraph", ("GraphJson", JsonSerializer.Serialize(new {
        contributors = new[] { new { personId = consultant.ToString(), directHours = 1m } },
        technologyIds = new[] { technology.ToString(), createdTechnologyId.ToString() }, industryIds = Array.Empty<string>(), projectIds = new[] { project.ToString() }
    })));
    var bytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=");
    var started = Call("nx_BeginMediaUpload", ("Kind", "image"), ("FileName", "delete-test.png"), ("Size", bytes.Length));
    var session = Guid.Parse(started.GetProperty("sessionId").GetString()!);
    Call("nx_UploadMediaBlock", ("SessionId", session), ("BlockIndex", 0), ("Content", Convert.ToBase64String(bytes)));
    var finished = Call("nx_FinishMediaUpload", ("SessionId", session));
    var imageId = finished.GetProperty("media")[0].GetProperty("id").GetString()!;
    var captionColumn = (StringAttributeMetadata)((RetrieveAttributeResponse)service.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_solutionimage", LogicalName = "nx_caption", RetrieveAsIfPublished = true })).AttributeMetadata;
    if (captionColumn.MaxLength < 200) throw new InvalidOperationException("Caption column is too short.");
    var thumbnail = Call("nx_BeginMediaUpload", ("Kind", "thumbnail"), ("FileName", "thumbnail-test.png"), ("Size", bytes.Length));
    var thumbnailSession = Guid.Parse(thumbnail.GetProperty("sessionId").GetString()!);
    Call("nx_UploadMediaBlock", ("SessionId", thumbnailSession), ("BlockIndex", 0), ("Content", Convert.ToBase64String(bytes)));
    Call("nx_FinishMediaUpload", ("SessionId", thumbnailSession));
    var metadataJson = JsonSerializer.Serialize(new[] { new { id = imageId, caption = "Non-sensitive caption", sortOrder = 0 } });
    var metadataVersion = version;
    var updatedMedia = Call("nx_TransitionSubmission", ("Action", "media"), ("Comments", metadataJson));
    var image = updatedMedia.GetProperty("media").EnumerateArray().Single(item => item.GetProperty("id").GetString() == imageId);
    if (image.GetProperty("caption").GetString() != "Non-sensitive caption" || image.GetProperty("sortOrder").GetInt32() != 0 || version == metadataVersion)
        throw new InvalidOperationException("Media metadata round trip failed.");
    AssertRejected(() => service.Execute(new OrganizationRequest("nx_TransitionSubmission") { ["SolutionId"] = identifier, ["ExpectedRowVersion"] = metadataVersion, ["Action"] = "media", ["Comments"] = metadataJson }), "stale metadata update");
    AssertRejected(() => service.Update(new Entity("nx_solutionimage", Guid.Parse(imageId)) { ["nx_caption"] = "Direct edit" }), "direct caption edit");
    AssertRejected(() => Call("nx_BeginMediaUpload", ("Kind", "thumbnail"), ("FileName", "duplicate.png"), ("Size", bytes.Length)), "second thumbnail");
    Call("nx_BeginMediaUpload", ("Kind", "attachment"), ("FileName", "unfinished-test.html"), ("Size", 10));
    AssertRejected(() => service.Delete("nx_solution", identifier), "direct solution deletion");
    AssertRejected(() => service.Execute(new OrganizationRequest("nx_TransitionSubmission") {
        ["SolutionId"] = identifier, ["ExpectedRowVersion"] = originalVersion, ["Action"] = "delete"
    }), "stale deletion");
    var unchanged = service.Retrieve("nx_solution", identifier, new ColumnSet("nx_solutionname"));
    if (unchanged.RowVersion != version || unchanged.GetAttributeValue<string>("nx_solutionname") != label) throw new InvalidOperationException("Rejected deletion changed the fixture.");
    var deleted = Call("nx_TransitionSubmission", ("Action", "delete"));
    if (deleted.GetProperty("id").GetString() != identifier.ToString() || !deleted.GetProperty("deleted").GetBoolean()) throw new InvalidOperationException("Deletion not confirmed.");
    foreach (var table in new[] { "nx_solution", "nx_solutioncontributor", "nx_solutionimage", "nx_demoasset", "nx_uploadsession" })
    {
        var query = new QueryExpression(table) { ColumnSet = new ColumnSet(false), TopCount = 1 };
        query.Criteria.AddCondition(table == "nx_solution" ? "nx_solutionid" : table == "nx_uploadsession" ? "nx_parentid" : "nx_solution", ConditionOperator.Equal, table == "nx_uploadsession" ? (object)identifier.ToString() : identifier);
        if (service.RetrieveMultiple(query).Entities.Count != 0) throw new InvalidOperationException("Deletion left a row in " + table);
    }
    service.Retrieve("cr6b0_consultant", consultant, new ColumnSet(false));
    service.Retrieve("cr6b0_project", project, new ColumnSet(false));
    service.Retrieve("nx_technology", technology, new ColumnSet(false));
    var disposableTechnology = service.Retrieve("nx_technology", createdTechnologyId, new ColumnSet("nx_technologyname"));
    if (disposableTechnology.GetAttributeValue<string>("nx_technologyname") != technologyName) throw new InvalidOperationException("Refusing to remove changed test technology.");
    service.Delete("nx_technology", createdTechnologyId);
    Console.WriteLine("PASS: technology creation/reuse and stale rejection; thumbnail and caption round trip; stale/direct metadata and duplicate thumbnail rejected; owner deletion removed only its disposable Solution, contributor, finalized/unfinished media and sessions; shared references remain; disposable technology cleaned up; stale/direct deletion rejected.");
}

static void SmokeGraph(IOrganizationService service)
{
    var drafts = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false), TopCount = 1 };
    drafts.Criteria.AddCondition("nx_solutionname", ConditionOperator.Equal, "[PRISMA TEST] Browser core draft");
    var identifier = service.RetrieveMultiple(drafts).Entities.Single().Id;
    Guid Reference(string table, string primary)
    {
        var query = new QueryExpression(table) { ColumnSet = new ColumnSet(false), TopCount = 1 };
        query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
        query.Orders.Add(new OrderExpression(primary, OrderType.Ascending));
        return service.RetrieveMultiple(query).Entities.First().Id;
    }
    var person = Reference("cr6b0_consultant", "cr6b0_consultantid");
    var technology = Reference("nx_technology", "nx_technologyid");
    var industry = Reference("nx_industry", "nx_industryid");
    var read = new OrganizationRequest("nx_GetDraftGraph") { ["SolutionId"] = identifier };
    var before = JsonDocument.Parse((string)service.Execute(read)["ResultJson"]).RootElement;
    var payload = JsonSerializer.Serialize(new {
        contributors = new[] { new { personId = person.ToString(), directHours = 12.5m } },
        technologyIds = new[] { technology.ToString() }, industryIds = new[] { industry.ToString() }, projectIds = Array.Empty<string>()
    });
    var save = new OrganizationRequest("nx_SaveDraftGraph") {
        ["SolutionId"] = identifier, ["ExpectedRowVersion"] = before.GetProperty("rowVersion").GetString(), ["GraphJson"] = payload
    };
    var after = JsonDocument.Parse((string)service.Execute(save)["ResultJson"]).RootElement;
    if (after.GetProperty("graph").GetProperty("contributors").GetArrayLength() != 1 || after.GetProperty("hours")[0].GetDecimal() != 12.5m)
        throw new InvalidOperationException("Contributor round trip failed.");
    if (after.GetProperty("graph").GetProperty("technologyIds").GetArrayLength() != 1 || after.GetProperty("graph").GetProperty("industryIds").GetArrayLength() != 1)
        throw new InvalidOperationException("Tag round trip failed.");
    AssertRejected(() => service.Execute(save), "stale graph save");
    var child = Guid.Parse(after.GetProperty("graph").GetProperty("contributors")[0].GetProperty("id").GetString()!);
    AssertRejected(() => service.Update(new Entity("nx_solutioncontributor", child) { ["nx_directhours"] = 999m }), "direct contributor update");
    AssertRejected(() => service.Disassociate("nx_solution", identifier, new Relationship("nx_Solution_nx_Technology_nx_Technology"), new EntityReferenceCollection { new EntityReference("nx_technology", technology) }), "direct tag removal");
    var reopened = JsonDocument.Parse((string)service.Execute(read)["ResultJson"]).RootElement;
    if (reopened.GetProperty("rowVersion").GetString() != after.GetProperty("rowVersion").GetString()) throw new InvalidOperationException("Rejected write changed the draft.");
    Console.WriteLine($"PASS: graph save/reopen, computed effort, tag links and direct-write/concurrency guards. Test draft {identifier} retained.");
}
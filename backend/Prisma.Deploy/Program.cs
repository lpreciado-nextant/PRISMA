using System.Reflection;
using System.Text.Json;
using System.Xml.Linq;
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
if (!new[] { "inspect", "inspect-favorites", "remove-story-field", "seed-reference-data", "smoke-transfer", "media-transfer", "inspect-asset-columns", "verify-video-files", "set-video-limit", "repair-asset-url", "apply", "assign-acceptance", "smoke", "smoke-graph", "smoke-media", "smoke-review", "smoke-delete",
    "plugin-subject", "blob-schema", "blob-plugin", "bind-managed-identity", "set-blob-config", "smoke-blob", "catalogue-api" }.Contains(command)) throw new ArgumentException("Unknown deployment command.");
using var client = new ServiceClient($"AuthType=OAuth;Url={organizationUrl};AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;RedirectUri=http://localhost;LoginPrompt=Auto;RequireNewInstance=True");
if (!client.IsReady) throw new InvalidOperationException("Dataverse sign-in failed. " + client.LastError);
var identity = (WhoAmIResponse)client.Execute(new WhoAmIRequest());
if (identity.OrganizationId != organizationId) throw new InvalidOperationException("Refusing to operate against a different organization.");
Console.WriteLine($"Verified Nextant Pulse organization {identity.OrganizationId}; command {command}.");
if (command == "inspect") return;
if (command == "inspect-favorites")
{
    // Read-only: what the Top 10 API returns, and every favorite row the signed-in account can read.
    var top = client.Execute(new OrganizationRequest("nx_GetTopFavorites"));
    Console.WriteLine($"nx_GetTopFavorites: {top.Results["ResultJson"]}");
    var favorites = new QueryExpression("nx_solutionfavorite") { ColumnSet = new ColumnSet("nx_solution", "nx_user", "createdon") };
    var parent = favorites.AddLink("nx_solution", "nx_solution", "nx_solutionid", JoinOperator.LeftOuter);
    parent.EntityAlias = "s";
    parent.Columns = new ColumnSet("nx_solutionname", "nx_publicationstatus", "statecode");
    foreach (var row in client.RetrieveMultiple(favorites).Entities)
    {
        string Aliased(string name) => row.GetAttributeValue<AliasedValue>("s." + name)?.Value switch { OptionSetValue option => option.Value.ToString(), null => "(none)", var value => value.ToString()! };
        Console.WriteLine($"{row.GetAttributeValue<EntityReference>("nx_solution")?.Id} | {Aliased("nx_solutionname")} | publication {Aliased("nx_publicationstatus")} | state {Aliased("statecode")} | user {(row.Contains("nx_user") ? "set" : "EMPTY")} | {row.GetAttributeValue<DateTime>("createdon"):u}");
    }
    Console.WriteLine("Read-only inspection. No changes made.");
    return;
}
if (command == "remove-story-field")
{
    if (args.Length > 2 || (args.Length == 2 && args[1] != "--execute")) throw new ArgumentException("Use remove-story-field [--execute]; preview is read-only.");
    AttributeMetadata? ReadStoryField(bool editable) => ((RetrieveEntityResponse)client.Execute(new RetrieveEntityRequest {
        LogicalName = "nx_solution", EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = editable
    })).EntityMetadata.Attributes.SingleOrDefault(attribute => attribute.LogicalName == "nx_usecase");
    var published = ReadStoryField(false);
    var editable = ReadStoryField(true);
    if (published == null && editable == null) { Console.WriteLine("Verified retired story column is absent from published and editable metadata. No changes made."); return; }
    if (editable is not StringAttributeMetadata || published?.MetadataId != editable.MetadataId || editable.MetadataId != Guid.Parse("9849a6a2-f765-43f4-8bdf-5cd157a524a6")
        || editable.SchemaName != "nx_UseCase" || editable.IsManaged != false || editable.IsCustomizable?.Value != true)
        throw new InvalidOperationException("Unexpected story-column metadata. Refusing deletion.");
    EntityCollection Dependencies() => ((RetrieveDependenciesForDeleteResponse)client.Execute(new RetrieveDependenciesForDeleteRequest {
        ComponentType = 2, ObjectId = editable.MetadataId.Value
    })).EntityCollection;
    var dependencies = Dependencies().Entities;
    Console.WriteLine($"Column nx_solution.nx_usecase {editable.MetadataId}; deletion dependencies: {dependencies.Count}.");
    foreach (var dependency in dependencies)
        Console.WriteLine($"Dependent component type {dependency.GetAttributeValue<OptionSetValue>("dependentcomponenttype")?.Value}; ID {dependency.GetAttributeValue<Guid>("dependentcomponentobjectid")}.");
    var formId = Guid.Parse("f753494e-cfb7-486a-8a69-6e66975d94be");
    if (dependencies.Any(dependency => dependency.GetAttributeValue<OptionSetValue>("dependentcomponenttype")?.Value != 60
        || dependency.GetAttributeValue<Guid>("dependentcomponentobjectid") != formId)) throw new InvalidOperationException("Unexpected dependency; reassess before modifying any component.");
    Entity ReadForm() => ((RetrieveUnpublishedResponse)client.Execute(new RetrieveUnpublishedRequest {
        Target = new EntityReference("systemform", formId), ColumnSet = new ColumnSet("formxml", "objecttypecode", "ismanaged", "name")
    })).Entity;
    var form = ReadForm();
    if (form.GetAttributeValue<string>("objecttypecode") != "nx_solution" || form.GetAttributeValue<bool>("ismanaged"))
        throw new InvalidOperationException("Unexpected form ownership or table.");
    var originalXml = form.GetAttributeValue<string>("formxml");
    var document = XDocument.Parse(originalXml, LoadOptions.PreserveWhitespace);
    var controls = document.Descendants("control").Where(control => string.Equals((string?)control.Attribute("datafieldname"), "nx_usecase", StringComparison.OrdinalIgnoreCase)).ToArray();
    if (controls.Length > 1 || (dependencies.Count > 0 && controls.Length != 1)) throw new InvalidOperationException("Unexpected story controls on the form.");
    foreach (var control in controls) {
        var row = control.Parent?.Parent;
        if (control.Parent?.Name != "cell" || row?.Name != "row" || row.Elements("cell").Count() != 1 || row.Descendants("control").Count() != 1)
            throw new InvalidOperationException("The story control no longer occupies an isolated form row.");
        row.Remove();
    }
    Console.WriteLine($"Information form: remove {controls.Length} isolated story row; preserve every other control.");
    var query = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
    query.Criteria.AddCondition("nx_usecase", ConditionOperator.NotNull);
    query.Orders.Add(new OrderExpression("nx_solutionid", OrderType.Ascending));
    var populated = 0;
    EntityCollection rows;
    do {
        rows = client.RetrieveMultiple(query); populated += rows.Entities.Count;
        query.PageInfo.PageNumber++; query.PageInfo.PagingCookie = rows.PagingCookie;
    } while (rows.MoreRecords);
    Console.WriteLine($"Records with a stored value: {populated}. Deletion permanently removes these values; other columns and records are retained.");
    Console.WriteLine("Deploy the compatible connected app and tested plug-in first. Only nx_solution will be published; table publication can include other pending customizations. No roles or unrelated form controls are changed.");
    if (args.Length == 1) { Console.WriteLine("Read-only preview. No changes made."); return; }
    if (populated > 1) throw new InvalidOperationException("The populated record count exceeds the approved preflight; reassess before deletion.");
    const string publishSolution = "<importexportxml><entities><entity>nx_solution</entity></entities></importexportxml>";
    if (controls.Length != 0) {
        if (ReadForm().GetAttributeValue<string>("formxml") != originalXml) throw new InvalidOperationException("The form changed during preflight. Reopen before retrying.");
        client.Update(new Entity("systemform", formId) { ["formxml"] = document.ToString(SaveOptions.DisableFormatting) });
        client.Execute(new PublishXmlRequest { ParameterXml = publishSolution });
    }
    if (Dependencies().Entities.Count != 0) throw new InvalidOperationException("Deletion dependencies remain after the scoped form update.");
    client.Execute(new DeleteAttributeRequest { EntityLogicalName = "nx_solution", LogicalName = "nx_usecase" });
    client.Execute(new PublishXmlRequest { ParameterXml = publishSolution });
    if (ReadStoryField(false) != null || ReadStoryField(true) != null) throw new InvalidOperationException("Column deletion could not be verified.");
    Console.WriteLine("Verified retired story column is absent from published and editable metadata.");
    return;
}
if (command == "seed-reference-data") { SeedReferenceData(client, args.Skip(1).ToArray()); return; }
if (command == "smoke-transfer")
{
    if (args.Length != 2) throw new ArgumentException("Use smoke-transfer <non-sensitive-mp4> after approval. Creates and deletes one test draft.");
    var file = new FileInfo(args[1]);
    if (file.Extension.ToLowerInvariant() != ".mp4" || file.Length <= 4194304 || file.Length > 60 * 1024 * 1024) throw new ArgumentException("Use a 4-60 MiB MP4 fixture.");
    JsonElement Call(string api, params (string Name, object Value)[] values) {
        var request = new OrganizationRequest(api); foreach (var value in values) request[value.Name] = value.Value;
        using var json = JsonDocument.Parse((string)client.Execute(request)["ResultJson"]); return json.RootElement.Clone();
    }
    var draft = Call("nx_SaveCoreDraft", ("DraftJson", JsonSerializer.Serialize(new { name = "[PRISMA TEST] Transfer acceptance", summary = "Disposable transfer protocol verification." })));
    var id = Guid.Parse(draft.GetProperty("id").GetString()!);
    try {
        string Version() => client.Retrieve("nx_solution", id, new ColumnSet(false)).RowVersion;
        using var source = file.OpenRead();
        var digest = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(source)).ToLowerInvariant(); source.Position = 0;
        var begin = Call("nx_BeginResumableUpload", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("FileName", file.Name), ("Size", (int)file.Length), ("Sha256", digest));
        var session = Guid.Parse(begin.GetProperty("sessionId").GetString()!);
        var target = Guid.Parse(begin.GetProperty("media")[0].GetProperty("id").GetString()!);
        var bytes = new byte[4194304]; source.ReadExactly(bytes);
        Call("nx_UploadMediaBlock", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("SessionId", session), ("BlockIndex", 0), ("Content", Convert.ToBase64String(bytes)));
        AssertRejected(() => Call("nx_GetUploadCheckpoint", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("SessionId", session), ("FileName", file.Name), ("Size", (int)file.Length), ("Sha256", new string('0', 64))), "wrong-file resume");
        var checkpoint = Call("nx_GetUploadCheckpoint", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("SessionId", session), ("FileName", file.Name), ("Size", (int)file.Length), ("Sha256", digest));
        if (checkpoint.GetProperty("media")[0].GetProperty("received").GetInt32() != 4194304) throw new InvalidOperationException("Checkpoint mismatch.");
        Console.WriteLine("PASS interrupted upload checkpoint and wrong-file rejection.");
        var index = 1;
        while (source.Position < source.Length) {
            var block = new byte[Math.Min(4194304L, source.Length - source.Position)]; source.ReadExactly(block);
            Call("nx_UploadMediaBlock", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("SessionId", session), ("BlockIndex", index++), ("Content", Convert.ToBase64String(block)));
        }
        Call("nx_FinishMediaUpload", ("SolutionId", id), ("ExpectedRowVersion", Version()), ("SessionId", session));
        string? version = null;
        using var hash = System.Security.Cryptography.IncrementalHash.CreateHash(System.Security.Cryptography.HashAlgorithmName.SHA256);
        for (var offset = 0; offset < file.Length; offset += 1048576) {
            var range = Call("nx_ReadVideoRange", ("SolutionId", id), ("AssetId", target), ("Mode", "submission"), ("Offset", offset), ("Count", 1048576), ("Version", version ?? ""));
            version ??= range.GetProperty("version").GetString();
            if (range.GetProperty("version").GetString() != version || range.GetProperty("offset").GetInt32() != offset) throw new InvalidOperationException("Range identity mismatch.");
            hash.AppendData(Convert.FromBase64String(range.GetProperty("content").GetString()!));
        }
        if (Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant() != digest) throw new InvalidOperationException("Resume/range checksum mismatch.");
        AssertRejected(() => Call("nx_ReadVideoRange", ("SolutionId", id), ("AssetId", target), ("Mode", "present"), ("Offset", 0), ("Count", 1)), "draft present read");
        AssertRejected(() => Call("nx_ReadVideoRange", ("SolutionId", id), ("AssetId", target), ("Mode", "submission"), ("Offset", 0), ("Count", 1), ("Version", "stale")), "stale video version");
        Console.WriteLine($"PASS finalized resume and protected 1 MiB ranges: {file.Length} bytes; SHA256 {digest}. Non-admin access remains a separate gate.");
    } finally {
        Call("nx_TransitionSubmission", ("SolutionId", id), ("ExpectedRowVersion", client.Retrieve("nx_solution", id, new ColumnSet(false)).RowVersion), ("Action", "delete"), ("Comments", ""), ("Cleared", false));
        Console.WriteLine($"Deleted disposable transfer draft {id}.");
    }
    return;
}
if (command == "media-transfer")
{
    if (args.Length != 1 && (args.Length != 3 || args[1] != "--execute")) throw new ArgumentException("Use media-transfer [--execute <tested-plugin.dll>]. Execution requires explicit approval.");
    var existing = Find(client, "pluginassembly", "name", "Prisma.Plugins") ?? throw new InvalidOperationException("Existing assembly missing.");
    if (existing.Id != Guid.Parse("08207a52-1ab6-f111-aaac-6045bd049fba")) throw new InvalidOperationException("Unexpected assembly target.");
    var metadata = ((RetrieveEntityResponse)client.Execute(new RetrieveEntityRequest { LogicalName = "nx_uploadsession", EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = true })).EntityMetadata;
    var digestColumn = metadata.Attributes.SingleOrDefault(attribute => attribute.LogicalName == "nx_sha256");
    if (digestColumn != null && (!(digestColumn is StringAttributeMetadata text) || text.MaxLength != 64)) throw new InvalidOperationException("Unexpected digest metadata.");
    Console.WriteLine("Plan: nx_uploadsession.nx_sha256 String(64); publish only nx_uploadsession; update existing assembly; register nx_BeginResumableUpload, nx_GetUploadCheckpoint, nx_ReadVideoRange. No roles, user assignments or code app publication. Table publication may include pending customizations.");
    if (args.Length == 1) { Console.WriteLine("Read-only preview. No changes made."); return; }
    var path = Path.GetFullPath(args[2]);
    if (AssemblyName.GetAssemblyName(path).Name != "Prisma.Plugins") throw new InvalidOperationException("Unexpected assembly file.");
    if (digestColumn == null) client.Execute(new CreateAttributeRequest { EntityName = "nx_uploadsession", SolutionUniqueName = solutionName,
        Attribute = new StringAttributeMetadata { SchemaName = "nx_Sha256", DisplayName = new Label("File SHA-256", 1033), MaxLength = 64 } });
    client.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_uploadsession</entity></entities></importexportxml>" });
    client.Update(new Entity("pluginassembly", existing.Id) { ["content"] = Convert.ToBase64String(File.ReadAllBytes(path)) });
    var transferType = PluginType(client, existing.Id, "Prisma.Plugins.MediaTransferApi");
    RegisterApi(client, transferType, "nx_BeginResumableUpload", "prvWritenx_Solution", new[] {
        ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("FileName", 10, false), ("Size", 7, false), ("Sha256", 10, false), ("BlockSize", 7, true) });
    RegisterApi(client, transferType, "nx_GetUploadCheckpoint", "prvReadnx_Solution", new[] {
        ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("SessionId", 12, false), ("FileName", 10, false), ("Size", 7, false), ("Sha256", 10, false) });
    RegisterApi(client, transferType, "nx_ReadVideoRange", "prvReadnx_Solution", new[] {
        ("SolutionId", 12, false), ("AssetId", 12, false), ("Mode", 10, false), ("Offset", 7, false), ("Count", 7, false), ("Version", 10, true) });
    Console.WriteLine("Media transfer registration complete; live authorization/integrity acceptance remains required.");
    return;
}
if (command == "verify-video-files")
{
    if (args.Length < 3 || !Guid.TryParse(args[1], out var parentId)) throw new ArgumentException("Use verify-video-files <test-draft-id> <local-file> [local-file...]. Read-only.");
    using var detail = JsonDocument.Parse((string)client.Execute(new OrganizationRequest("nx_GetSubmission") { ["SolutionId"] = parentId })["ResultJson"]);
    if (detail.RootElement.GetProperty("record").GetProperty("core").GetProperty("name").GetString() != "[PRISMA TEST] Large video acceptance") throw new InvalidOperationException("Refusing an unrelated draft.");
    foreach (var path in args.Skip(2))
    {
        var file = new FileInfo(path);
        var item = detail.RootElement.GetProperty("media").EnumerateArray().Single(value => value.GetProperty("name").GetString() == file.Name);
        if (!item.GetProperty("complete").GetBoolean() || item.GetProperty("kind").GetString() != "attachment" || item.GetProperty("mime").GetString() != "video/mp4" || item.GetProperty("size").GetInt64() != file.Length)
            throw new InvalidOperationException("Video is not finalized or its recorded size differs.");
        using var input = file.OpenRead();
        var expected = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(input));
        var target = new EntityReference("nx_demoasset", Guid.Parse(item.GetProperty("id").GetString()!));
        var download = (InitializeFileBlocksDownloadResponse)client.Execute(new InitializeFileBlocksDownloadRequest { Target = target, FileAttributeName = "nx_filemedia" });
        if (download.FileSizeInBytes != file.Length || !download.IsChunkingSupported) throw new InvalidOperationException("Unexpected stored size or no streaming download support.");
        using var hash = System.Security.Cryptography.IncrementalHash.CreateHash(System.Security.Cryptography.HashAlgorithmName.SHA256);
        var timer = System.Diagnostics.Stopwatch.StartNew();
        long offset = 0;
        while (offset < file.Length)
        {
            var length = Math.Min(4L * 1024 * 1024, file.Length - offset);
            var block = (DownloadBlockResponse)client.Execute(new DownloadBlockRequest { FileContinuationToken = download.FileContinuationToken, Offset = offset, BlockLength = length });
            if (block.Data.LongLength != length) throw new InvalidOperationException("Download block length mismatch.");
            hash.AppendData(block.Data); offset += length;
        }
        var actual = Convert.ToHexString(hash.GetHashAndReset());
        if (expected != actual) throw new InvalidOperationException($"Checksum mismatch for {file.Name}.");
        Console.WriteLine($"PASS {file.Name}: {offset} bytes; SHA256 {actual}; streamed readback {timer.Elapsed.TotalSeconds:F1}s. No writes performed.");
    }
    return;
}
if (command == "set-video-limit")
{
    if (args.Length > 2 || (args.Length == 2 && args[1] != "--execute")) throw new ArgumentException("Use set-video-limit [--execute]; preview is read-only.");
    const int targetKB = 500 * 1024;
    FileAttributeMetadata ReadFileLimit(bool editable) => ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_demoasset", LogicalName = "nx_filemedia", RetrieveAsIfPublished = editable })).AttributeMetadata as FileAttributeMetadata
        ?? throw new InvalidOperationException("Attachment column is not a File attribute.");
    var published = ReadFileLimit(false);
    var editable = ReadFileLimit(true);
    if (published.MetadataId != editable.MetadataId || editable.IsManaged != false || editable.IsCustomizable?.Value != true
        || (published.MaxSizeInKB != 32768 && published.MaxSizeInKB != targetKB) || (editable.MaxSizeInKB != 32768 && editable.MaxSizeInKB != targetKB))
        throw new InvalidOperationException("Unexpected attachment metadata. Reassess before changing the limit.");
    Console.WriteLine($"nx_demoasset.nx_filemedia {editable.MetadataId}: published={published.MaxSizeInKB} KB; editable={editable.MaxSizeInKB} KB; approved target={targetKB} KB (500 MiB).");
    Console.WriteLine("Only this file-column limit is updated. Table publication can activate other pending nx_demoasset customizations. No file bytes, rows, roles or code apps are changed.");
    if (args.Length == 1) { Console.WriteLine("Preview only. --execute requires explicit approval."); return; }
    if (editable.MaxSizeInKB != targetKB)
    {
        editable.MaxSizeInKB = targetKB;
        client.Execute(new UpdateAttributeRequest { EntityName = "nx_demoasset", Attribute = editable, MergeLabels = false, SolutionUniqueName = solutionName });
    }
    if (published.MaxSizeInKB != targetKB)
        client.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_demoasset</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>" });
    if (ReadFileLimit(false).MaxSizeInKB != targetKB || ReadFileLimit(true).MaxSizeInKB != targetKB) throw new InvalidOperationException("File-size limit verification failed after update/publication.");
    Console.WriteLine("Verified published and editable attachment limit: 512000 KB (524288000 bytes). Full-size upload/playback acceptance is separate.");
    return;
}
if (command == "repair-asset-url")
{
    if (args.Length > 2 || (args.Length == 2 && args[1] != "--execute" && args[1] != "--execute-resize")) throw new ArgumentException("Use repair-asset-url [--execute|--execute-resize]; preview is read-only. Resize requires separate approval.");
    StringAttributeMetadata ReadUrl(bool editable) => ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_demoasset", LogicalName = "nx_externalurl", RetrieveAsIfPublished = editable })).AttributeMetadata as StringAttributeMetadata
        ?? throw new InvalidOperationException("External URL is not a String attribute.");
    var published = ReadUrl(false);
    var editable = ReadUrl(true);
    if (published.MetadataId != editable.MetadataId || published.MaxLength != 4000 || editable.MaxLength != 4000 || editable.IsManaged != false
        || editable.IsCustomizable?.Value != true) throw new InvalidOperationException("Unexpected URL metadata. Reassess before changing the column.");
    Console.WriteLine($"Verified nx_demoasset.nx_externalurl {editable.MetadataId}; published/editable length 4000. Reapply the existing length without reducing it, then publish nx_demoasset only.");
    Console.WriteLine("Publishing this table also publishes any other pending customizations on nx_demoasset. No roles, rows, other tables or code apps will be changed.");
    if (args.Length == 1) { Console.WriteLine("Preview only. --execute requires explicit approval."); return; }
    if (args[1] == "--execute-resize")
    {
        var query = new QueryExpression("nx_demoasset") { ColumnSet = new ColumnSet("nx_externalurl"), PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 } };
        query.Orders.Add(new OrderExpression("nx_demoassetid", OrderType.Ascending));
        var checkedRows = 0;
        var maximum = 0;
        EntityCollection rows;
        do
        {
            rows = client.RetrieveMultiple(query);
            foreach (var row in rows.Entities)
            {
                var length = (row.GetAttributeValue<string>("nx_externalurl") ?? "").Length;
                if (length > 3999) throw new InvalidOperationException("An existing URL exceeds 3999 characters. Refusing resize; no metadata changed.");
                checkedRows++; maximum = Math.Max(maximum, length);
            }
            query.PageInfo.PageNumber++; query.PageInfo.PagingCookie = rows.PagingCookie;
        } while (rows.MoreRecords);
        Console.WriteLine($"Checked {checkedRows} existing asset rows; maximum URL length {maximum}. Applying separately approved 3999 -> 4000 metadata sequence.");
        try
        {
            editable.MaxLength = 3999;
            client.Execute(new UpdateAttributeRequest { EntityName = "nx_demoasset", Attribute = editable, MergeLabels = false, SolutionUniqueName = solutionName });
        }
        finally
        {
            editable.MaxLength = 4000;
            client.Execute(new UpdateAttributeRequest { EntityName = "nx_demoasset", Attribute = editable, MergeLabels = false, SolutionUniqueName = solutionName });
        }
    }
    else client.Execute(new UpdateAttributeRequest { EntityName = "nx_demoasset", Attribute = editable, MergeLabels = false, SolutionUniqueName = solutionName });
    client.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_demoasset</entity></entities><nodes/><securityroles/><settings/><workflows/></importexportxml>" });
    if (ReadUrl(false).MaxLength != 4000 || ReadUrl(true).MaxLength != 4000) throw new InvalidOperationException("URL metadata verification failed after update/publish.");
    Console.WriteLine("Update/publish completed; metadata remains 4000. A protected API write/readback probe is still required to confirm physical storage capacity.");
    return;
}
if (command == "inspect-asset-columns")
{
    foreach (var name in new[] { "nx_demoassetid1", "nx_externalurl", "nx_embedhint", "nx_filemedia" })
    {
        foreach (var editable in new[] { false, true })
        {
            var attribute = ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_demoasset", LogicalName = name, RetrieveAsIfPublished = editable })).AttributeMetadata;
            Console.WriteLine($"nx_demoasset.{name}: editable={editable}; type={attribute.AttributeType}; maxLength={(attribute as StringAttributeMetadata)?.MaxLength ?? (attribute as MemoAttributeMetadata)?.MaxLength}; maxSizeKB={(attribute as FileAttributeMetadata)?.MaxSizeInKB}; managed={attribute.IsManaged}");
        }
    }
    // Asset Purpose (ADR-0011): the column, its local options, and how many assets carry each purpose. Read-only.
    foreach (var editable in new[] { false, true })
    {
        var purpose = ((RetrieveAttributeResponse)client.Execute(new RetrieveAttributeRequest { EntityLogicalName = "nx_demoasset", LogicalName = "nx_assetpurpose", RetrieveAsIfPublished = editable })).AttributeMetadata as PicklistAttributeMetadata
            ?? throw new InvalidOperationException("nx_demoasset.nx_assetpurpose is not a choice column.");
        Console.WriteLine($"nx_demoasset.nx_assetpurpose: editable={editable}; schema={purpose.SchemaName}; required={purpose.RequiredLevel?.Value}; global={purpose.OptionSet?.IsGlobal}; default={purpose.DefaultFormValue}; managed={purpose.IsManaged}");
        foreach (var option in purpose.OptionSet?.Options ?? new OptionMetadataCollection()) Console.WriteLine($"  {option.Value} {option.Label?.UserLocalizedLabel?.Label}");
    }
    var assets = client.RetrieveMultiple(new QueryExpression("nx_demoasset") { ColumnSet = new ColumnSet("nx_assettype", "nx_assetpurpose") }).Entities;
    foreach (var group in assets.GroupBy(row => (Type: row.GetAttributeValue<OptionSetValue>("nx_assettype")?.Value, Purpose: row.GetAttributeValue<OptionSetValue>("nx_assetpurpose")?.Value)).OrderBy(group => group.Key.Type))
        Console.WriteLine($"assets: type={group.Key.Type?.ToString() ?? "none"}; purpose={group.Key.Purpose?.ToString() ?? "none"}; rows={group.Count()}");
    return;
}
if (command == "assign-acceptance") { AssignAcceptance(client, args.Skip(1).ToArray()); return; }
if (command == "smoke") { Smoke(client); return; }
if (command == "smoke-graph") { SmokeGraph(client); return; }
if (command == "smoke-media") { SmokeMedia(client); return; }
if (command == "smoke-review") { SmokeReview(client); return; }
if (command == "smoke-delete") { SmokeDelete(client); return; }
if (command == "plugin-subject") { PluginSubject(args.Skip(1).ToArray()); return; }
if (command == "blob-schema") { BlobSchema(client, args.Skip(1).ToArray()); return; }
if (command == "blob-plugin") { BlobPlugin(client, args.Skip(1).ToArray()); return; }
if (command == "bind-managed-identity") { BindManagedIdentity(client, args.Skip(1).ToArray()); return; }
if (command == "set-blob-config") { SetBlobConfig(client, args.Skip(1).ToArray()); return; }
if (command == "smoke-blob") { SmokeBlob(client, args.Skip(1).ToArray()); return; }
if (command == "catalogue-api") { RegisterCatalogueApi(client, args.Skip(1).ToArray()); return; }

static void SeedReferenceData(IOrganizationService service, string[] options)
{
    if (options.Length > 1 || (options.Length == 1 && options[0] != "--execute"))
        throw new ArgumentException("Use seed-reference-data [--execute]; preview is read-only.");
    var definitions = new[] {
        (Table: "nx_capability", Name: "nx_capabilityname", Sorted: true, Names: new[] {
            "AI & agents", "Planning & analytics", "Workflow & approvals", "Data platform",
            "Knowledge & search", "Digital applications & experiences" }),
        (Table: "nx_industry", Name: "nx_industryname", Sorted: true, Names: new[] {
            "Financial services", "IT", "Manufacturing", "Public sector", "Cross-industry",
            "Professional services", "Healthcare", "Life sciences", "Retail & consumer goods",
            "Energy & utilities", "Telecommunications", "Transportation & logistics", "Education",
            "Media & entertainment", "Real estate & construction", "Travel & hospitality", "Nonprofit" }),
        (Table: "nx_technology", Name: "nx_technologyname", Sorted: false, Names: new[] {
            "Copilot Studio", "ADO", "Microsoft Foundry", "Power BI", "Power Automate", "Fabric", "AWS", "Power Apps",
            "Dataverse", "Power Apps code app", "SharePoint", "Microsoft Teams", "Dynamics 365", "Azure OpenAI",
            "Azure AI Search", "Azure Functions", "Azure App Service", "Azure Logic Apps", "Azure Data Factory",
            "Azure SQL", "Azure Storage", "Microsoft Graph", "SQL Server", "PostgreSQL", "Snowflake", "Databricks",
            "Python", ".NET", "React", "TypeScript", "Node.js", "LangChain", "Semantic Kernel", "Docker" })
    };
    List<Entity> ReadRows(string table, string name, bool sorted)
    {
        var query = new QueryExpression(table) {
            ColumnSet = sorted ? new ColumnSet(name, "statecode", "statuscode", "ownerid", "nx_sortordernumber")
                : new ColumnSet(name, "statecode", "statuscode", "ownerid"),
            PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 }
        };
        query.AddOrder(table + "id", OrderType.Ascending);
        var result = new List<Entity>();
        EntityCollection page;
        do {
            page = service.RetrieveMultiple(query);
            result.AddRange(page.Entities);
            query.PageInfo.PageNumber++;
            query.PageInfo.PagingCookie = page.PagingCookie;
        } while (page.MoreRecords);
        return result;
    }
    string Snapshot(Entity row, string name) => JsonSerializer.Serialize(new {
        row.Id, Name = row.GetAttributeValue<string>(name),
        State = row.GetAttributeValue<OptionSetValue>("statecode")?.Value,
        Status = row.GetAttributeValue<OptionSetValue>("statuscode")?.Value,
        Owner = row.GetAttributeValue<EntityReference>("ownerid")?.Id,
        Sort = row.GetAttributeValue<int?>("nx_sortordernumber")
    });
    var before = new Dictionary<string, List<Entity>>();
    var requests = new OrganizationRequestCollection();
    foreach (var definition in definitions)
    {
        var rows = ReadRows(definition.Table, definition.Name, definition.Sorted);
        before.Add(definition.Table, rows);
        for (var index = 0; index < definition.Names.Length; index++)
        {
            var name = definition.Names[index];
            var matches = rows.Where(row => string.Equals(row.GetAttributeValue<string>(definition.Name)?.Trim(), name, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (matches.Length > 1 || (matches.Length == 1 && matches[0].GetAttributeValue<OptionSetValue>("statecode")?.Value != 0))
                throw new InvalidOperationException($"Resolve duplicate or inactive reference before seeding: {definition.Table} / {name}.");
            if (matches.Length == 1) continue;
            var entity = new Entity(definition.Table, Guid.NewGuid()) { [definition.Name] = name };
            if (definition.Sorted) entity["nx_sortordernumber"] = (index + 1) * 10;
            requests.Add(new CreateRequest { Target = entity });
            Console.WriteLine($"ADD {definition.Table}: {name}");
        }
        Console.WriteLine($"{definition.Table}: {rows.Count} existing; {definition.Names.Length} approved names.");
    }
    Console.WriteLine($"Plan: {requests.Count} creates; no updates, deletes, associations, schema, roles or app publication.");
    if (options.Length == 0) { Console.WriteLine("Read-only preview. --execute requires approval of the listed taxonomy."); return; }
    if (requests.Count > 0) service.Execute(new ExecuteTransactionRequest { Requests = requests, ReturnResponses = false });
    foreach (var definition in definitions)
    {
        var rows = ReadRows(definition.Table, definition.Name, definition.Sorted);
        foreach (var original in before[definition.Table])
        {
            var current = rows.SingleOrDefault(row => row.Id == original.Id);
            if (current == null || Snapshot(original, definition.Name) != Snapshot(current, definition.Name))
                throw new InvalidOperationException($"Existing reference changed during seeding: {definition.Table} / {original.Id}. Inspect before retrying.");
        }
        foreach (var name in definition.Names)
        {
            var matches = rows.Where(row => string.Equals(row.GetAttributeValue<string>(definition.Name)?.Trim(), name, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (matches.Length != 1 || matches[0].GetAttributeValue<OptionSetValue>("statecode")?.Value != 0)
                throw new InvalidOperationException($"Reference verification failed: {definition.Table} / {name}. Inspect before retrying.");
        }
        Console.WriteLine($"VERIFIED {definition.Table}: {rows.Count} rows; all approved names active and unique; existing rows unchanged.");
    }
}

static void AssignAcceptance(IOrganizationService service, string[] options)
{
    if (options.Length > 1 || (options.Length == 1 && options[0] != "--execute")) throw new ArgumentException("Use assign-acceptance [--execute]. Without --execute this is read-only.");
    var execute = options.Length == 1;
    var approved = new[] {
        (Email: "jcastelblanco@nextant.com", Role: "PRISMA Contributor", Profile: "PRISMA Contributor", Reader: false),
        (Email: "mparry@nextant.com", Role: "PRISMA Contributor", Profile: "PRISMA Contributor", Reader: false),
        (Email: "lpreciado@nextant.com", Role: "PRISMA Librarian", Profile: "PRISMA Core Draft Librarian", Reader: false),
        (Email: "mcubillos@nextant.com", Role: "PRISMA CSM", Profile: "PRISMA CSM", Reader: true),
    };
    Entity Unique(string table, string column, string value, ColumnSet columns, Guid? unit = null)
    {
        var query = new QueryExpression(table) { ColumnSet = columns, TopCount = 2 };
        query.Criteria.AddCondition(column, ConditionOperator.Equal, value);
        if (unit.HasValue) query.Criteria.AddCondition("businessunitid", ConditionOperator.Equal, unit.Value);
        var rows = service.RetrieveMultiple(query).Entities;
        if (rows.Count != 1) throw new InvalidOperationException($"Expected one {table} matching {value}; found {rows.Count}. No assignments applied.");
        return rows[0];
    }
    ManyToManyRelationshipMetadata RelationshipMetadata(string schema, string target)
    {
        var response = (RetrieveRelationshipResponse)service.Execute(new RetrieveRelationshipRequest { Name = schema });
        if (response.RelationshipMetadata is not ManyToManyRelationshipMetadata relationship
            || !((relationship.Entity1LogicalName == "systemuser" && relationship.Entity2LogicalName == target)
                || (relationship.Entity2LogicalName == "systemuser" && relationship.Entity1LogicalName == target)))
            throw new InvalidOperationException($"Unexpected relationship {schema}.");
        return relationship;
    }
    HashSet<Guid> Members(Guid user, ManyToManyRelationshipMetadata relationship)
    {
        var userColumn = relationship.Entity1LogicalName == "systemuser" ? relationship.Entity1IntersectAttribute : relationship.Entity2IntersectAttribute;
        var targetColumn = relationship.Entity1LogicalName == "systemuser" ? relationship.Entity2IntersectAttribute : relationship.Entity1IntersectAttribute;
        var query = new QueryExpression(relationship.IntersectEntityName) { ColumnSet = new ColumnSet(targetColumn) };
        query.Criteria.AddCondition(userColumn, ConditionOperator.Equal, user);
        return service.RetrieveMultiple(query).Entities.Select(row => row.GetAttributeValue<Guid>(targetColumn)).ToHashSet();
    }
    var roles = RelationshipMetadata("systemuserroles_association", "role");
    var profiles = RelationshipMetadata("systemuserprofiles_association", "fieldsecurityprofile");
    var teams = RelationshipMetadata("teammembership_association", "team");
    var readers = Unique("team", "name", "PRISMA Published Readers", new ColumnSet("teamtype"));
    if (readers.GetAttributeValue<OptionSetValue>("teamtype")?.Value != 0) throw new InvalidOperationException("Published Readers must be the existing owner team.");
    var requests = new OrganizationRequestCollection();
    var checks = new List<(Guid User, string Email, ManyToManyRelationshipMetadata Relationship, HashSet<Guid> Before, Guid Required)>();
    void Plan(Entity user, string email, Entity target, ManyToManyRelationshipMetadata relationship, string label)
    {
        var before = Members(user.Id, relationship);
        checks.Add((user.Id, email, relationship, before, target.Id));
        if (before.Contains(target.Id)) { Console.WriteLine($"Already assigned: {email} -> {label}"); return; }
        Console.WriteLine($"ADD: {email} -> {label}");
        if (target.LogicalName == "team") requests.Add(new AddMembersTeamRequest { TeamId = target.Id, MemberIds = new[] { user.Id } });
        else requests.Add(new AssociateRequest { Target = user.ToEntityReference(), Relationship = new Relationship(relationship.SchemaName), RelatedEntities = new EntityReferenceCollection { target.ToEntityReference() } });
    }
    foreach (var assignment in approved)
    {
        var user = Unique("systemuser", "domainname", assignment.Email, new ColumnSet("fullname", "isdisabled", "businessunitid"));
        if (user.GetAttributeValue<bool>("isdisabled")) throw new InvalidOperationException($"Account {assignment.Email} is disabled.");
        var unit = user.GetAttributeValue<EntityReference>("businessunitid")?.Id ?? throw new InvalidOperationException("User business unit missing.");
        var role = Unique("role", "name", assignment.Role, new ColumnSet("name"), unit);
        var profile = Unique("fieldsecurityprofile", "name", assignment.Profile, new ColumnSet("name"));
        Plan(user, assignment.Email, role, roles, $"role {assignment.Role}");
        Plan(user, assignment.Email, profile, profiles, $"profile {assignment.Profile}");
        if (assignment.Reader) Plan(user, assignment.Email, readers, teams, "team PRISMA Published Readers");
    }
    Console.WriteLine($"{requests.Count} additive associations planned; existing roles/profiles/memberships will not be removed.");
    if (!execute) { Console.WriteLine("Preview only. Use --execute only after approval of these exact assignments."); return; }
    if (requests.Count > 0) service.Execute(new ExecuteTransactionRequest { Requests = requests, ReturnResponses = false });
    foreach (var check in checks)
    {
        var after = Members(check.User, check.Relationship);
        if (!after.Contains(check.Required) || !check.Before.IsSubsetOf(after)) throw new InvalidOperationException($"Assignment verification failed for {check.Email}: {check.Relationship.SchemaName}.");
    }
    Console.WriteLine("Verified all approved assignments and preservation of every preexisting association in the checked relationships. No role definitions, schema or app publication changed.");
}

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
// The Specialization Area N:N was created in Default only; add it so exporting PRISMA_Dev carries it.
var areaRelationship = ((RetrieveRelationshipResponse)client.Execute(new RetrieveRelationshipRequest { Name = "nx_Solution_nx_SpecializationArea_nx_SpecializationArea" })).RelationshipMetadata;
AddComponent(client, areaRelationship.MetadataId!.Value, 10);
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
    // Read only, at User depth for every role including the Librarian: nobody reads another person's favorites directly.
    // Create/Delete go through nx_SetFavorite, which writes as the server after checking the caller can read the solution.
    foreach (var privilege in Metadata(client, "nx_solutionfavorite").Privileges.Where(privilege => privilege.PrivilegeType == PrivilegeType.Read))
        privileges.Add(new RolePrivilege((int)PrivilegeDepth.Basic, privilege.PrivilegeId));
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
RegisterApi(client, PluginType(client, assemblyId, "Prisma.Plugins.CatalogueApi"), "nx_GetCatalogueGraph", "prvReadnx_Solution", new[] { ("Present", 0, false) });
// nx_solutionfavorite's schema name is lowercase (accepted quirk, see SchemaV2), so its generated privilege names are too.
var favoriteType = PluginType(client, assemblyId, "Prisma.Plugins.FavoriteApi");
RegisterApi(client, favoriteType, "nx_SetFavorite", "prvReadnx_solutionfavorite", new[] { ("SolutionId", 12, false), ("Saved", 0, false) });
RegisterApi(client, favoriteType, "nx_GetMyFavorites", "prvReadnx_solutionfavorite", Array.Empty<(string, int, bool)>());
RegisterApi(client, favoriteType, "nx_GetTopFavorites", "prvReadnx_solutionfavorite", Array.Empty<(string, int, bool)>());
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
    var label = "[PRISMA TEST] Core draft " + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
    var payload = JsonSerializer.Serialize(new { name = label, summary = "Non-sensitive persistence verification." });
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
        ["DraftJson"] = JsonSerializer.Serialize(new { name = label, summary = "Non-sensitive deletion verification." })
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
        technologyIds = new[] { technology.ToString(), createdTechnologyId.ToString() }, industryIds = Array.Empty<string>(), projectIds = new[] { project.ToString() },
        areaIds = new[] { area.ToString() }
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
    var area = Reference("nx_specializationarea", "nx_specializationareaid");
    var read = new OrganizationRequest("nx_GetDraftGraph") { ["SolutionId"] = identifier };
    var before = JsonDocument.Parse((string)service.Execute(read)["ResultJson"]).RootElement;
    var payload = JsonSerializer.Serialize(new {
        contributors = new[] { new { personId = person.ToString(), directHours = 12.5m } },
        technologyIds = new[] { technology.ToString() }, industryIds = new[] { industry.ToString() }, projectIds = Array.Empty<string>(),
        areaIds = new[] { area.ToString() }
    });
    var save = new OrganizationRequest("nx_SaveDraftGraph") {
        ["SolutionId"] = identifier, ["ExpectedRowVersion"] = before.GetProperty("rowVersion").GetString(), ["GraphJson"] = payload
    };
    var after = JsonDocument.Parse((string)service.Execute(save)["ResultJson"]).RootElement;
    if (after.GetProperty("graph").GetProperty("contributors").GetArrayLength() != 1 || after.GetProperty("hours")[0].GetDecimal() != 12.5m)
        throw new InvalidOperationException("Contributor round trip failed.");
    if (after.GetProperty("graph").GetProperty("technologyIds").GetArrayLength() != 1 || after.GetProperty("graph").GetProperty("industryIds").GetArrayLength() != 1
        || after.GetProperty("graph").GetProperty("areaIds").GetArrayLength() != 1)
        throw new InvalidOperationException("Tag round trip failed.");
    AssertRejected(() => service.Execute(save), "stale graph save");
    var child = Guid.Parse(after.GetProperty("graph").GetProperty("contributors")[0].GetProperty("id").GetString()!);
    AssertRejected(() => service.Update(new Entity("nx_solutioncontributor", child) { ["nx_directhours"] = 999m }), "direct contributor update");
    AssertRejected(() => service.Disassociate("nx_solution", identifier, new Relationship("nx_Solution_nx_Technology_nx_Technology"), new EntityReferenceCollection { new EntityReference("nx_technology", technology) }), "direct tag removal");
    var reopened = JsonDocument.Parse((string)service.Execute(read)["ResultJson"]).RootElement;
    if (reopened.GetProperty("rowVersion").GetString() != after.GetProperty("rowVersion").GetString()) throw new InvalidOperationException("Rejected write changed the draft.");
    Console.WriteLine($"PASS: graph save/reopen, computed effort, tag links and direct-write/concurrency guards. Test draft {identifier} retained.");
}

static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

static System.Security.Cryptography.X509Certificates.X509Certificate2 SigningCertificate(string path)
{
    if (AssemblyName.GetAssemblyName(path).Name != "Prisma.Plugins") throw new InvalidOperationException("Unexpected assembly file.");
    try
    {
#pragma warning disable SYSLIB0057
        return new System.Security.Cryptography.X509Certificates.X509Certificate2(System.Security.Cryptography.X509Certificates.X509Certificate.CreateFromSignedFile(path));
#pragma warning restore SYSLIB0057
    }
    catch (System.Security.Cryptography.CryptographicException) { throw new InvalidOperationException("The plug-in assembly has no Authenticode signature; managed identity requires signtool signing."); }
}

// Read-only: prints the federated credential subject for the pilot template (Power Platform managed identity version 2).
static void PluginSubject(string[] options)
{
    if (options.Length < 1 || options.Length > 2 || (options.Length == 2 && options[1] != "--self-signed")) throw new ArgumentException("Use plugin-subject <signed-plugin.dll> [--self-signed]. Read-only.");
    var certificate = SigningCertificate(Path.GetFullPath(options[0]));
    var tenant = Base64Url(Guid.Parse("d232b207-f86f-4fba-8891-ccbf30b12898").ToByteArray());
    var prefix = $"/eid1/c/pub/t/{tenant}/a/qzXoWDkuqUa3l6zM5mM0Rw/n/plugin/e/ce09ad9b-57d1-e5df-9400-8ce973c86213";
    var sha = (string value) => Base64Url(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));
    Console.WriteLine($"Signer subject: {certificate.Subject}; issuer: {certificate.Issuer}; expires {certificate.NotAfter:u}.");
    Console.WriteLine(options.Length == 2
        ? $"{prefix}/h/{Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(certificate.RawData)).ToLowerInvariant()}"
        : $"{prefix}/i/{sha(certificate.Issuer)}/s/{sha(certificate.Subject)}");
    Console.WriteLine("Set PRISMA_PILOT_PLUGIN_SUBJECT to this value. Self-signed certificates are for development/test only.");
}

static void BlobSchema(IOrganizationService service, string[] options)
{
    if (options.Length > 1 || (options.Length == 1 && options[0] != "--execute")) throw new ArgumentException("Use blob-schema [--execute]; preview is read-only.");
    var attributes = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest { LogicalName = "nx_uploadsession", EntityFilters = EntityFilters.Attributes, RetrieveAsIfPublished = true })).EntityMetadata.Attributes;
    var fields = new[] { ("nx_Storage", "Storage provider", 20), ("nx_BlobName", "Blob name", 100), ("nx_BlobETag", "Blob version", 100), ("nx_HashState", "Upload hash state", 100) };
    var missing = new List<(string Schema, string Label, int Length)>();
    foreach (var field in fields)
    {
        var existing = attributes.SingleOrDefault(attribute => attribute.LogicalName == field.Item1.ToLowerInvariant());
        if (existing == null) missing.Add(field);
        else if (existing is not StringAttributeMetadata text || text.MaxLength != field.Item3) throw new InvalidOperationException($"Unexpected metadata for {field.Item1}.");
    }
    var variables = new[] { ("nx_MediaBlobContainerUrl", "PRISMA media Blob container URL", 100000000, (string?)null), ("nx_MediaBlobUploads", "PRISMA media Blob uploads", 100000002, (string?)"no") };
    var absent = new List<(string Schema, string Label, int Type, string? Default)>();
    foreach (var variable in variables)
    {
        var existing = Find(service, "environmentvariabledefinition", "schemaname", variable.Item1);
        if (existing == null) { absent.Add(variable); continue; }
        if (service.Retrieve("environmentvariabledefinition", existing.Id, new ColumnSet("type")).GetAttributeValue<OptionSetValue>("type")?.Value != variable.Item3) throw new InvalidOperationException($"Unexpected type for {variable.Item1}.");
    }
    Console.WriteLine($"Plan: add private nx_uploadsession columns [{string.Join(", ", missing.Select(field => field.Schema))}] and publish only nx_uploadsession; " +
        $"create PRISMA_Dev environment variables [{string.Join(", ", absent.Select(variable => variable.Schema))}] with uploads defaulting to no. No rows, roles, plug-ins or apps change.");
    if (options.Length == 0) { Console.WriteLine("Read-only preview. No changes made."); return; }
    foreach (var field in missing)
        service.Execute(new CreateAttributeRequest { EntityName = "nx_uploadsession", SolutionUniqueName = "PRISMA_Dev",
            Attribute = new StringAttributeMetadata { SchemaName = field.Schema, DisplayName = new Label(field.Label, 1033), MaxLength = field.Length } });
    if (missing.Count != 0) service.Execute(new PublishXmlRequest { ParameterXml = "<importexportxml><entities><entity>nx_uploadsession</entity></entities></importexportxml>" });
    foreach (var variable in absent)
        Create(service, new Entity("environmentvariabledefinition") { ["schemaname"] = variable.Schema, ["displayname"] = variable.Label, ["type"] = new OptionSetValue(variable.Type),
            ["defaultvalue"] = variable.Default, ["description"] = "Read by the PRISMA media plug-ins. Uploads stay in Dataverse unless explicitly enabled." });
    Console.WriteLine("Blob media schema and configuration definitions are in place; uploads remain disabled.");
}

static void RegisterCatalogueApi(IOrganizationService service, string[] options)
{
    if (options.Length > 1 || (options.Length == 1 && options[0] != "--execute")) throw new ArgumentException("Use catalogue-api [--execute]; preview is read-only. Execution requires explicit approval.");
    var assembly = Find(service, "pluginassembly", "name", "Prisma.Plugins") ?? throw new InvalidOperationException("Existing assembly missing.");
    if (assembly.Id != Guid.Parse("08207a52-1ab6-f111-aaac-6045bd049fba")) throw new InvalidOperationException("Unexpected assembly target.");
    var existing = Find(service, "customapi", "uniquename", "nx_GetCatalogueGraph");
    Console.WriteLine(existing != null
        ? "nx_GetCatalogueGraph is already registered; --execute only adds anything missing."
        : "Plan: register nx_GetCatalogueGraph (required Boolean Present, String ResultJson) on Prisma.Plugins.CatalogueApi with execute privilege prvReadnx_Solution, in PRISMA_Dev. Push a signed assembly containing CatalogueApi first (blob-plugin --execute). No roles, data or apps change.");
    if (options.Length == 0) { Console.WriteLine("Read-only preview. No changes made."); return; }
    RegisterApi(service, PluginType(service, assembly.Id, "Prisma.Plugins.CatalogueApi"), "nx_GetCatalogueGraph", "prvReadnx_Solution", new[] { ("Present", 0, false) });
    Console.WriteLine("Registered nx_GetCatalogueGraph. Generate its client from app/connected: pa app add dataverse-api --api-name nx_GetCatalogueGraph.");
}

static void BlobPlugin(IOrganizationService service, string[] options)
{
    if (options.Length != 0 && (options.Length != 2 || options[0] != "--execute")) throw new ArgumentException("Use blob-plugin [--execute <signed-plugin.dll>]. Execution requires explicit approval.");
    var assembly = Find(service, "pluginassembly", "name", "Prisma.Plugins") ?? throw new InvalidOperationException("Existing assembly missing.");
    if (assembly.Id != Guid.Parse("08207a52-1ab6-f111-aaac-6045bd049fba")) throw new InvalidOperationException("Unexpected assembly target.");
    if (!((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest { LogicalName = "nx_uploadsession", EntityFilters = EntityFilters.Attributes })).EntityMetadata.Attributes.Any(attribute => attribute.LogicalName == "nx_hashstate"))
        throw new InvalidOperationException("Run blob-schema first; the updated plug-in reads the new session columns.");
    Console.WriteLine("Plan: update the existing assembly; register asynchronous post-delete nx_uploadsession step PRISMA.Media.BlobDeletion with a 'session' pre-image; add optional Int32 parameter nx_BeginResumableUpload.BlockSize if missing. No roles or apps change.");
    if (options.Length == 0) { Console.WriteLine("Read-only preview. No changes made."); return; }
    var path = Path.GetFullPath(options[1]);
    var signer = SigningCertificate(path);
    Console.WriteLine($"Signed by {signer.Subject}.");
    service.Update(new Entity("pluginassembly", assembly.Id) { ["content"] = Convert.ToBase64String(File.ReadAllBytes(path)) });
    var deletionType = PluginType(service, assembly.Id, "Prisma.Plugins.BlobDeletion");
    var message = Find(service, "sdkmessage", "name", "Delete") ?? throw new InvalidOperationException("Missing Delete message.");
    var filter = new QueryExpression("sdkmessagefilter") { ColumnSet = new ColumnSet(false) };
    filter.Criteria.AddCondition("sdkmessageid", ConditionOperator.Equal, message.Id);
    filter.Criteria.AddCondition("primaryobjecttypecode", ConditionOperator.Equal, "nx_uploadsession");
    const string stepName = "PRISMA.Media.BlobDeletion";
    var step = Save(service, new Entity("sdkmessageprocessingstep") {
        ["name"] = stepName, ["eventhandler"] = new EntityReference("plugintype", deletionType), ["sdkmessageid"] = new EntityReference("sdkmessage", message.Id),
        ["sdkmessagefilterid"] = new EntityReference("sdkmessagefilter", service.RetrieveMultiple(filter).Entities.Single().Id),
        ["stage"] = new OptionSetValue(40), ["mode"] = new OptionSetValue(1), ["rank"] = 1, ["supporteddeployment"] = new OptionSetValue(0), ["asyncautodelete"] = true
    }, Find(service, "sdkmessageprocessingstep", "name", stepName));
    AddComponent(service, step, 92);
    var images = new QueryExpression("sdkmessageprocessingstepimage") { ColumnSet = new ColumnSet(false) };
    images.Criteria.AddCondition("sdkmessageprocessingstepid", ConditionOperator.Equal, step);
    images.Criteria.AddCondition("entityalias", ConditionOperator.Equal, "session");
    Save(service, new Entity("sdkmessageprocessingstepimage") {
        ["sdkmessageprocessingstepid"] = new EntityReference("sdkmessageprocessingstep", step), ["imagetype"] = new OptionSetValue(0), ["entityalias"] = "session", ["name"] = "session",
        ["messagepropertyname"] = "Target", ["attributes"] = "nx_storage,nx_blobname,nx_blobetag,nx_complete,nx_parentid,nx_targetid"
    }, service.RetrieveMultiple(images).Entities.SingleOrDefault());
    RegisterApi(service, PluginType(service, assembly.Id, "Prisma.Plugins.MediaTransferApi"), "nx_BeginResumableUpload", "prvWritenx_Solution", new[] {
        ("SolutionId", 12, false), ("ExpectedRowVersion", 10, false), ("FileName", 10, false), ("Size", 7, false), ("Sha256", 10, false), ("BlockSize", 7, true) });
    Console.WriteLine("Blob-capable assembly and post-commit deletion step registered. Uploads remain governed by nx_MediaBlobUploads.");
}

static void BindManagedIdentity(IOrganizationService service, string[] options)
{
    var execute = options.Length == 2 && options[0] == "--execute";
    if ((options.Length != 1 && !execute) || !Guid.TryParse(options[^1], out var clientId)) throw new ArgumentException("Use bind-managed-identity [--execute] <plugin-identity-client-id>. Preview is read-only.");
    var tenant = Guid.Parse("d232b207-f86f-4fba-8891-ccbf30b12898");
    var assembly = service.Retrieve("pluginassembly", Guid.Parse("08207a52-1ab6-f111-aaac-6045bd049fba"), new ColumnSet("name", "managedidentityid"));
    if (assembly.GetAttributeValue<string>("name") != "Prisma.Plugins") throw new InvalidOperationException("Unexpected assembly target.");
    var bound = assembly.GetAttributeValue<EntityReference>("managedidentityid");
    if (bound != null)
    {
        var record = service.Retrieve("managedidentity", bound.Id, new ColumnSet("applicationid", "tenantid", "version"));
        Console.WriteLine($"Assembly already bound to managed identity {bound.Id}: application {record.GetAttributeValue<Guid>("applicationid")}, tenant {record.GetAttributeValue<Guid>("tenantid")}, version {record.GetAttributeValue<object>("version")}.");
        if (record.GetAttributeValue<Guid>("applicationid") != clientId || record.GetAttributeValue<Guid>("tenantid") != tenant) throw new InvalidOperationException("The existing binding differs; resolve it explicitly instead of rebinding.");
        return;
    }
    var columns = ((RetrieveEntityResponse)service.Execute(new RetrieveEntityRequest { LogicalName = "managedidentity", EntityFilters = EntityFilters.Attributes })).EntityMetadata.Attributes;
    foreach (var (name, type) in new[] { ("applicationid", AttributeTypeCode.Uniqueidentifier), ("tenantid", AttributeTypeCode.Uniqueidentifier), ("credentialsource", AttributeTypeCode.Picklist), ("subjectscope", AttributeTypeCode.Picklist), ("version", AttributeTypeCode.Integer) })
        if (columns.SingleOrDefault(column => column.LogicalName == name)?.AttributeType != type) throw new InvalidOperationException($"Unexpected managedidentity.{name} metadata; reassess before binding.");
    Console.WriteLine($"Plan: create a version 2 managed identity record for application {clientId} in tenant {tenant} and bind assembly Prisma.Plugins. The federated credential must already exist on that identity.");
    if (!execute) { Console.WriteLine("Read-only preview. No changes made."); return; }
    var identity = Create(service, new Entity("managedidentity") {
        ["name"] = "PRISMA media plug-in", ["applicationid"] = clientId, ["tenantid"] = tenant,
        ["credentialsource"] = new OptionSetValue(2), ["subjectscope"] = new OptionSetValue(1), ["version"] = 2
    });
    service.Update(new Entity("pluginassembly", assembly.Id) { ["managedidentityid"] = new EntityReference("managedidentity", identity) });
    Console.WriteLine($"Bound Prisma.Plugins to managed identity record {identity}.");
}

static void SetBlobConfig(IOrganizationService service, string[] options)
{
    var execute = options.FirstOrDefault() == "--execute";
    var values = options.Skip(execute ? 1 : 0).ToArray();
    if (values.Length != 2 || (values[1] != "yes" && values[1] != "no")
        || !System.Text.RegularExpressions.Regex.IsMatch(values[0], "\\Ahttps://[a-z0-9]{3,24}\\.blob\\.core\\.windows\\.net/[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,62}\\z"))
        throw new ArgumentException("Use set-blob-config [--execute] <https://account.blob.core.windows.net/container> <yes|no>. Preview is read-only.");
    var changes = new List<(Guid Definition, Entity? Current, string Value)>();
    foreach (var (schema, value) in new[] { ("nx_MediaBlobContainerUrl", values[0]), ("nx_MediaBlobUploads", values[1]) })
    {
        var definition = Find(service, "environmentvariabledefinition", "schemaname", schema) ?? throw new InvalidOperationException($"Run blob-schema first; {schema} is missing.");
        var current = Find(service, "environmentvariablevalue", "environmentvariabledefinitionid", definition.Id);
        var existing = current == null ? null : service.Retrieve("environmentvariablevalue", current.Id, new ColumnSet("value")).GetAttributeValue<string>("value");
        Console.WriteLine($"{schema}: {existing ?? "(default)"} -> {value}");
        changes.Add((definition.Id, current, value));
    }
    if (!execute) { Console.WriteLine("Read-only preview. No changes made."); return; }
    foreach (var change in changes)
    {
        if (change.Current == null) service.Create(new Entity("environmentvariablevalue") { ["environmentvariabledefinitionid"] = new EntityReference("environmentvariabledefinition", change.Definition), ["value"] = change.Value });
        else service.Update(new Entity("environmentvariablevalue", change.Current.Id) { ["value"] = change.Value });
    }
    Console.WriteLine("Blob media configuration updated; running plug-ins pick it up within 60 seconds. Existing files keep their original storage; setting uploads to no is the rollback for new uploads.");
}

static void SmokeBlob(IOrganizationService service, string[] options)
{
    if (options.Length is < 1 or > 2 || (options.Length == 2 && options[1] is not ("v3" or "v4" or "v5"))) throw new ArgumentException("Use smoke-blob <non-sensitive .pdf|.html|.mp4 up to 60 MiB> [v3|v4|v5]. Creates and deletes one labelled test draft.");
    var protocol = options.Length == 2 ? options[1] : "v3";
    var blockSize = protocol == "v5" ? 16777216 : protocol == "v4" ? 8388608 : 4194304;
    var file = new FileInfo(options[0]);
    if (!new[] { ".pdf", ".html", ".mp4" }.Contains(file.Extension.ToLowerInvariant()) || file.Length == 0 || file.Length > 60 * 1024 * 1024) throw new ArgumentException("Use a non-empty PDF, HTML or MP4 fixture up to 60 MiB.");
    var bytes = File.ReadAllBytes(file.FullName);
    var digest = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)).ToLowerInvariant();
    var draft = JsonDocument.Parse((string)service.Execute(new OrganizationRequest("nx_SaveCoreDraft") {
        ["DraftJson"] = JsonSerializer.Serialize(new { name = "[PRISMA TEST] Blob media acceptance", summary = "Disposable Blob storage verification." })
    })["ResultJson"]).RootElement;
    var id = Guid.Parse(draft.GetProperty("id").GetString()!);
    Console.WriteLine($"Created disposable Blob draft {id}.");
    var version = draft.GetProperty("rowVersion").GetString()!;
    JsonElement Call(string name, params (string Name, object Value)[] values)
    {
        var request = new OrganizationRequest(name) { ["SolutionId"] = id };
        if (name != "nx_ReadVideoRange") request["ExpectedRowVersion"] = version;
        foreach (var value in values) request[value.Name] = value.Value;
        var result = JsonDocument.Parse((string)service.Execute(request)["ResultJson"]).RootElement;
        if (result.TryGetProperty("rowVersion", out var next)) version = next.GetString()!;
        if (result.ToString().Contains("blob.core.windows.net", StringComparison.OrdinalIgnoreCase) || result.ToString().Contains("nx_blob", StringComparison.Ordinal)) throw new InvalidOperationException("Storage reference escaped.");
        return result;
    }
    try
    {
        var started = Call("nx_BeginMediaUpload", ("Kind", "attachment:" + protocol), ("FileName", file.Name), ("Size", bytes.Length));
        var session = Guid.Parse(started.GetProperty("sessionId").GetString()!);
        var record = started.GetProperty("media").EnumerateArray().Single(item => item.GetProperty("sessionId").GetString() == session.ToString());
        if (!record.TryGetProperty("storage", out var storage) || storage.GetString() != "blob") throw new InvalidOperationException("Upload did not select Blob storage; check nx_MediaBlobUploads.");
        if (started.GetProperty("blockSize").GetInt32() != blockSize) throw new InvalidOperationException($"Server did not negotiate {blockSize}-byte blocks.");
        var asset = Guid.Parse(record.GetProperty("id").GetString()!);
        var upload = System.Diagnostics.Stopwatch.StartNew();
        long serverMs = 0, hashMs = 0, storageMs = 0;
        var blocks = 0;
        for (var index = 0; index * blockSize < bytes.Length; index++, blocks++)
        {
            var block = bytes.AsSpan(index * blockSize, Math.Min(blockSize, bytes.Length - index * blockSize)).ToArray();
            var progress = Call("nx_UploadMediaBlock", ("SessionId", session), ("BlockIndex", index), ("Content", Convert.ToBase64String(block)));
            long Reported(string name) => progress.TryGetProperty(name, out var value) ? value.GetInt64() : 0;
            serverMs += Reported("serverMs"); hashMs += Reported("hashMs"); storageMs += Reported("storageMs");
        }
        var blocksMs = upload.ElapsedMilliseconds;
        Call("nx_FinishMediaUpload", ("SessionId", session));
        Console.WriteLine($"TIMING {protocol} {bytes.Length} bytes, {blocks} blocks: blocks {blocksMs} ms (plug-in {serverMs} ms = hash {hashMs} + storage {storageMs} + Dataverse {serverMs - hashMs - storageMs}; outside plug-in {blocksMs - serverMs} ms), finish {upload.ElapsedMilliseconds - blocksMs} ms, {bytes.Length / 1048576.0 / (upload.ElapsedMilliseconds / 1000.0):F2} MiB/s.");
        AssertRejected(() => service.Update(new Entity("nx_uploadsession", session) { ["nx_blobname"] = "forged" }), "direct Blob reference change");
        string? rangeVersion = null;
        using var hash = System.Security.Cryptography.IncrementalHash.CreateHash(System.Security.Cryptography.HashAlgorithmName.SHA256);
        var timer = System.Diagnostics.Stopwatch.StartNew();
        var readSize = 1048576;
        long readServerMs = 0;
        for (var offset = 0; offset < bytes.Length;)
        {
            var range = Call("nx_ReadVideoRange", ("AssetId", asset), ("Mode", "submission"), ("Offset", offset), ("Count", readSize), ("Version", rangeVersion ?? ""));
            rangeVersion ??= range.GetProperty("version").GetString();
            var data = Convert.FromBase64String(range.GetProperty("content").GetString()!);
            hash.AppendData(data);
            offset += data.Length;
            if (range.TryGetProperty("serverMs", out var readMs)) readServerMs += readMs.GetInt64();
            if (range.TryGetProperty("maxRead", out var maxRead)) readSize = maxRead.GetInt32();
        }
        Console.WriteLine($"READ {readSize}-byte ranges: plug-in {readServerMs} ms of {timer.ElapsedMilliseconds} ms.");
        if (Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant() != digest) throw new InvalidOperationException("Blob range checksum mismatch.");
        AssertRejected(() => Call("nx_ReadVideoRange", ("AssetId", asset), ("Mode", "present"), ("Offset", 0), ("Count", 1)), "draft present read");
        AssertRejected(() => Call("nx_ReadVideoRange", ("AssetId", asset), ("Mode", "submission"), ("Offset", 0), ("Count", 1), ("Version", "stale")), "stale range version");
        Console.WriteLine($"PASS Blob upload, digest-verified finalization and protected ranges: {bytes.Length} bytes in {timer.Elapsed.TotalSeconds:F1}s readback; SHA256 {digest}.");
    }
    finally
    {
        Call("nx_TransitionSubmission", ("Action", "delete"), ("Comments", ""), ("Cleared", false));
        Console.WriteLine($"Deleted disposable draft {id}. Blob deletion runs asynchronously; confirm the PRISMA.Media.BlobDeletion system job succeeded.");
    }
}
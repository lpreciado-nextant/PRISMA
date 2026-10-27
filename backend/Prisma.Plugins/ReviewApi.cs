using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    public static class ReviewPolicy
    {
        public const string Transition = "nx_TransitionSubmission";
        public const int Published = 125060000;
        public const int Retired = 125060001;
        public const int Pending = 125060002;

        public static string TechnologyName(string value)
        {
            var name = (value ?? "").Trim();
            if (name.Length == 0 || name.Length > 100 || name.Any(char.IsControl)) throw MediaPolicy.Invalid("Technology name must contain 1-100 characters without control characters.");
            return name;
        }

        public static Entity Change(Entity parent, Guid caller, bool librarian, string expected, string action, string comments, bool cleared)
        {
            if (string.IsNullOrEmpty(expected) || expected != parent.RowVersion) throw MediaPolicy.Invalid("This submission changed. Reopen it before continuing.");
            var owner = parent.GetAttributeValue<EntityReference>("ownerid");
            var owns = owner?.LogicalName == "systemuser" && owner.Id == caller;
            var status = parent.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value;
            var unreported = parent.GetAttributeValue<bool>(DraftPolicy.LibrarianEditPending);
            var editing = action == "media" || action == "technology" || action == "asset";
            var change = new Entity("nx_solution", parent.Id) { RowVersion = expected, ["nx_clientsafereviewed"] = false };
            // Any decision or ownership change settles an unreported librarian edit: its comment is what the owner reads.
            if (unreported && !editing) change[DraftPolicy.LibrarianEditPending] = false;
            if (action == "submit" && owns && status == DraftPolicy.DraftStatus)
                change["nx_publicationstatus"] = new OptionSetValue(Pending);
            else if (editing && owns && status == DraftPolicy.DraftStatus)
                change["nx_safetyacknowledged"] = false;
            else if (editing && librarian && !owns && (status == Pending || status == Published))
            {
                // A librarian edit (ADR-0013) keeps status, acknowledgment and clearance; the caller records real changes.
                change.Attributes.Remove("nx_clientsafereviewed");
                change["nx_status"] = parent.GetAttributeValue<OptionSetValue>("nx_status");
            }
            else if (action == "delete" && owns && (status == DraftPolicy.DraftStatus || status == Pending || status == Published || status == Retired))
            {
                change["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
                change["nx_safetyacknowledged"] = false;
            }
            else if (action == "withdraw" && owns && (status == Pending || status == Published || status == Retired))
            {
                change["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
                change["nx_safetyacknowledged"] = false;
            }
            else if (action == "return" && librarian && status == Pending)
            {
                if (string.IsNullOrWhiteSpace(comments) || comments.Trim().Length > 4000) throw MediaPolicy.Invalid("Return requires feedback of at most 4000 characters.");
                change["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
                change["nx_reviewoutcome"] = new OptionSetValue(125060001);
                change["nx_reviewcomments"] = comments.Trim();
                change["nx_safetyacknowledged"] = false;
            }
            else if (action == "approve" && librarian && status == Pending)
            {
                if (!cleared) throw MediaPolicy.Invalid("Independent client-safe confirmation is required for approval.");
                if ((comments ?? "").Length > 4000) throw MediaPolicy.Invalid("Review comments exceed 4000 characters.");
                if (unreported && string.IsNullOrWhiteSpace(comments)) throw MediaPolicy.Invalid("You edited this solution. Tell the contributor what you changed and why.");
                change["nx_publicationstatus"] = new OptionSetValue(Published);
                change["nx_clientsafereviewed"] = cleared;
                change["nx_reviewoutcome"] = new OptionSetValue(125060002);
                change["nx_reviewcomments"] = (comments ?? "").Trim();
            }
            else if (action == "request-changes" && librarian && status == Published)
            {
                // A published record found wanting goes back to its owner exactly like a return: out of the library
                // (shares are revoked by the caller), Draft + Changes requested, with the feedback they must act on.
                if (string.IsNullOrWhiteSpace(comments) || comments.Trim().Length > 4000) throw MediaPolicy.Invalid("Requesting changes requires feedback of at most 4000 characters.");
                change["nx_publicationstatus"] = new OptionSetValue(DraftPolicy.DraftStatus);
                change["nx_reviewoutcome"] = new OptionSetValue(125060001);
                change["nx_reviewcomments"] = comments.Trim();
                change["nx_safetyacknowledged"] = false;
            }
            else if (action == "confirm-edit" && librarian && status == Published && unreported)
            {
                // Ends a librarian edit of a published record: the same client-safe confirmation as approval, and the
                // explanation the owner will read. The caller revalidates the record and restores reader access.
                if (!cleared) throw MediaPolicy.Invalid("Independent client-safe confirmation is required to keep this solution published.");
                if (string.IsNullOrWhiteSpace(comments) || comments.Trim().Length > 4000) throw MediaPolicy.Invalid("Tell the contributor what you changed and why, in at most 4000 characters.");
                change["nx_clientsafereviewed"] = true;
                change["nx_reviewcomments"] = comments.Trim();
            }
            else if (action == "retire" && librarian && status == Published)
            {
                // Retirement is for obsolete or replaced records; the reason is what the owner sees.
                if (string.IsNullOrWhiteSpace(comments) || comments.Trim().Length > 4000) throw MediaPolicy.Invalid("Retiring requires a reason of at most 4000 characters.");
                change["nx_publicationstatus"] = new OptionSetValue(Retired);
                change["nx_reviewcomments"] = comments.Trim();
            }
            else throw MediaPolicy.Invalid("This transition is not permitted for your role or the current state.");
            return change;
        }

        public static void Complete(Entity parent, DraftGraphSnapshot graph, IList<Entity> media)
        {
            var name = parent.GetAttributeValue<string>("nx_solutionname");
            if (string.IsNullOrWhiteSpace(name) || name.Length > 100 || name.Equals("Untitled solution", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_onelinesummary"))
                || graph.Graph.AreaIds.Count == 0 || parent.GetAttributeValue<EntityReference>("nx_capability") == null)
                throw MediaPolicy.Invalid("Name, summary, at least one specialization area and capability are required.");
            // nx_whatitdoes and nx_businessvalue are Business Required in Dataverse, which only its own forms enforce.
            if (string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_whatitdoes")) || string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_businessvalue")))
                throw MediaPolicy.Invalid("Describe what the solution does and its business value.");
            if (!parent.GetAttributeValue<bool>("nx_safetyacknowledged")) throw MediaPolicy.Invalid("Renew the safety acknowledgment before submission.");
            if (!string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_clientcontext")) && string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_clientcontextredacted")))
                throw MediaPolicy.Invalid("Provide redacted client context.");
            // nx_complexity is Business Required in Dataverse, which only its own forms enforce; the estimate stays optional.
            if (parent.GetAttributeValue<OptionSetValue>("nx_complexity") == null) throw MediaPolicy.Invalid("Select how complex the solution was to build.");
            ContributorPolicy.Validate(graph.Graph.Contributors, true);
            var images = media.Count(row => row.GetAttributeValue<string>("nx_kind") == "image");
            if (images < 1 || images > 6 || media.Count(row => row.GetAttributeValue<string>("nx_kind") == "attachment") > 6 || media.Count(row => row.GetAttributeValue<string>("nx_kind") == "thumbnail") > 1 || media.Any(row => !row.GetAttributeValue<bool>("nx_complete")))
                throw MediaPolicy.Invalid("Save one to six detail images and finish or remove all uploads.");
        }
    }

    [DataContract]
    public sealed class TechnologyResult
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "rowVersion")] public string RowVersion { get; set; }
        [DataMember(Name = "technologyId")] public string TechnologyId { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
    }

    [DataContract]
    public sealed class DeletedSubmission
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "deleted")] public bool Deleted { get; set; }
    }

    [DataContract]
    public sealed class SubmissionSummary
    {
        [DataMember(Name = "core")] public DraftSnapshot Core { get; set; }
        [DataMember(Name = "areaIds")] public List<string> AreaIds { get; set; }
        [DataMember(Name = "publication")] public int Publication { get; set; }
        [DataMember(Name = "outcome")] public int Outcome { get; set; }
        [DataMember(Name = "comments")] public string Comments { get; set; }
        [DataMember(Name = "cleared")] public bool Cleared { get; set; }
        [DataMember(Name = "owner")] public string Owner { get; set; }
        [DataMember(Name = "dateAdded")] public string DateAdded { get; set; }
        [DataMember(Name = "modifiedOn")] public string ModifiedOn { get; set; }
        [DataMember(Name = "imageCount")] public int ImageCount { get; set; }
        [DataMember(Name = "attachmentCount")] public int AttachmentCount { get; set; }
        [DataMember(Name = "libraryNotes")] public string LibraryNotes { get; set; }
        [DataMember(Name = "librarianEditedOn", EmitDefaultValue = false)] public string LibrarianEditedOn { get; set; }
        [DataMember(Name = "librarianEditedBy", EmitDefaultValue = false)] public string LibrarianEditedBy { get; set; }
        [DataMember(Name = "librarianEditPending")] public bool LibrarianEditPending { get; set; }
    }

    [DataContract]
    public sealed class SubmissionDetail
    {
        [DataMember(Name = "record")] public SubmissionSummary Record { get; set; }
        [DataMember(Name = "graph")] public DraftGraphSnapshot Graph { get; set; }
        [DataMember(Name = "media")] public MediaSnapshot[] Media { get; set; }
        [DataMember(Name = "librarian")] public bool Librarian { get; set; }
        /// <summary>Whether the caller may edit this record as librarian (ADR-0013): someone else's, Pending review or Published.</summary>
        [DataMember(Name = "librarianEdit")] public bool LibrarianEdit { get; set; }
    }

    [DataContract]
    public sealed class SubmissionPage
    {
        [DataMember(Name = "records")] public List<SubmissionSummary> Records { get; set; }
        [DataMember(Name = "moreRecords")] public bool MoreRecords { get; set; }
        [DataMember(Name = "pagingCookie")] public string PagingCookie { get; set; }
        [DataMember(Name = "librarian")] public bool Librarian { get; set; }
        /// <summary>Review queue only: the librarian's scope, for the queue's filters (never an authorization input).</summary>
        [DataMember(Name = "scope", EmitDefaultValue = false)] public LibrarianScope Scope { get; set; }
    }

    [DataContract]
    public sealed class LibrarianScope
    {
        [DataMember(Name = "global")] public bool Global { get; set; }
        [DataMember(Name = "areaIds")] public List<string> AreaIds { get; set; }
        [DataMember(Name = "capabilityIds")] public List<string> CapabilityIds { get; set; }
    }

    public sealed class ReviewApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            var access = LibrarianAccess.Resolve(server, context.InitiatingUserId);
            if (context.MessageName == "nx_GetSubmissions")
            {
                var review = context.InputParameters.Contains("ReviewQueue") && (bool)context.InputParameters["ReviewQueue"];
                var page = DraftPolicy.NormalizePage(context.InputParameters.Contains("PageNumber") ? (int)context.InputParameters["PageNumber"] : 0);
                var cookie = context.InputParameters.Contains("PagingCookie") ? context.InputParameters["PagingCookie"] as string : null;
                if (page > 1 && string.IsNullOrWhiteSpace(cookie)) throw MediaPolicy.Invalid("Missing page token.");
                var query = new QueryExpression("nx_solution") { ColumnSet = Columns(), PageInfo = new PagingInfo { Count = 100, PageNumber = page, PagingCookie = cookie } };
                query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                if (review)
                {
                    access.FilterQueue(query);
                    var queue = new FilterExpression(LogicalOperator.Or);
                    queue.AddCondition("nx_publicationstatus", ConditionOperator.In, ReviewPolicy.Pending, ReviewPolicy.Published);
                    var returned = new FilterExpression(LogicalOperator.And);
                    returned.AddCondition("nx_publicationstatus", ConditionOperator.Equal, DraftPolicy.DraftStatus);
                    returned.AddCondition("nx_reviewoutcome", ConditionOperator.Equal, 125060001);
                    queue.AddFilter(returned);
                    query.Criteria.AddFilter(queue);
                }
                else query.Criteria.AddCondition("ownerid", ConditionOperator.Equal, context.InitiatingUserId);
                query.Orders.Add(new OrderExpression("nx_solutionid", OrderType.Ascending));
                var rows = (review ? server : caller).RetrieveMultiple(query);
                context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SubmissionPage { Records = rows.Entities.Select(row => Summary(server, row, access.CanManage(server, row))).ToList(), MoreRecords = rows.MoreRecords, PagingCookie = rows.PagingCookie, Librarian = access.Available, Scope = review ? access.Scope() : null });
                return;
            }
            if (context.MessageName != "nx_GetSubmission" && context.MessageName != ReviewPolicy.Transition) throw MediaPolicy.Invalid("Unknown submission operation.");
            var identifier = (Guid)context.InputParameters["SolutionId"];
            bool librarian;
            var parent = access.ReadSolution(caller, server, context.InitiatingUserId, identifier, Columns(), out librarian);
            var reader = librarian ? server : caller;
            if (context.MessageName == ReviewPolicy.Transition)
            {
                if (!context.IsInTransaction) throw MediaPolicy.Invalid("A transition transaction is required.");
                var action = context.InputParameters["Action"] as string;
                var change = ReviewPolicy.Change(parent, context.InitiatingUserId, librarian, context.InputParameters["ExpectedRowVersion"] as string, action,
                    context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : "", context.InputParameters.Contains("Cleared") && (bool)context.InputParameters["Cleared"]);
                tracing?.Trace("Transition '{0}' from publication status {1} (librarian: {2}).", action, parent.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value, librarian);
                server.Execute(new UpdateRequest { Target = change, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
                var librarianEdit = !change.Contains("nx_clientsafereviewed");
                if (action == "asset")
                {
                    MediaApi.SaveLinkedAsset(server, parent, context.InitiatingUserId, LinkedAssetPolicy.Parse(context.InputParameters["Comments"] as string));
                    if (librarianEdit) MarkEdited(server, parent, context.InitiatingUserId);
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = identifier.ToString(), RowVersion = reader.Retrieve("nx_solution", identifier, new ColumnSet(false)).RowVersion, BlockSize = MediaPolicy.BlockSize, Media = MediaApi.Snapshots(server, identifier) });
                    return;
                }
                if (action == "technology")
                {
                    var name = ReviewPolicy.TechnologyName(context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : null);
                    var query = new QueryExpression("nx_technology") { ColumnSet = new ColumnSet("nx_technologyname"), TopCount = 1 };
                    query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                    query.Criteria.AddCondition("nx_technologyname", ConditionOperator.Equal, name);
                    query.Orders.Add(new OrderExpression("nx_technologyid", OrderType.Ascending));
                    var existing = server.RetrieveMultiple(query).Entities.FirstOrDefault();
                    var technologyId = existing?.Id ?? server.Create(new Entity("nx_technology") { ["nx_technologyname"] = name, ["ownerid"] = new EntityReference("systemuser", context.InitiatingUserId) });
                    var readable = caller.Retrieve("nx_technology", technologyId, new ColumnSet("nx_technologyname"));
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new TechnologyResult { Id = identifier.ToString(), RowVersion = reader.Retrieve("nx_solution", identifier, new ColumnSet(false)).RowVersion, TechnologyId = technologyId.ToString(), Name = readable.GetAttributeValue<string>("nx_technologyname") });
                    return;
                }
                var media = MediaApi.Sessions(server, identifier);
                if (action == "media")
                {
                    var edits = MediaPolicy.ParseMetadata(context.InputParameters["Comments"] as string);
                    var altered = false;
                    foreach (var edit in edits)
                    {
                        var item = media.SingleOrDefault(row => row.GetAttributeValue<string>("nx_targetid") == edit.Id);
                        if (item == null || !item.GetAttributeValue<bool>("nx_complete")) throw MediaPolicy.Invalid("Media does not belong to this draft or is incomplete.");
                        var kind = item.GetAttributeValue<string>("nx_kind");
                        var update = new Entity(MediaPolicy.Table(kind), Guid.Parse(edit.Id)) { ["nx_sortorder"] = edit.SortOrder };
                        if (kind != "attachment") update["nx_caption"] = edit.Caption;
                        else if (edit.Caption.Length != 0) throw MediaPolicy.Invalid("Captions are supported for images only.");
                        if (edit.DisplayName != null)
                        {
                            if (kind != "attachment" || item.GetAttributeValue<string>("nx_mime") == LinkedAssetPolicy.Mime)
                                throw MediaPolicy.Invalid("Display names are supported for uploaded attachments only.");
                            update["nx_demoassetid1"] = edit.DisplayName;
                        }
                        if (edit.Purpose != null)
                        {
                            if (kind != "attachment") throw MediaPolicy.Invalid("Only attachments have a purpose.");
                            var type = server.Retrieve("nx_demoasset", update.Id, new ColumnSet("nx_assettype")).GetAttributeValue<OptionSetValue>("nx_assettype").Value;
                            update["nx_assetpurpose"] = new OptionSetValue(AssetPurposePolicy.Validated(edit.Purpose, type));
                        }
                        if (librarianEdit) altered |= DraftPolicy.Changed(server.Retrieve(update.LogicalName, update.Id, new ColumnSet(update.Attributes.Keys.ToArray())), update);
                        server.Update(update);
                    }
                    if (altered) MarkEdited(server, parent, context.InitiatingUserId);
                    var latest = reader.Retrieve("nx_solution", identifier, new ColumnSet(false));
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = identifier.ToString(), RowVersion = latest.RowVersion, BlockSize = MediaPolicy.BlockSize, Media = MediaApi.Snapshots(server, identifier) });
                    return;
                }
                if (action == "submit" || action == "approve" || action == "confirm-edit")
                {
                    var graph = DraftGraph.Read(server, parent);
                    DraftGraph.PrepareClassification(caller, parent, graph.Graph);
                    ReviewPolicy.Complete(parent, graph, media);
                    RequireActive(caller, parent.GetAttributeValue<EntityReference>("nx_capability"));
                    foreach (var area in graph.Graph.AreaIds) RequireActive(caller, new EntityReference("nx_specializationarea", Guid.Parse(area)));
                    foreach (var person in graph.Graph.Contributors) RequireActive(caller, new EntityReference("cr6b0_consultant", Guid.Parse(person.PersonId)));
                    var storage = new MediaStorage(serviceProvider, server);
                    foreach (var item in media)
                        MediaApi.VerifyStoredMedia(server, item, storage);
                }
                PublicationAccess(server, identifier, media, action == "approve" || action == "confirm-edit", tracing);
                if (action == "delete")
                {
                    foreach (var item in media)
                    {
                        server.Delete(MediaPolicy.Table(item.GetAttributeValue<string>("nx_kind")), Guid.Parse(item.GetAttributeValue<string>("nx_targetid")));
                        server.Delete("nx_uploadsession", item.Id);
                    }
                    foreach (var table in new[] { "nx_solutioncontributor", "nx_solutionimage", "nx_demoasset" })
                    {
                        var children = new QueryExpression(table) { ColumnSet = new ColumnSet(false) };
                        children.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, identifier);
                        EntityCollection rows;
                        do
                        {
                            rows = server.RetrieveMultiple(children);
                            foreach (var row in rows.Entities) server.Delete(table, row.Id);
                        } while (rows.MoreRecords);
                    }
                    server.Delete("nx_solution", identifier);
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new DeletedSubmission { Id = identifier.ToString("D"), Deleted = true });
                    return;
                }
                parent = reader.Retrieve("nx_solution", identifier, Columns());
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SubmissionDetail {
                Record = Summary(server, parent, librarian), Graph = DraftGraph.Read(reader, parent),
                Media = MediaApi.Snapshots(server, identifier), Librarian = librarian,
                LibrarianEdit = librarian && DraftPolicy.LibrarianMayEdit(parent, context.InitiatingUserId)
            });
        }

        private static void MarkEdited(IOrganizationService server, Entity parent, Guid caller)
        {
            server.Update(DraftPolicy.LibrarianEdit(parent.Id, parent.GetAttributeValue<OptionSetValue>("nx_publicationstatus")?.Value, DraftPolicy.Editor(server, caller), DateTime.UtcNow));
        }

        private static void RequireActive(IOrganizationService caller, EntityReference reference)
        {
            if (caller.Retrieve(reference.LogicalName, reference.Id, new ColumnSet("statecode")).GetAttributeValue<OptionSetValue>("statecode")?.Value != 0)
                throw MediaPolicy.Invalid("A selected reference is inactive or unavailable.");
        }

        private static void PublicationAccess(IOrganizationService server, Guid parent, IList<Entity> media, bool published, ITracingService tracing)
        {
            var teams = new QueryExpression("team") { ColumnSet = new ColumnSet(false) };
            teams.Criteria.AddCondition("name", ConditionOperator.Equal, "PRISMA Published Readers");
            var readers = server.RetrieveMultiple(teams).Entities;
            if (readers.Count != 1) throw MediaPolicy.Invalid("The PRISMA Published Readers team is missing or ambiguous. Contact the platform owner.");
            var team = readers[0].ToEntityReference();
            var targets = new List<EntityReference> { new EntityReference("nx_solution", parent) };
            var contributors = new QueryExpression("nx_solutioncontributor") { ColumnSet = new ColumnSet(false), TopCount = 101 };
            contributors.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, parent);
            targets.AddRange(server.RetrieveMultiple(contributors).Entities.Select(row => row.ToEntityReference()));
            targets.AddRange(media.Where(row => row.GetAttributeValue<bool>("nx_complete")).Select(row => new EntityReference(MediaPolicy.Table(row.GetAttributeValue<string>("nx_kind")), Guid.Parse(row.GetAttributeValue<string>("nx_targetid")))));
            tracing?.Trace("{0} reader access on {1} records.", published ? "Granting" : "Revoking", targets.Count);
            foreach (var target in targets)
                if (published) server.Execute(new GrantAccessRequest { Target = target, PrincipalAccess = new PrincipalAccess { Principal = team, AccessMask = AccessRights.ReadAccess } });
                else server.Execute(new RevokeAccessRequest { Target = target, Revokee = team });
        }

        public static ColumnSet Columns() { return new ColumnSet(DraftPolicy.CoreColumns.Concat(new[] { "ownerid", "nx_dateadded", "createdon", "modifiedon", "nx_librarynote", "nx_publicationstatus", "nx_reviewoutcome", "nx_reviewcomments", "nx_clientsafereviewed",
            DraftPolicy.LibrarianEditedBy, DraftPolicy.LibrarianEditedOn, DraftPolicy.LibrarianEditPending }).ToArray()); }
        public static SubmissionSummary Summary(IOrganizationService server, Entity record, bool librarian)
        {
            var edited = record.GetAttributeValue<DateTime?>(DraftPolicy.LibrarianEditedOn);
            var media = MediaApi.Sessions(server, record.Id);
            var added = record.GetAttributeValue<DateTime?>("nx_dateadded") ?? record.GetAttributeValue<DateTime?>("createdon");
            var modified = record.GetAttributeValue<DateTime?>("modifiedon") ?? throw MediaPolicy.Invalid("Submission modification time is unavailable.");
            return new SubmissionSummary { Core = DraftApi.Snapshot(record), AreaIds = DraftGraph.AreaIds(server, record), Publication = record.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value,
                Outcome = record.GetAttributeValue<OptionSetValue>("nx_reviewoutcome")?.Value ?? 125060000,
                Comments = record.GetAttributeValue<string>("nx_reviewcomments") ?? "", Cleared = record.GetAttributeValue<bool>("nx_clientsafereviewed"),
                Owner = record.GetAttributeValue<EntityReference>("ownerid")?.Name ?? "", DateAdded = added?.ToString("yyyy-MM-dd") ?? "",
                ModifiedOn = modified.ToUniversalTime().ToString("o"),
                ImageCount = media.Count(item => item.GetAttributeValue<string>("nx_kind") == "image" && item.GetAttributeValue<bool>("nx_complete")),
                AttachmentCount = media.Count(item => item.GetAttributeValue<string>("nx_kind") == "attachment" && item.GetAttributeValue<bool>("nx_complete")),
                LibraryNotes = record.GetAttributeValue<string>("nx_librarynote") ?? "",
                // Owners see that the librarian edited and when; only librarians see who (Q17).
                LibrarianEditedOn = edited?.ToString("yyyy-MM-dd"), LibrarianEditPending = record.GetAttributeValue<bool>(DraftPolicy.LibrarianEditPending),
                LibrarianEditedBy = librarian && edited != null ? record.GetAttributeValue<EntityReference>(DraftPolicy.LibrarianEditedBy)?.Name ?? "" : null };
        }
    }
}
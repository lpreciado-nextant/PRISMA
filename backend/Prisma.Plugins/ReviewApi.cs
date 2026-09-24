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
            var change = new Entity("nx_solution", parent.Id) { RowVersion = expected, ["nx_clientsafereviewed"] = false };
            if (action == "submit" && owns && status == DraftPolicy.DraftStatus)
                change["nx_publicationstatus"] = new OptionSetValue(Pending);
            else if ((action == "media" || action == "technology" || action == "asset") && owns && status == DraftPolicy.DraftStatus)
                change["nx_safetyacknowledged"] = false;
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
                change["nx_publicationstatus"] = new OptionSetValue(Published);
                change["nx_clientsafereviewed"] = cleared;
                change["nx_reviewoutcome"] = new OptionSetValue(125060002);
                change["nx_reviewcomments"] = (comments ?? "").Trim();
            }
            else if (action == "retire" && librarian && status == Published)
                change["nx_publicationstatus"] = new OptionSetValue(Retired);
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
            if (!parent.GetAttributeValue<bool>("nx_safetyacknowledged")) throw MediaPolicy.Invalid("Renew the safety acknowledgment before submission.");
            if (!string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_clientcontext")) && string.IsNullOrWhiteSpace(parent.GetAttributeValue<string>("nx_clientcontextredacted")))
                throw MediaPolicy.Invalid("Provide redacted client context.");
            ContributorPolicy.Validate(graph.Graph.Contributors, parent.GetAttributeValue<OptionSetValue>("nx_status").Value, true);
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
        [DataMember(Name = "imageCount")] public int ImageCount { get; set; }
        [DataMember(Name = "attachmentCount")] public int AttachmentCount { get; set; }
        [DataMember(Name = "libraryNotes")] public string LibraryNotes { get; set; }
    }

    [DataContract]
    public sealed class SubmissionDetail
    {
        [DataMember(Name = "record")] public SubmissionSummary Record { get; set; }
        [DataMember(Name = "graph")] public DraftGraphSnapshot Graph { get; set; }
        [DataMember(Name = "media")] public MediaSnapshot[] Media { get; set; }
        [DataMember(Name = "librarian")] public bool Librarian { get; set; }
    }

    [DataContract]
    public sealed class SubmissionPage
    {
        [DataMember(Name = "records")] public List<SubmissionSummary> Records { get; set; }
        [DataMember(Name = "moreRecords")] public bool MoreRecords { get; set; }
        [DataMember(Name = "pagingCookie")] public string PagingCookie { get; set; }
        [DataMember(Name = "librarian")] public bool Librarian { get; set; }
    }

    public sealed class ReviewApi : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            var server = factory.CreateOrganizationService(null);
            var librarian = IsLibrarian(server, context.InitiatingUserId);
            if (context.MessageName == "nx_GetSubmissions")
            {
                var review = context.InputParameters.Contains("ReviewQueue") && (bool)context.InputParameters["ReviewQueue"];
                if (review && !librarian) throw MediaPolicy.Invalid("The PRISMA Librarian role is required.");
                var page = DraftPolicy.NormalizePage(context.InputParameters.Contains("PageNumber") ? (int)context.InputParameters["PageNumber"] : 0);
                var cookie = context.InputParameters.Contains("PagingCookie") ? context.InputParameters["PagingCookie"] as string : null;
                if (page > 1 && string.IsNullOrWhiteSpace(cookie)) throw MediaPolicy.Invalid("Missing page token.");
                var query = new QueryExpression("nx_solution") { ColumnSet = Columns(), PageInfo = new PagingInfo { Count = 100, PageNumber = page, PagingCookie = cookie } };
                query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
                if (review)
                {
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
                var rows = caller.RetrieveMultiple(query);
                context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SubmissionPage { Records = rows.Entities.Select(row => Summary(server, row)).ToList(), MoreRecords = rows.MoreRecords, PagingCookie = rows.PagingCookie, Librarian = librarian });
                return;
            }
            if (context.MessageName != "nx_GetSubmission" && context.MessageName != ReviewPolicy.Transition) throw MediaPolicy.Invalid("Unknown submission operation.");
            var identifier = (Guid)context.InputParameters["SolutionId"];
            var parent = caller.Retrieve("nx_solution", identifier, Columns());
            var owner = parent.GetAttributeValue<EntityReference>("ownerid");
            if (!librarian && (owner?.LogicalName != "systemuser" || owner.Id != context.InitiatingUserId)) throw MediaPolicy.Invalid("Submission access denied.");
            if (context.MessageName == ReviewPolicy.Transition)
            {
                if (!context.IsInTransaction) throw MediaPolicy.Invalid("A transition transaction is required.");
                var action = context.InputParameters["Action"] as string;
                var change = ReviewPolicy.Change(parent, context.InitiatingUserId, librarian, context.InputParameters["ExpectedRowVersion"] as string, action,
                    context.InputParameters.Contains("Comments") ? context.InputParameters["Comments"] as string : "", context.InputParameters.Contains("Cleared") && (bool)context.InputParameters["Cleared"]);
                server.Execute(new UpdateRequest { Target = change, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
                if (action == "asset")
                {
                    MediaApi.SaveLinkedAsset(server, parent, context.InitiatingUserId, LinkedAssetPolicy.Parse(context.InputParameters["Comments"] as string));
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = identifier.ToString(), RowVersion = caller.Retrieve("nx_solution", identifier, new ColumnSet(false)).RowVersion, BlockSize = MediaPolicy.BlockSize, Media = MediaApi.Snapshots(server, identifier) });
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
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new TechnologyResult { Id = identifier.ToString(), RowVersion = caller.Retrieve("nx_solution", identifier, new ColumnSet(false)).RowVersion, TechnologyId = technologyId.ToString(), Name = readable.GetAttributeValue<string>("nx_technologyname") });
                    return;
                }
                var media = MediaApi.Sessions(server, identifier);
                if (action == "media")
                {
                    var edits = MediaPolicy.ParseMetadata(context.InputParameters["Comments"] as string);
                    foreach (var edit in edits)
                    {
                        var item = media.SingleOrDefault(row => row.GetAttributeValue<string>("nx_targetid") == edit.Id);
                        if (item == null || !item.GetAttributeValue<bool>("nx_complete")) throw MediaPolicy.Invalid("Media does not belong to this draft or is incomplete.");
                        var kind = item.GetAttributeValue<string>("nx_kind");
                        var update = new Entity(MediaPolicy.Table(kind), Guid.Parse(edit.Id)) { ["nx_sortorder"] = edit.SortOrder };
                        if (kind != "attachment") update["nx_caption"] = edit.Caption;
                        else if (edit.Caption.Length != 0) throw MediaPolicy.Invalid("Captions are supported for images only.");
                        server.Update(update);
                    }
                    var latest = caller.Retrieve("nx_solution", identifier, new ColumnSet(false));
                    context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new MediaResult { Id = identifier.ToString(), RowVersion = latest.RowVersion, BlockSize = MediaPolicy.BlockSize, Media = MediaApi.Snapshots(server, identifier) });
                    return;
                }
                if (action == "submit" || action == "approve")
                {
                    var graph = DraftGraph.Read(server, parent);
                    ReviewPolicy.Complete(parent, graph, media);
                    RequireActive(caller, parent.GetAttributeValue<EntityReference>("nx_capability"));
                    foreach (var area in graph.Graph.AreaIds) RequireActive(caller, new EntityReference("nx_specializationarea", Guid.Parse(area)));
                    foreach (var person in graph.Graph.Contributors) RequireActive(caller, new EntityReference("cr6b0_consultant", Guid.Parse(person.PersonId)));
                    foreach (var item in media)
                        MediaApi.VerifyStoredMedia(server, item);
                }
                PublicationAccess(server, identifier, media, action == "approve");
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
                parent = caller.Retrieve("nx_solution", identifier, Columns());
            }
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(new SubmissionDetail {
                Record = Summary(server, parent), Graph = DraftGraph.Read(caller, parent),
                Media = MediaApi.Snapshots(server, identifier), Librarian = librarian
            });
        }

        public static bool IsLibrarian(IOrganizationService server, Guid caller)
        {
            var direct = new QueryExpression("role") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            direct.Criteria.AddCondition("name", ConditionOperator.Equal, "PRISMA Librarian");
            direct.AddLink("systemuserroles", "roleid", "roleid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, caller);
            if (server.RetrieveMultiple(direct).Entities.Count != 0) return true;
            var inherited = new QueryExpression("role") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            inherited.Criteria.AddCondition("name", ConditionOperator.Equal, "PRISMA Librarian");
            inherited.AddLink("teamroles", "roleid", "roleid").AddLink("teammembership", "teamid", "teamid").LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, caller);
            return server.RetrieveMultiple(inherited).Entities.Count != 0;
        }

        private static void RequireActive(IOrganizationService caller, EntityReference reference)
        {
            if (caller.Retrieve(reference.LogicalName, reference.Id, new ColumnSet("statecode")).GetAttributeValue<OptionSetValue>("statecode")?.Value != 0)
                throw MediaPolicy.Invalid("A selected reference is inactive or unavailable.");
        }

        private static void PublicationAccess(IOrganizationService server, Guid parent, IList<Entity> media, bool published)
        {
            var teams = new QueryExpression("team") { ColumnSet = new ColumnSet(false) };
            teams.Criteria.AddCondition("name", ConditionOperator.Equal, "PRISMA Published Readers");
            var team = server.RetrieveMultiple(teams).Entities.Single().ToEntityReference();
            var targets = new List<EntityReference> { new EntityReference("nx_solution", parent) };
            var contributors = new QueryExpression("nx_solutioncontributor") { ColumnSet = new ColumnSet(false), TopCount = 101 };
            contributors.Criteria.AddCondition("nx_solution", ConditionOperator.Equal, parent);
            targets.AddRange(server.RetrieveMultiple(contributors).Entities.Select(row => row.ToEntityReference()));
            targets.AddRange(media.Where(row => row.GetAttributeValue<bool>("nx_complete")).Select(row => new EntityReference(MediaPolicy.Table(row.GetAttributeValue<string>("nx_kind")), Guid.Parse(row.GetAttributeValue<string>("nx_targetid")))));
            foreach (var target in targets)
                if (published) server.Execute(new GrantAccessRequest { Target = target, PrincipalAccess = new PrincipalAccess { Principal = team, AccessMask = AccessRights.ReadAccess } });
                else server.Execute(new RevokeAccessRequest { Target = target, Revokee = team });
        }

        private static ColumnSet Columns() { return new ColumnSet(DraftPolicy.CoreColumns.Concat(new[] { "ownerid", "nx_dateadded", "createdon", "nx_librarynote", "nx_publicationstatus", "nx_reviewoutcome", "nx_reviewcomments", "nx_clientsafereviewed" }).ToArray()); }
        private static SubmissionSummary Summary(IOrganizationService server, Entity record)
        {
            var media = MediaApi.Sessions(server, record.Id);
            var added = record.GetAttributeValue<DateTime?>("nx_dateadded") ?? record.GetAttributeValue<DateTime?>("createdon");
            return new SubmissionSummary { Core = DraftApi.Snapshot(record), AreaIds = DraftGraph.AreaIds(server, record.Id), Publication = record.GetAttributeValue<OptionSetValue>("nx_publicationstatus").Value,
                Outcome = record.GetAttributeValue<OptionSetValue>("nx_reviewoutcome")?.Value ?? 125060000,
                Comments = record.GetAttributeValue<string>("nx_reviewcomments") ?? "", Cleared = record.GetAttributeValue<bool>("nx_clientsafereviewed"),
                Owner = record.GetAttributeValue<EntityReference>("ownerid")?.Name ?? "", DateAdded = added?.ToString("yyyy-MM-dd") ?? "",
                ImageCount = media.Count(item => item.GetAttributeValue<string>("nx_kind") == "image" && item.GetAttributeValue<bool>("nx_complete")),
                AttachmentCount = media.Count(item => item.GetAttributeValue<string>("nx_kind") == "attachment" && item.GetAttributeValue<bool>("nx_complete")),
                LibraryNotes = record.GetAttributeValue<string>("nx_librarynote") ?? "" };
        }
    }
}
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.Serialization;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace Prisma.Plugins
{
    /// <summary>Keys match the Dataverse columns the client already validates for per-solution area reads.</summary>
    [DataContract]
    public sealed class CatalogueArea
    {
        [DataMember(Name = "nx_specializationareaid")] public string Id { get; set; }
        [DataMember(Name = "nx_specializationareaname")] public string Name { get; set; }
        [DataMember(Name = "nx_sortordernumber", EmitDefaultValue = false)] public int? Order { get; set; }
    }

    [DataContract]
    public sealed class CatalogueEntry
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "areas")] public List<CatalogueArea> Areas { get; set; }
        [DataMember(Name = "technologies")] public List<string> Technologies { get; set; }
        [DataMember(Name = "industries")] public List<string> Industries { get; set; }
        [DataMember(Name = "contributors", EmitDefaultValue = false)] public List<string> Contributors { get; set; }
        [DataMember(Name = "thumbnail", EmitDefaultValue = false)] public MediaSnapshot Thumbnail { get; set; }
        /// <summary>How many demo videos and interactive demos the solution has (ADR-0011); real whenever `purposes` is true.</summary>
        [DataMember(Name = "demoVideos")] public int DemoVideos { get; set; }
        [DataMember(Name = "interactiveDemos")] public int InteractiveDemos { get; set; }
    }

    [DataContract]
    public sealed class CatalogueGraphResult
    {
        [DataMember(Name = "solutions")] public CatalogueEntry[] Solutions { get; set; }
        /// <summary>Tells the client an entry without a thumbnail has none, rather than coming from an older plug-in.</summary>
        [DataMember(Name = "thumbnails")] public bool Thumbnails { get; set; }
        /// <summary>Tells the client the demo counts are real, rather than missing from an older plug-in.</summary>
        [DataMember(Name = "purposes")] public bool Purposes { get; set; }
    }

    /// <summary>Groups bulk tag and credit rows by visible solution. Rows for any other solution are ignored.</summary>
    public sealed class CatalogueGraph
    {
        private readonly Dictionary<Guid, CatalogueEntry> entries = new Dictionary<Guid, CatalogueEntry>();
        private readonly Dictionary<Guid, List<MediaSnapshot>> thumbnails = new Dictionary<Guid, List<MediaSnapshot>>();
        private readonly bool present;

        public CatalogueGraph(IEnumerable<Guid> solutions, bool present)
        {
            this.present = present;
            foreach (var solution in solutions)
            {
                if (entries.ContainsKey(solution)) throw MediaPolicy.Invalid("The catalogue returned a solution twice. Retry the request.");
                entries.Add(solution, new CatalogueEntry {
                    Id = solution.ToString("D"), Areas = new List<CatalogueArea>(), Technologies = new List<string>(), Industries = new List<string>(),
                    Contributors = present ? null : new List<string>()
                });
            }
        }

        public int Count { get { return entries.Count; } }

        public void Area(Guid solution, Guid area, string name, int? order)
        {
            CatalogueEntry entry;
            if (entries.TryGetValue(solution, out entry)) entry.Areas.Add(new CatalogueArea { Id = area.ToString("D"), Name = Required(name), Order = order });
        }

        public void Technology(Guid solution, string name) { Add(solution, entry => entry.Technologies, name); }
        public void Industry(Guid solution, string name) { Add(solution, entry => entry.Industries, name); }

        public void Contributor(Guid solution, string name)
        {
            if (present) throw MediaPolicy.Invalid("Present mode never returns builder credits.");
            Add(solution, entry => entry.Contributors, string.IsNullOrWhiteSpace(name) ? "Consultant" : name);
        }

        public CatalogueGraphResult Build()
        {
            foreach (var entry in entries)
            {
                List<MediaSnapshot> candidates;
                // The same order as the published detail's media, whose first thumbnail the card used before.
                if (thumbnails.TryGetValue(entry.Key, out candidates)) entry.Value.Thumbnail = candidates.OrderBy(item => item.SortOrder).ThenBy(item => item.Id).First();
            }
            return new CatalogueGraphResult { Solutions = entries.Values.ToArray(), Thumbnails = true, Purposes = true };
        }

        public void Asset(Guid solution, int purpose)
        {
            CatalogueEntry entry;
            if (!entries.TryGetValue(solution, out entry)) return;
            if (purpose == AssetPurposePolicy.DemoVideo) entry.DemoVideos++;
            else if (purpose == AssetPurposePolicy.InteractiveDemo) entry.InteractiveDemos++;
        }

        public void Thumbnail(Guid solution, MediaSnapshot snapshot)
        {
            if (snapshot.Kind != "thumbnail" || !snapshot.Complete || snapshot.Storage != null || snapshot.LinkedAsset != null) throw MediaPolicy.Invalid("Invalid catalogue thumbnail.");
            if (!entries.ContainsKey(solution)) return;
            List<MediaSnapshot> candidates;
            if (!thumbnails.TryGetValue(solution, out candidates)) thumbnails.Add(solution, candidates = new List<MediaSnapshot>());
            candidates.Add(snapshot);
        }

        private void Add(Guid solution, Func<CatalogueEntry, List<string>> list, string name)
        {
            CatalogueEntry entry;
            if (entries.TryGetValue(solution, out entry)) list(entry).Add(Required(name));
        }

        private static string Required(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) throw MediaPolicy.Invalid("A catalogue tag has no name.");
            return name;
        }
    }

    /// <summary>
    /// nx_GetCatalogueGraph: the areas, technologies, industries and (outside present mode) contributor names of every
    /// published solution the caller can read, in a few paged queries instead of several requests per solution.
    /// Reads as the caller, so sharing and privileges decide what is returned, exactly like the per-solution reads.
    /// </summary>
    public sealed class CatalogueApi : IPlugin
    {
        public const string Message = "nx_GetCatalogueGraph";
        private const int MaxPages = 50;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (context.MessageName != Message) throw MediaPolicy.Invalid("Invalid catalogue operation.");
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var caller = factory.CreateOrganizationService(context.InitiatingUserId);
            if (!context.InputParameters.Contains("Present")) throw MediaPolicy.Invalid("Present is required.");
            var present = (bool)context.InputParameters["Present"];

            var solutions = new QueryExpression("nx_solution") { ColumnSet = new ColumnSet(false) };
            Visible(solutions.Criteria, present);
            solutions.AddOrder("nx_solutionid", OrderType.Ascending);
            var visible = Rows(caller, solutions).Select(row => row.Id).ToList();
            var graph = new CatalogueGraph(visible, present);

            Tags(caller, present, DraftGraph.Relationships[3], "nx_specializationarea", new[] { "nx_specializationareaname", "nx_sortordernumber" },
                (solution, tag, row) => graph.Area(solution, tag, Aliased(row, "nx_specializationareaname") as string, Aliased(row, "nx_sortordernumber") as int?));
            Tags(caller, present, DraftGraph.Relationships[0], "nx_technology", new[] { "nx_technologyname" },
                (solution, tag, row) => graph.Technology(solution, Aliased(row, "nx_technologyname") as string));
            Tags(caller, present, DraftGraph.Relationships[1], "nx_industry", new[] { "nx_industryname" },
                (solution, tag, row) => graph.Industry(solution, Aliased(row, "nx_industryname") as string));
            if (!present)
            {
                var contributors = new QueryExpression("nx_solutioncontributor") { ColumnSet = new ColumnSet("nx_solution") };
                Visible(contributors.AddLink("nx_solution", "nx_solution", "nx_solutionid").LinkCriteria, false);
                var person = contributors.AddLink("cr6b0_consultant", "nx_builtby", "cr6b0_consultantid", JoinOperator.LeftOuter);
                person.EntityAlias = "tag";
                person.Columns = new ColumnSet("cr6b0_consultantname");
                contributors.AddOrder("nx_solutioncontributorid", OrderType.Ascending);
                foreach (var row in Rows(caller, contributors))
                    graph.Contributor(row.GetAttributeValue<EntityReference>("nx_solution").Id, Aliased(row, "cr6b0_consultantname") as string);
            }
            Thumbnails(caller, factory.CreateOrganizationService(null), visible, graph);
            // Read as the caller, so only demo assets the caller may open are counted.
            var assets = new QueryExpression("nx_demoasset") { ColumnSet = new ColumnSet("nx_solution", "nx_assettype", "nx_assetpurpose") };
            Visible(assets.AddLink("nx_solution", "nx_solution", "nx_solutionid").LinkCriteria, present);
            assets.AddOrder("nx_demoassetid", OrderType.Ascending);
            foreach (var row in Rows(caller, assets))
                if (row.Contains("nx_assettype")) graph.Asset(row.GetAttributeValue<EntityReference>("nx_solution").Id, AssetPurposePolicy.Effective(row));
            tracing?.Trace("Catalogue graph returned {0} solutions (present: {1}).", graph.Count, present);
            context.OutputParameters["ResultJson"] = DraftPolicy.Serialize(graph.Build());
        }

        /// <summary>The same filter as the client's catalogue query, applied on the server.</summary>
        private static void Visible(FilterExpression filter, bool present)
        {
            filter.AddCondition("statecode", ConditionOperator.Equal, 0);
            filter.AddCondition("nx_publicationstatus", ConditionOperator.Equal, ReviewPolicy.Published);
            if (!present) return;
            filter.AddCondition("nx_safetyacknowledged", ConditionOperator.Equal, true);
            filter.AddCondition("nx_clientsafereviewed", ConditionOperator.Equal, true);
        }

        private static void Tags(IOrganizationService caller, bool present, string relationship, string table, string[] columns, Action<Guid, Guid, Entity> add)
        {
            string intersect, source, target;
            DraftGraph.IntersectOf(caller, relationship, out intersect, out source, out target);
            var query = new QueryExpression(intersect) { ColumnSet = new ColumnSet(source, target) };
            Visible(query.AddLink("nx_solution", source, "nx_solutionid").LinkCriteria, present);
            var tag = query.AddLink(table, target, table + "id");
            tag.EntityAlias = "tag";
            tag.Columns = new ColumnSet(columns);
            // Tag-id order matches the per-solution reads the client made before this API existed.
            query.AddOrder(target, OrderType.Ascending);
            query.AddOrder(source, OrderType.Ascending);
            foreach (var row in Rows(caller, query)) add(row.GetAttributeValue<Guid>(source), row.GetAttributeValue<Guid>(target), row);
        }

        private static object Aliased(Entity row, string column) { return row.GetAttributeValue<AliasedValue>("tag." + column)?.Value; }

        /// <summary>
        /// Upload sessions are private, so they are read with system rights but only for solutions the caller can already see;
        /// the image rows are read as the caller, so a thumbnail the caller cannot read is left out.
        /// </summary>
        private static void Thumbnails(IOrganizationService caller, IOrganizationService server, IList<Guid> visible, CatalogueGraph graph)
        {
            var sessions = new List<Entity>();
            foreach (var batch in Batches(visible.Select(id => id.ToString("D"))))
            {
                var query = new QueryExpression("nx_uploadsession") { ColumnSet = new ColumnSet("nx_parentid", "nx_targetid", "nx_kind", "nx_filename", "nx_mime", "nx_bytes", "nx_received", "nx_nextblock", "nx_complete", "nx_storage") };
                query.Criteria.AddCondition("nx_kind", ConditionOperator.Equal, "thumbnail");
                query.Criteria.AddCondition("nx_complete", ConditionOperator.Equal, true);
                query.Criteria.AddCondition("nx_parentid", ConditionOperator.In, batch);
                query.AddOrder("nx_uploadsessionid", OrderType.Ascending);
                sessions.AddRange(Rows(server, query));
            }
            var images = new Dictionary<Guid, Entity>();
            foreach (var batch in Batches(sessions.Select(row => Guid.Parse(row.GetAttributeValue<string>("nx_targetid")))))
            {
                var query = new QueryExpression("nx_solutionimage") { ColumnSet = new ColumnSet("nx_sortorder", "nx_caption") };
                query.Criteria.AddCondition("nx_solutionimageid", ConditionOperator.In, batch);
                query.AddOrder("nx_solutionimageid", OrderType.Ascending);
                foreach (var row in Rows(caller, query)) images[row.Id] = row;
            }
            foreach (var session in sessions)
            {
                Entity image;
                if (images.TryGetValue(Guid.Parse(session.GetAttributeValue<string>("nx_targetid")), out image))
                    graph.Thumbnail(Guid.Parse(session.GetAttributeValue<string>("nx_parentid")), MediaApi.Snapshot(session, image));
            }
        }

        private static IEnumerable<object[]> Batches<T>(IEnumerable<T> values)
        {
            var batch = new List<object>();
            foreach (var value in values)
            {
                batch.Add(value);
                if (batch.Count < 500) continue;
                yield return batch.ToArray();
                batch.Clear();
            }
            if (batch.Count > 0) yield return batch.ToArray();
        }

        private static IEnumerable<Entity> Rows(IOrganizationService caller, QueryExpression query)
        {
            query.PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 };
            while (true)
            {
                var page = caller.RetrieveMultiple(query);
                foreach (var row in page.Entities) yield return row;
                if (!page.MoreRecords) yield break;
                if (query.PageInfo.PageNumber >= MaxPages) throw MediaPolicy.Invalid("The catalogue is larger than this operation supports.");
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }
    }
}

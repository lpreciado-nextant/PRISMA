import { TagPicker } from "../../src/components/TagPicker";
import { ContributorEditor, ContributorRow, PersonPicker, Field } from "../../src/components/SubmissionForm";
import { SelectPicker } from "../../src/components/SelectPicker";
import { CONTRIBUTOR_ROLES, CONTRIBUTOR_ROLE_VALUES, CONTRIBUTOR_ROLE_BY_VALUE } from "../../src/data/catalogueMetadata";
import { contributorEffort, type Contributor, type DraftGraph, type GraphReferences } from "./draftGraph";

export function DraftGraphEditor({ graph, references, maturity, section, onChange, onCreateTechnology }: { graph: DraftGraph; references: GraphReferences; maturity: number; section: "contributors" | "tags"; onChange: (graph: DraftGraph) => void; onCreateTechnology?: (name: string) => Promise<void> }) {
  const direct = maturity === 125060001 || maturity === 125060004;
  const results = graph.contributors.map(person => contributorEffort(person, maturity));
  const valid = results.length > 0 && results.every(result => !result.error);
  const totalHours = Math.round(results.reduce((total, result) => total + result.hours, 0) * 100) / 100;
  const update = (index: number, fields: Partial<Contributor>) => onChange({ ...graph, contributors: graph.contributors.map((person, position) => position === index ? { ...person, ...fields } : person) });
  return <div className="min-w-0 space-y-5">
    {section === "contributors" ? <ContributorEditor direct={direct} total={valid ? totalHours : null} addDisabled={!references.people?.length || graph.contributors.length >= 100}
      onAdd={() => onChange({ ...graph, contributors: [...graph.contributors, { id: null, personId: "", directHours: null, allocation: 100, startDate: null, endDate: null, roleValue: null }] })}>
      {references.people === null && <p role="alert">Consultant directory unavailable. Existing contributor selections are retained.</p>}
      {graph.contributors.map((person, index) => {
        const people = (references.people ?? []).filter(option => option.id === person.personId || !graph.contributors.some(other => other.personId === option.id));
        return <ContributorRow key={person.id ?? `new-${index}`} index={index} direct={direct} result={results[index]} minDate="2020-01-01" maxDate="2035-12-31"
          value={{ ...person, startDate: person.startDate ?? "", endDate: person.endDate ?? "" }} onChange={fields => update(index, fields)}
          onRemove={index > 0 ? () => onChange({ ...graph, contributors: graph.contributors.filter((_, position) => position !== index) }) : undefined}
          role={<Field label="Role" hint="Select how this person contributed to the solution."><SelectPicker label={`Contributor ${index + 1} role`} value={person.roleValue != null ? CONTRIBUTOR_ROLE_BY_VALUE[person.roleValue] : ""} options={person.roleValue != null ? ["", ...CONTRIBUTOR_ROLES] : CONTRIBUTOR_ROLES} onChange={value => update(index, { roleValue: value ? CONTRIBUTOR_ROLE_VALUES[value] : null })} getLabel={option => option || "No role"} placeholder="e.g. Consultant" /></Field>}
          person={<><PersonPicker value={people.find(option => option.id === person.personId) ?? { id: person.personId, name: person.personId ? "Existing consultant (inactive or unavailable)" : "" }} options={people} onChange={value => update(index, { personId: value.id })} />{references.people !== null && person.personId && !people.some(option => option.id === person.personId) && <p role="status" className="mt-2 text-[13px] text-(--proto)">This saved consultant is no longer active or available. Select an active consultant to replace them.</p>}</>} />;
      })}
    </ContributorEditor> : <div className="space-y-6">{([
        { key: "technologyIds", reference: "technologies", label: "Technologies" },
        { key: "industryIds", reference: "industries", label: "Industries" },
        { key: "projectIds", reference: "projects", label: "Project (choose one)" },
      ] as const).map(section => <div key={section.key}>
        {section.key === "projectIds" && graph.projectIds.length > 1 && <p role="alert" className="mb-2 text-[13px] text-(--proto)">This draft has multiple projects. Choose one project before saving.</p>}
        {references[section.reference] === null ? <p className="text-[14px] text-(--ink-2)">{section.label} unavailable. Existing selections retained.</p> : <TagPicker label={section.label} governed={section.reference !== "technologies"} allowNew={section.reference === "technologies" && !!onCreateTechnology} onCreate={onCreateTechnology} options={(references[section.reference] ?? []).map(option => option.id)} selected={graph[section.key]} getLabel={id => references[section.reference]?.find(option => option.id === id)?.name ?? "Unavailable selection"} onChange={selected => onChange({ ...graph, [section.key]: section.key === "projectIds" ? selected.slice(-1) : selected })} />}
      </div>)}</div>}
  </div>;
}
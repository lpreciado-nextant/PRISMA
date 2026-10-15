import { TagPicker } from "../../src/components/TagPicker";
import { ContributorEditor, ContributorRow, PersonPicker } from "../../src/components/SubmissionForm";
import type { Contributor, DraftGraph, GraphReferences } from "./draftGraph";

export function DraftGraphEditor({ graph, references, section, onChange, onCreateTechnology }: { graph: DraftGraph; references: GraphReferences; section: "contributors" | "tags"; onChange: (graph: DraftGraph) => void; onCreateTechnology?: (name: string) => Promise<void> }) {
  const update = (index: number, fields: Partial<Contributor>) => onChange({ ...graph, contributors: graph.contributors.map((person, position) => position === index ? { ...person, ...fields } : person) });
  return <div className="min-w-0 space-y-5">
    {section === "contributors" ? <ContributorEditor addDisabled={!references.people?.length || graph.contributors.length >= 100}
      onAdd={() => onChange({ ...graph, contributors: [...graph.contributors, { id: null, personId: "" }] })}>
      {references.people === null && <p role="alert">Consultant directory unavailable. Existing contributor selections are retained.</p>}
      {graph.contributors.map((person, index) => {
        const people = (references.people ?? []).filter(option => option.id === person.personId || !graph.contributors.some(other => other.personId === option.id));
        return <ContributorRow key={person.id ?? `new-${index}`} index={index}
          onRemove={index > 0 ? () => onChange({ ...graph, contributors: graph.contributors.filter((_, position) => position !== index) }) : undefined}
          level={person.personId ? references.people?.find(option => option.id === person.personId)?.level ?? null : undefined}
          person={<><PersonPicker value={people.find(option => option.id === person.personId) ?? { id: person.personId, name: person.personId ? "Existing consultant (inactive or unavailable)" : "" }} options={people} onChange={value => update(index, { personId: value.id })} />{references.people !== null && person.personId && !people.some(option => option.id === person.personId) && <p role="status" className="mt-2 text-[13px] text-(--proto)">This saved consultant is no longer active or available. Select an active consultant to replace them.</p>}</>} />;
      })}
    </ContributorEditor> : <div className="space-y-5">{([
        { key: "technologyIds", reference: "technologies", label: "Technologies", hint: "Tools, platforms and languages used to build the solution" },
        { key: "industryIds", reference: "industries", label: "Industries", hint: "Industries where it applies." },
        { key: "projectIds", reference: "projects", label: "Projects", hint: "Client projects where it was used." },
      ] as const).map(section => <div key={section.key}>
        {references[section.reference] === null ? <p className="text-[14px] text-(--ink-2)">{section.label} unavailable. Existing selections retained.</p> : <TagPicker label={section.label} hint={section.hint} optional governed={section.reference !== "technologies"} allowNew={section.reference === "technologies" && !!onCreateTechnology} onCreate={onCreateTechnology} options={(references[section.reference] ?? []).map(option => option.id)} selected={graph[section.key]} getLabel={id => references[section.reference]?.find(option => option.id === id)?.name ?? "Unavailable selection"} onChange={selected => onChange({ ...graph, [section.key]: selected })} />}
      </div>)}</div>}
  </div>;
}
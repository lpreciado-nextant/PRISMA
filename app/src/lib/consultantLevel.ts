/**
 * `cr6b0_consultant.cr6b0_consultantlevel` is free text maintained in the consultant directory.
 * Customer Success Managers carry it as a phrase ("Customer Success Manager", "CustomerSuccessManager II", ...),
 * so a contributor whose level names customer success is listed as the solution's CSM rather than as a builder.
 */
export function isCustomerSuccessLevel(level: string | null | undefined): boolean {
  return !!level && /customer\s*succes/i.test(level);
}

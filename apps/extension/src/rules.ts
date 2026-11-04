/**
 * Declarative Net Request rules. The browser applies them itself; the extension
 * never sees requests or page contents.
 */

export const BLOCKED_PAGE = "/blocked.html";
export const RULE_IDS = [1, 2, 3] as const;

export interface DnrRule {
  id: number;
  priority: number;
  action: { type: "block" } | { type: "redirect"; redirect: { extensionPath: string } };
  condition: { requestDomains: string[]; resourceTypes: ("main_frame" | "sub_frame")[] };
}

/**
 * - Domains without redirect permission: block page loads and frames.
 * - Domains with redirect permission: send page loads to the LifeOS blocked page,
 *   still block frames (an embedded frame can't be usefully redirected).
 * `requestDomains` also matches subdomains.
 */
export function buildRules(domains: string[], redirectDomains: string[]): DnrRule[] {
  const redirect = domains.filter((d) => redirectDomains.includes(d));
  const block = domains.filter((d) => !redirectDomains.includes(d));
  const rules: DnrRule[] = [];
  if (block.length) {
    rules.push({ id: 1, priority: 1, action: { type: "block" }, condition: { requestDomains: block, resourceTypes: ["main_frame", "sub_frame"] } });
  }
  if (redirect.length) {
    rules.push({ id: 2, priority: 1, action: { type: "redirect", redirect: { extensionPath: BLOCKED_PAGE } }, condition: { requestDomains: redirect, resourceTypes: ["main_frame"] } });
    rules.push({ id: 3, priority: 1, action: { type: "block" }, condition: { requestDomains: redirect, resourceTypes: ["sub_frame"] } });
  }
  return rules;
}

/** Host permission patterns needed to redirect a domain and its subdomains. */
export function originsFor(domains: string[]): string[] {
  return domains.flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`]);
}

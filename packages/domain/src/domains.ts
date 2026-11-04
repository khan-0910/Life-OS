/**
 * Domain normalization for website blocklists. Input may be a bare host, a URL,
 * or a wildcard ("*.example.com"). Output is a lowercase ASCII (punycode) hostname
 * without "www." — blocking "example.com" also covers its subdomains.
 */
import { LIMITS } from "./validation";

export type DomainResult = { ok: true; domain: string } | { ok: false; error: string };

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

function isIPv4(host: string): boolean {
  const parts = host.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function normalizeDomain(input: string): DomainResult {
  let s = input.trim().toLowerCase();
  if (!s) return { ok: false, error: "Empty entry." };
  if (s.length > 2048) return { ok: false, error: "Entry is too long." };
  s = s.replace(/^\*\./, "");
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = `http://${s}`;
  let host: string;
  try {
    const url = new URL(s);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: "Only web addresses can be blocked." };
    }
    host = url.hostname;
  } catch {
    return { ok: false, error: "Not a valid web address." };
  }
  if (host.startsWith("[")) return { ok: false, error: "IPv6 addresses are not supported." };
  host = host.replace(/\.$/, "").replace(/^www\./, "");
  if (isIPv4(host)) {
    // URL parsing expands shorthand like "1.2.3" or "0x7f.1"; only accept what was typed.
    const typed = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/:?#]/)[0]?.replace(/\.$/, "");
    if (typed !== host) return { ok: false, error: "Use a full IPv4 address such as 192.168.0.10." };
    return { ok: true, domain: host };
  }
  if (host.length > 253) return { ok: false, error: "Hostname is too long." };
  const labels = host.split(".");
  if (labels.length < 2) return { ok: false, error: "Use a full domain such as example.com." };
  if (!labels.every((l) => LABEL_RE.test(l))) return { ok: false, error: "Hostname contains invalid characters." };
  if (/^\d+$/.test(labels[labels.length - 1]!)) return { ok: false, error: "Not a valid domain." };
  return { ok: true, domain: host };
}

export interface ParsedDomains {
  domains: string[];
  errors: { input: string; error: string }[];
}

/** Parse a newline/comma/space separated list; dedupe and cap. */
export function parseDomainList(text: string, max: number = LIMITS.domainsPerList): ParsedDomains {
  const domains: string[] = [];
  const errors: ParsedDomains["errors"] = [];
  for (const raw of text.split(/[\s,]+/)) {
    if (!raw) continue;
    const r = normalizeDomain(raw);
    if (!r.ok) {
      errors.push({ input: raw, error: r.error });
      continue;
    }
    if (domains.includes(r.domain)) continue;
    if (domains.length >= max) {
      errors.push({ input: raw, error: `A list can hold at most ${max} domains.` });
      continue;
    }
    domains.push(r.domain);
  }
  return { domains, errors };
}

/** Drop any domain that is a subdomain of another entry (already covered). */
export function collapseDomains(domains: string[]): string[] {
  const set = [...new Set(domains)].sort((a, b) => a.length - b.length);
  return set.filter((d, i) => !set.slice(0, i).some((p) => d.endsWith(`.${p}`)));
}

"use client"

import { Info, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react"
import type { Service } from "@/lib/kb"

// Task DISCOVERY_CARDS — the reusable benefit-card atom (design README §1c),
// prop-driven off a KB Service so it can be reused by the plan/dashboard later.
// Renders every piece of content that used to live in the prose benefit
// listing: name/agency/cost (header), deadline, verified-vs-hedged trust chip
// + source domain, the KB eligibility caveat (body), required documents (as
// "learn more" chips), and the apply link. Card FIELDS are data (never
// grounded — they ARE the KB, can't hallucinate); only the sibling LLM intro
// bubble is grounded.

// Client copy of isUnverified() (lib/grounding.ts) — same rationale as the
// copies in app/chat/page.tsx and ChatMessage.tsx: grounding.ts pulls
// server-only deps into the client bundle. Kept identical; a hedged
// (needs_review / low-confidence) entry MUST render the amber "confirm"
// treatment, never look verified.
function isUnverifiedLocal(s: { reviewStatus?: string; confidence?: number }): boolean {
  if (s.reviewStatus === "needs_review") return true
  if (s.reviewStatus === "approved") return false
  if (typeof s.confidence === "number") return s.confidence < 0.8
  return true
}

function domainOf(url?: string): string {
  if (!url) return ""
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

const FREE_RE = /^\s*(free|gratis)\s*$/i

export default function BenefitCard({ service, lang, onKnowMore }: {
  service: Service
  lang: "en" | "es"
  onKnowMore: (doc: string) => void
}) {
  const es = lang === "es"
  const name    = es ? service.nameEs : service.name
  const docs    = (es ? service.documentsEs : service.documents) || []
  const caveat  = es ? service.eligibility?.noteEs : service.eligibility?.note
  const amount  = service.amount
  const isFree  = amount ? FREE_RE.test(amount) : false
  const unverified = isUnverifiedLocal({ reviewStatus: service.reviewStatus, confidence: service.confidence })
  const domain  = domainOf(service.sourceUrl)

  // Deadline treatment matches the Dashboard rule: amber only for a VERIFIED
  // deadline within 30 days (an unverified/hedged deadline figure can't cry
  // wolf). Otherwise a plain grey line.
  const deadlineText = service.deadline
  const urgent = !unverified && typeof service.deadlineDays === "number" && service.deadlineDays <= 30

  return (
    <div className={`rounded-[11px] p-3.5 border ${unverified ? "bg-[#FDFBF3] border-ca-warn-border" : "bg-white border-ca-surface-border"}`}>
      {/* Header: title + cost pill */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-[14.5px] text-gray-900 min-w-0">{name}</p>
        {amount && (
          isFree
            ? <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-ca-success-light text-ca-success rounded-full flex-shrink-0 whitespace-nowrap">{es ? "Gratis" : "Free"}</span>
            : <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-ca-track text-[#475569] rounded-full flex-shrink-0 whitespace-nowrap">{amount}</span>
        )}
      </div>

      {/* Agency + deadline */}
      <p className="text-xs text-ca-text-secondary mt-0.5">
        {service.agency}
        {deadlineText && (
          <span className={urgent ? "text-ca-warn font-semibold" : ""}>
            {" · "}{es ? "Plazo: " : "Deadline: "}{deadlineText}
          </span>
        )}
      </p>

      {/* Eligibility caveat (from the KB entry's note — the hedge that used to
          live in prose). */}
      {caveat && (
        <p className="text-[12.5px] text-gray-700 mt-2 leading-relaxed">{caveat}</p>
      )}

      {/* Documents — "learn more" chips, preserving the follow-up behavior. */}
      {docs.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] text-ca-text-tertiary mb-1">{es ? "Documentos:" : "Documents:"}</p>
          <div className="flex flex-wrap gap-1.5">
            {docs.map((doc, i) => (
              <button
                key={i}
                onClick={() => onKnowMore(doc)}
                className="inline-flex items-center gap-1 text-[12px] text-ca-text-secondary hover:text-brand transition-colors bg-white hover:bg-brand-light px-2 py-0.5 rounded-full border border-ca-surface-input hover:border-brand"
                title={es ? `Saber más sobre ${doc}` : `Learn more about ${doc}`}
              >
                <Info size={9} />
                {doc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trust chip + Apply link */}
      <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
        {unverified ? (
          <span className="inline-flex items-center gap-1.5 bg-ca-warn-light text-ca-warn text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
            <AlertCircle size={12} />
            {es ? "Confirmá al aplicar" : "Confirm when you apply"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-ca-success-light text-ca-success text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
            <CheckCircle2 size={12} />
            {es ? `Verificado · ${domain}` : `Verified · ${domain}`}
          </span>
        )}
        {service.sourceUrl && (
          <a
            href={service.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand hover:text-brand-dark transition-colors whitespace-nowrap"
          >
            {es ? "Solicitar" : "Apply"} <ArrowUpRight size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

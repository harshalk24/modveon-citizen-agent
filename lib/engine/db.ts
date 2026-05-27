import { createClient } from "@supabase/supabase-js"
import type { ExtractedScheme } from "./extractor"
import type { VerificationResult } from "./verifier"

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ── REVIEW QUEUE ──────────────────────────────────────

export async function insertToReviewQueue(
  scheme: ExtractedScheme,
  verification: VerificationResult,
  source: "crawl" | "manual",
  contentHash?: string
) {
  const { error } = await supabase.from("review_queue").insert({
    scheme_data: scheme,
    verification_result: verification,
    priority: verification.priority,
    overall_status: verification.overallStatus,
    flag_reasons: verification.flagReasons,
    content_hash: contentHash,
    source,
    status: "pending",
    created_at: new Date().toISOString(),
  })
  if (error) console.error("Review queue insert error:", error)
}

// ── APPROVE ───────────────────────────────────────────

export async function approveScheme(reviewId: string) {
  const { data: review, error } = await supabase
    .from("review_queue")
    .select("*")
    .eq("id", reviewId)
    .single()

  if (error || !review) return { error: "Not found" }

  const schemeData = review.scheme_data as ExtractedScheme

  // Strip fields that exist on ExtractedScheme but NOT in the schemes table.
  // extracted_at is internal-only; raw_source_url IS in the table.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { extracted_at, ...schemeRow } = schemeData as ExtractedScheme & { extracted_at?: string }

  // Check if scheme already exists (upsert)
  const { data: existing } = await supabase
    .from("schemes")
    .select("id")
    .eq("agency", schemeRow.agency)
    .eq("scheme_name", schemeRow.scheme_name)
    .eq("country", schemeRow.country)
    .single()

  if (existing) {
    const { error: updateErr } = await supabase
      .from("schemes")
      .update({
        ...schemeRow,
        content_hash: review.content_hash,
        updated_at: new Date().toISOString(),
        last_verified: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (updateErr) console.error("approveScheme update error:", updateErr)

    await supabase.from("change_log").insert({
      scheme_id: existing.id,
      change_type: "update",
      review_id: reviewId,
      changed_by: "engine",
      changed_at: new Date().toISOString(),
    })
  } else {
    const { error: insertErr } = await supabase.from("schemes").insert({
      ...schemeRow,
      content_hash: review.content_hash,
      is_active: true,
      created_at: new Date().toISOString(),
      last_verified: new Date().toISOString(),
    })

    if (insertErr) console.error("approveScheme insert error:", insertErr)
  }

  await supabase
    .from("review_queue")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", reviewId)

  return { success: true }
}

// ── REJECT ────────────────────────────────────────────

export async function rejectScheme(reviewId: string, reason: string) {
  await supabase
    .from("review_queue")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
}

// ── SEARCH LIVE SCHEMES ──────────────────────────────

export async function searchSchemes(params: {
  country: string
  lifeEvent?: string
  employment?: string
  limit?: number
}) {
  let q = supabase
    .from("schemes")
    .select("*")
    .eq("country", params.country)
    .eq("is_active", true)

  if (params.lifeEvent) {
    q = q.contains("life_events", [params.lifeEvent])
  }
  if (params.employment && params.employment !== "any") {
    q = q.or(
      `employment_types.cs.{"${params.employment}"},employment_types.cs.{"any"}`
    )
  }

  const { data, error } = await q.limit(params.limit ?? 20)
  if (error) {
    console.error("searchSchemes error:", error)
    return []
  }
  return data ?? []
}

// ── QUEUE STATS ───────────────────────────────────────

export async function getQueueStats() {
  const [pending, approved, rejected, total] = await Promise.all([
    supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected"),
    supabase
      .from("schemes")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ])
  return {
    pending: pending.count ?? 0,
    approved: approved.count ?? 0,
    rejected: rejected.count ?? 0,
    totalInKB: total.count ?? 0,
  }
}

/*
──────────────────────────────────────────────────────────────
SUPABASE SQL SCHEMA — run in Supabase SQL editor before use
──────────────────────────────────────────────────────────────

-- Schemes table (the live KB)
create table schemes (
  id                    uuid primary key default gen_random_uuid(),
  scheme_name           text not null,
  scheme_name_es        text,
  agency                text not null,
  agency_full           text,
  country               text not null default 'SV',
  life_events           text[] default '{}',
  employment_types      text[] default '{"any"}',
  description           text,
  description_es        text,
  eligibility           text,
  eligibility_es        text,
  documents_required    text[] default '{}',
  documents_required_es text[] default '{}',
  steps                 text[] default '{}',
  steps_es              text[] default '{}',
  deadline_days         integer,
  amount                text,
  office_hours          text,
  official_link         text,
  confidence            float default 1.0,
  is_active             boolean default true,
  is_supplementary      boolean default false,
  content_hash          text,
  raw_source_url        text,
  last_verified         timestamp,
  created_at            timestamp default now(),
  updated_at            timestamp default now()
);

-- Review queue (all crawled schemes before human approval)
create table review_queue (
  id                  uuid primary key default gen_random_uuid(),
  scheme_data         jsonb not null,
  verification_result jsonb,
  overall_status      text default 'flag',
  priority            text default 'normal',
  flag_reasons        text[] default '{}',
  content_hash        text,
  source              text default 'crawl',
  status              text default 'pending',
  rejection_reason    text,
  created_at          timestamp default now(),
  reviewed_at         timestamp
);

-- Audit log
create table change_log (
  id          uuid primary key default gen_random_uuid(),
  scheme_id   uuid references schemes(id),
  change_type text,
  review_id   uuid references review_queue(id),
  changed_by  text,
  changed_at  timestamp default now()
);

-- Indexes
create index on schemes(country, is_active);
create index on schemes(agency);
create index on review_queue(status, priority);
create index on review_queue(created_at desc);

-- pgvector for future semantic search
create extension if not exists vector;
alter table schemes add column if not exists embedding vector(1536);
*/

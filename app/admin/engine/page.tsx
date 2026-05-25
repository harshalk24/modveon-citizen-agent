"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Activity,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react"

// ── TYPES ──────────────────────────────────────────────
interface QueueStats {
  pending: number
  approved: number
  rejected: number
  totalInKB: number
}

interface QueueItem {
  id: string
  scheme_data: {
    scheme_name: string
    agency: string
    country: string
    official_link: string
    description?: string
    life_events?: string[]
    employment_types?: string[]
    confidence?: number
    amount?: string | null
    deadline_days?: number | null
  }
  verification_result: {
    overallStatus: "pass" | "flag" | "fail"
    priority: "critical" | "high" | "normal" | "low"
    flagReasons: string[]
    checks: {
      linkAlive: boolean
      linkStatus: number
      isDuplicate: boolean
      hasRequiredFields: boolean
      missingFields: string[]
      changeIsSignificant: boolean | null
      changedFields?: string[]
    }
  }
  overall_status: "pass" | "flag" | "fail"
  priority: "critical" | "high" | "normal" | "low"
  flag_reasons: string[]
  source: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

// ── HELPERS ────────────────────────────────────────────
const ENGINE_SECRET = process.env.NEXT_PUBLIC_ENGINE_SECRET ?? ""

async function apiCall(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-engine-secret": ENGINE_SECRET,
      ...options.headers,
    },
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

function priorityColor(p: string) {
  if (p === "critical") return "bg-red-100 text-red-700 border-red-200"
  if (p === "high") return "bg-orange-100 text-orange-700 border-orange-200"
  if (p === "normal") return "bg-blue-100 text-blue-700 border-blue-200"
  return "bg-gray-100 text-gray-600 border-gray-200"
}

function statusColor(s: string) {
  if (s === "pass") return "text-green-600"
  if (s === "fail") return "text-red-600"
  return "text-amber-600"
}

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function elapsed(from: Date) {
  const s = Math.floor((Date.now() - from.getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

// ── REVIEW CARD ────────────────────────────────────────
function ReviewCard({
  item,
  onApprove,
  onReject,
}: {
  item: QueueItem
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectInput, setShowRejectInput] = useState(false)
  const vr = item.verification_result
  const sd = item.scheme_data

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900 truncate">
              {sd.scheme_name}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{sd.agency}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityColor(item.priority)}`}
            >
              {item.priority}
            </span>
            {vr && (
              <span className={`text-xs font-medium ${statusColor(vr.overallStatus)}`}>
                {vr.overallStatus === "pass" ? "✓ pass" : vr.overallStatus === "fail" ? "✗ fail" : "⚠ flag"}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 line-clamp-2">
            {sd.description ?? "No description extracted"}
          </p>
          {vr?.flagReasons?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {vr.flagReasons.map((r, i) => (
                <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-gray-400">{fmt(item.created_at)}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && vr && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex items-center gap-1.5">
              {vr.checks.linkAlive ? (
                <CheckCircle size={13} className="text-green-500" />
              ) : (
                <XCircle size={13} className="text-red-500" />
              )}
              <span className="text-gray-600">
                Link {vr.checks.linkAlive ? "alive" : `dead (${vr.checks.linkStatus})`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {vr.checks.hasRequiredFields ? (
                <CheckCircle size={13} className="text-green-500" />
              ) : (
                <AlertTriangle size={13} className="text-amber-500" />
              )}
              <span className="text-gray-600">
                {vr.checks.hasRequiredFields
                  ? "All fields present"
                  : `Missing: ${vr.checks.missingFields?.join(", ")}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {vr.checks.isDuplicate ? (
                <AlertTriangle size={13} className="text-amber-500" />
              ) : (
                <CheckCircle size={13} className="text-green-500" />
              )}
              <span className="text-gray-600">
                {vr.checks.isDuplicate ? "Possible duplicate" : "No duplicate"}
              </span>
            </div>
            {vr.checks.changeIsSignificant !== null && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-500" />
                <span className="text-gray-600">
                  Changed: {vr.checks.changedFields?.join(", ")}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 pt-1 flex-wrap">
            <span className="text-xs bg-gray-100 rounded px-2 py-0.5">
              confidence {((sd.confidence ?? 0) * 100).toFixed(0)}%
            </span>
            {sd.life_events?.length ? (
              <span className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                {sd.life_events.join(", ")}
              </span>
            ) : null}
            {sd.amount && (
              <span className="text-xs bg-green-50 text-green-700 rounded px-2 py-0.5">
                {sd.amount}
              </span>
            )}
            <a
              href={sd.official_link}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Source <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}

      {item.status === "pending" && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          {showRejectInput ? (
            <div className="flex items-center gap-2 w-full">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Rejection reason…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <button
                onClick={() => { if (rejectReason.trim()) onReject(item.id + "|" + rejectReason) }}
                disabled={!rejectReason.trim()}
                className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg disabled:opacity-40 hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onApprove(item.id)}
                className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium"
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── CRAWL PROGRESS BANNER ──────────────────────────────
function CrawlProgressBanner({
  startedAt,
  itemsFound,
  onDone,
}: {
  startedAt: Date
  itemsFound: number
  onDone: () => void
}) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedSecs = Math.floor((Date.now() - startedAt.getTime()) / 1000)
  const progress = Math.min((elapsedSecs / 780) * 100, 99) // 13 min estimate

  // Auto-dismiss after 16 minutes
  useEffect(() => {
    if (elapsedSecs > 960) onDone()
  }, [elapsedSecs, onDone])

  return (
    <div className="bg-[#1B3A8C] rounded-xl p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span className="font-medium text-sm">Crawl in progress</span>
          <span className="text-xs text-white/60">· {elapsed(startedAt)} elapsed</span>
        </div>
        <div className="flex items-center gap-3">
          {itemsFound > 0 && (
            <span className="text-xs bg-white/20 rounded-full px-3 py-1 font-medium">
              {itemsFound} schemes found so far
            </span>
          )}
          <button
            onClick={onDone}
            className="text-xs text-white/50 hover:text-white/80 underline"
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#FFC400] rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex gap-6 mt-3">
        {[
          { label: "Scraping pages", done: elapsedSecs > 10 },
          { label: "Extracting schemes", done: elapsedSecs > 60 },
          { label: "Verifying links", done: elapsedSecs > 180 },
          { label: "Writing to queue", done: itemsFound > 0 },
        ].map(({ label, done }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs">
            {done ? (
              <CheckCircle size={12} className="text-[#FFC400]" />
            ) : (
              <div className="w-3 h-3 rounded-full border border-white/30 animate-pulse" />
            )}
            <span className={done ? "text-white/90" : "text-white/40"}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PAGE ───────────────────────────────────────────────
export default function EngineAdminPage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [items, setItems] = useState<QueueItem[]>([])
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending")
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [crawlStartedAt, setCrawlStartedAt] = useState<Date | null>(null)
  const [crawling, setCrawling] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const prevPendingRef = useRef(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setApiError(null)
    try {
      const res = await apiCall(`/api/engine/queue?status=${activeTab}&limit=50`)
      if (!res.ok) {
        if (res.status === 401) {
          setApiError("Auth failed — ENGINE_SECRET not loaded. Restart the dev server.")
        } else {
          setApiError(`API error ${res.status}`)
        }
        return
      }
      const data = res.data as { stats: QueueStats; items: QueueItem[] }
      setStats(data.stats)
      setItems(data.items ?? [])

      // Auto-dismiss crawl banner when items arrive
      if (crawlStartedAt && data.stats.pending > prevPendingRef.current && data.stats.pending > 0) {
        prevPendingRef.current = data.stats.pending
      }
    } catch {
      setApiError("Could not reach API — is the dev server running?")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeTab, crawlStartedAt])

  useEffect(() => {
    void fetchQueue()
  }, [fetchQueue])

  // Poll every 5s while crawl is in progress
  useEffect(() => {
    if (crawlStartedAt) {
      pollRef.current = setInterval(() => void fetchQueue(true), 5000)
      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }
  }, [crawlStartedAt, fetchQueue])

  const handleApprove = async (id: string) => {
    await apiCall("/api/engine/approve", {
      method: "POST",
      body: JSON.stringify({ reviewId: id, action: "approve" }),
    })
    setNotification("✓ Scheme approved and added to live KB")
    setTimeout(() => setNotification(null), 3000)
    void fetchQueue()
  }

  const handleReject = async (idAndReason: string) => {
    const [id, ...rest] = idAndReason.split("|")
    await apiCall("/api/engine/approve", {
      method: "POST",
      body: JSON.stringify({ reviewId: id, action: "reject", reason: rest.join("|") }),
    })
    setNotification("Scheme rejected")
    setTimeout(() => setNotification(null), 3000)
    void fetchQueue()
  }

  const handleRunCrawl = async () => {
    setCrawling(true)
    try {
      const res = await apiCall("/api/engine/run", {
        method: "POST",
        body: JSON.stringify({ country: "SV" }),
      })
      if (!res.ok) {
        setNotification(`Failed to start crawl (${res.status})`)
        return
      }
      setCrawlStartedAt(new Date())
      prevPendingRef.current = stats?.pending ?? 0
    } catch {
      setNotification("Could not start crawl — check the dev server")
    } finally {
      setCrawling(false)
    }
  }

  const handleRunVerify = async () => {
    setNotification("Running weekly link verification…")
    try {
      const res = await apiCall("/api/engine/verify")
      const d = res.data as { checked?: number; dead?: number }
      setNotification(`Verification done — checked ${d?.checked ?? 0}, dead ${d?.dead ?? 0}`)
    } catch {
      setNotification("Verification failed")
    }
    setTimeout(() => setNotification(null), 6000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Government Engine</h1>
            <p className="text-sm text-gray-500">Knowledge base management &amp; review queue</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5 text-xs mr-2">
              {apiError ? (
                <><WifiOff size={13} className="text-red-400" /><span className="text-red-400">Disconnected</span></>
              ) : (
                <><Wifi size={13} className="text-green-400" /><span className="text-green-500">Connected</span></>
              )}
            </div>
            <button
              onClick={() => void handleRunVerify()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              <Activity size={14} /> Weekly verify
            </button>
            <button
              onClick={() => void fetchQueue()}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            {crawlStartedAt && (
              <button
                onClick={() => {
                  setCrawlStartedAt(null)
                  if (pollRef.current) clearInterval(pollRef.current)
                }}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => void handleRunCrawl()}
              disabled={crawling}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-[#1B3A8C] text-white rounded-lg hover:bg-[#152D70] font-medium disabled:opacity-50"
            >
              <Play size={14} className={crawling ? "animate-pulse" : ""} />
              {crawling ? "Starting…" : "Run crawl"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Auth error */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <XCircle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Error:</strong> {apiError}
              {apiError.includes("ENGINE_SECRET") && (
                <p className="mt-1 text-red-600 text-xs">
                  Stop the dev server, then run <code className="bg-red-100 px-1 rounded">npm run dev</code> again.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Crawl progress banner */}
        {crawlStartedAt && (
          <CrawlProgressBanner
            startedAt={crawlStartedAt}
            itemsFound={stats?.pending ?? 0}
            onDone={() => {
              setCrawlStartedAt(null)
              if (pollRef.current) clearInterval(pollRef.current)
            }}
          />
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Pending review", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
              { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
              { label: "Live in KB", value: stats.totalInKB, icon: Database, color: "text-blue-600", bg: "bg-blue-50" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(["pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "pending" && (stats?.pending ?? 0) > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? "bg-[#1B3A8C] text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {stats!.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Queue items */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Database size={32} className="text-gray-200 mx-auto mb-3" />
            {crawlStartedAt ? (
              <>
                <p className="text-gray-500 text-sm font-medium">Crawl is running — schemes will appear here shortly</p>
                <p className="text-gray-300 text-xs mt-1">Auto-refreshing every 5 seconds</p>
                <div className="flex justify-center gap-1 mt-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#1B3A8C] animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm">No {activeTab} items in queue</p>
                {activeTab === "pending" && (
                  <p className="text-gray-300 text-xs mt-1">Click &ldquo;Run crawl&rdquo; to populate the queue</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {crawlStartedAt && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" />
                Crawl still in progress — more items may appear. Auto-refreshing every 5s.
              </p>
            )}
            {items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                onApprove={(id) => void handleApprove(id)}
                onReject={(idReason) => void handleReject(idReason)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

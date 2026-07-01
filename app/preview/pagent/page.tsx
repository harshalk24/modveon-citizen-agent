"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { Send, ShieldCheck } from "lucide-react"
import Link from "next/link"
import PreviewMessageRenderer from "../components/PreviewMessageRenderer"
import type { PreviewMessage, PreviewActivity, ChipOption } from "../types"

const MOCK = {
  name:       "Sarah Tan",
  country:    "Singapore",
  nric:       "T•••••293G",
  babyName:   "Baby girl",
  babyDOB:    "12 May 2026",
  daysOld:    8,
  whatsapp:   "+65 9XXX-XXXX",
  bankPref:   "POSB",
}

let _id = 0
const uid   = (p = "g") => `${p}_${++_id}_${Date.now()}`
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function PreviewNav({ current }: { current: "kb" | "navigation" | "pagent" }) {
  const links = [
    { label: "KB",         href: "/preview/kb",         key: "kb"         },
    { label: "Navigation", href: "/preview/navigation",  key: "navigation" },
    { label: "Proactive",  href: "/preview/pagent",      key: "pagent"     },
  ]
  return (
    <div className="flex items-center gap-1 ml-2">
      {links.map(l => (
        <Link key={l.key} href={l.href}
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
            current === l.key ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}>
          {l.label}
        </Link>
      ))}
    </div>
  )
}

function ZKBadge() {
  return (
    <div className="flex justify-start px-1 -mt-2 mb-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full">
        <ShieldCheck size={12} className="text-purple-500 flex-shrink-0" />
        <span className="text-[11px] text-purple-700 font-medium">
          SingPass MyInfo verified · No documents uploaded · Cryptographically proven
        </span>
      </div>
    </div>
  )
}

const BENEFITS = [
  {
    id:   "cash",
    name: "Baby Bonus Cash Gift",
    desc: "One-time cash payment for your first child. Transferred to your designated bank account in 3 tranches.",
    value: "$3,000",
    mode: "online" as const,
    url:  "https://www.babybonusplus.msf.gov.sg",
    urgent: false,
  },
  {
    id:   "cda-grant",
    name: "Child Development Account — First Step Grant",
    desc: "Government deposits $3,000 into your child's CDA automatically when you open the account. Dollar-for-dollar matching up to $3,000 after that.",
    value: "$3,000 + matching",
    mode: "in-person" as const,
    url:  "https://www.posb.com.sg/personal/deposits/savings-accounts/child-development-account",
    urgent: true,
  },
]

export default function PagentPage() {
  const [messages,        setMessages]        = useState<PreviewMessage[]>([])
  const [isTyping,        setIsTyping]        = useState(false)
  const [waitingForInput, setWaitingForInput] = useState<string | null>(null)
  const [currentChips,    setCurrentChips]    = useState<ChipOption[]>([])
  const [babyNameInput,   setBabyNameInput]   = useState("")
  const bottomRef          = useRef<HTMLDivElement>(null)
  const gateRef            = useRef<string | null>(null)
  const scenarioStartedRef = useRef(false)
  const babyNameRef        = useRef("")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isTyping])

  const addMsg     = (msg: PreviewMessage) => setMessages(prev => [...prev, msg])
  const updateAct  = (id: string, acts: PreviewActivity[]) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, activities: acts } : m))
  const markComplete = (id: string) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isComplete: true } : m))
  const withTyping = async (ms: number) => { setIsTyping(true); await delay(ms); setIsTyping(false) }
  const setGate  = (gate: string, chips: ChipOption[] = []) => {
    gateRef.current = gate; setWaitingForInput(gate); setCurrentChips(chips)
  }
  const clearGate = () => { gateRef.current = null; setWaitingForInput(null); setCurrentChips([]) }

  const addBenefit = (b: typeof BENEFITS[0]) => addMsg({
    id: uid("b"),
    type: "benefit" as any,
    docName:      b.name,
    content:      b.desc,
    urgent:       b.urgent,
    docMode:      b.mode,
    benefitValue: b.value,
    docApplyUrl:  b.url,
  } as PreviewMessage)

  /* ── Scan ────────────────────────────────────────────────── */
  async function runScan() {
    // No addMsg for user here — dispatcher adds it
    await delay(600)
    const actId = uid("act1")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "p1", label: "Checking Baby Bonus eligibility via SingPass…",        status: "running" },
        { id: "p2", label: "Verifying birth certificate with ICA…",                status: "waiting" },
        { id: "p3", label: "Detecting dependency: CDA must be opened first…",     status: "waiting" },
        { id: "p4", label: "Pre-filling Baby Bonus Plus application…",             status: "waiting" },
      ],
    })

    await delay(1800)
    updateAct(actId, [
      { id: "p1", label: "Baby Bonus eligibility confirmed ✓", status: "done",
        detail: `${MOCK.name} · NRIC ${MOCK.nric} · First child · Born ${MOCK.babyDOB} · ${MOCK.daysOld} days old` },
      { id: "p2", label: "Birth cert verified with ICA ✓",    status: "done",
        detail: "ICA registration ref: B-2026-0512-7823 · matching SingPass records" },
      { id: "p3", label: "Detecting CDA dependency…",          status: "running",
        detail: "Checking if POSB CDA account exists for this NRIC" },
      { id: "p4", label: "Pre-filling Baby Bonus Plus application…", status: "waiting" },
    ])
    addMsg({
      id: uid("dr1"), type: "doc-retrieved",
      docName: "SingPass — Birth Registration Verified",
      docData: [
        { key: "Mother",     value: MOCK.name                },
        { key: "NRIC",       value: MOCK.nric               },
        { key: "Baby DOB",   value: MOCK.babyDOB            },
        { key: "Baby age",   value: `${MOCK.daysOld} days old` },
        { key: "Birth cert", value: "B-2026-0512-7823 ✓"    },
        { key: "Eligible",   value: "Baby Bonus (1st child)" },
      ],
    })

    await delay(1600)
    updateAct(actId, [
      { id: "p1", label: "Eligibility confirmed ✓",    status: "done" },
      { id: "p2", label: "Birth cert verified ✓",      status: "done" },
      { id: "p3", label: "DEPENDENCY DETECTED ⚠️",    status: "done",
        detail: "No POSB CDA found · CDA must be opened at a bank BEFORE Baby Bonus can be linked" },
      { id: "p4", label: "Application form pre-filled ✓", status: "done",
        detail: "SingPass MyInfo retrieved: mother's details, baby birth cert · ready to enrol" },
    ])
    markComplete(actId)

    await delay(800)
    await withTyping(2000)
    addMsg({
      id: uid(), type: "assistant",
      content: "Both schemes are confirmed — your baby is registered and eligible. Here's what I've already done while you were reading this:\n\n✓ Verified birth certificate with ICA\n✓ Confirmed eligibility via SingPass\n✓ Pre-filled both applications\n\nI just need your baby's name — that's the one thing that isn't in any registry. Once you give me that, I'll submit both on your behalf.",
    })
    await delay(400)
    for (const b of BENEFITS) { addBenefit(b); await delay(300) }

    await delay(500)
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "The fastest path: open the CDA online at posb.com.sg right now (takes 5 minutes with SingPass), then I'll submit the Baby Bonus application immediately after. Total time: about 15 minutes. Want me to prepare both applications?",
    })
    setGate("confirm-start", [
      { label: "Yes — handle it for me",        value: "start",  primary: true },
      { label: "What exactly are these schemes?", value: "amount"              },
    ])
  }

  /* ── Amount explanation ─────────────────────────────────── */
  async function runAmount() {
    await withTyping(1400)
    addMsg({
      id: uid(), type: "assistant",
      content: "Two separate schemes that most new parents only discover months later — by which point they've already missed the easiest window:\n\n**Baby Bonus Plus** — a government cash gift paid to you directly in 3 instalments as your baby reaches different milestones. Registration is online and takes 5 minutes, but most parents get overwhelmed with everything else after birth and forget.\n\n**Child Development Account (CDA)** — a government-backed savings account opened at your bank. The moment it's created, MSF deposits a one-time grant. It's meant for your child's education and healthcare costs.\n\nBoth of these are yours by right. I've pre-filled the applications already — I just need your baby's name to complete them.",
    })
    setGate("confirm-start", [
      { label: "OK — handle it for me", value: "start", primary: true },
    ])
  }

  /* ── CDA + Baby Bonus form ──────────────────────────────── */
  // Called by dispatcher — does NOT add the user message itself
  async function runFormPreview() {
    await delay(400)
    await withTyping(1000)
    addMsg({
      id: uid(), type: "assistant",
      content: "I've already pulled your details from SingPass — mother's name, NRIC, date of birth, bank preference. There's just one thing I can't get from any registry:\n\n**What would you like to name your baby girl?**",
    })
    // Show text input for baby name
    setGate("baby-name")
  }

  function handleBabyNameSubmit() {
    const name = babyNameInput.trim()
    if (!name || gateRef.current !== "baby-name") return
    babyNameRef.current = name
    setBabyNameInput("")
    clearGate()
    addMsg({ id: uid("u-bn"), type: "user", content: name })
    setTimeout(() => runShowFormWithName(name), 400)
  }

  async function runShowFormWithName(babyName: string) {
    await withTyping(1200)
    addMsg({
      id: uid(), type: "assistant",
      content: `Perfect — **${babyName}** it is. Here's the complete CDA application. Everything's pre-filled from SingPass. Review and confirm:`,
    })
    await delay(300)
    const formId = uid("form")
    addMsg({
      id: formId,
      type: "form-preview",
      ...({ zkProof: true, formTitle: "CDA Account Opening — POSB", formAgency: "POSB" }),
      content: "Pre-filled via SingPass MyInfo. No documents needed. No branch visit required.",
      formFields: [
        { label: "Mother's name",   value: MOCK.name,     status: "filled",   source: "SingPass"  },
        { label: "NRIC",            value: MOCK.nric,     status: "filled",   source: "SingPass"  },
        { label: "Baby's name",     value: babyName,      status: "filled",   source: "you"        },
        { label: "Date of birth",   value: MOCK.babyDOB,  status: "filled",   source: "ICA"        },
        { label: "Bank preference", value: MOCK.bankPref, status: "filled",   source: "auto"       },
        { label: "First Step Grant",value: "$3,000 auto-credited", status: "filled", source: "MSF" },
      ],
      confirmOptions: [
        { label: "Confirm & open account →", value: "open-cda",  primary: true },
        { label: "Use a different bank",     value: "diff-bank" },
      ],
    } as PreviewMessage)
    setGate("cda-gate", [
      { label: "Confirm & open account →", value: "open-cda",  primary: true },
    ])
  }

  /* ── CDA + Baby Bonus submission — no user message here, chip handler adds it */
  async function runSubmission() {
    await delay(400)

    const actId = uid("sub")
    addMsg({
      id: actId, type: "activity", isComplete: false,
      activities: [
        { id: "s1", label: "Opening POSB Child Development Account…",  status: "running" },
        { id: "s2", label: "Depositing $3,000 First Step Grant…",      status: "waiting" },
        { id: "s3", label: "Submitting Baby Bonus Plus registration…",  status: "waiting" },
        { id: "s4", label: "Scheduling cash gift tranches…",           status: "waiting" },
      ],
    })
    await delay(2000)
    updateAct(actId, [
      { id: "s1", label: "POSB CDA opened ✓", status: "done",
        detail: "Account: •••• 4821 · Baby Sarah Tan · Active" },
      { id: "s2", label: "Depositing $3,000 First Step Grant…", status: "running" },
      { id: "s3", label: "Submitting Baby Bonus Plus…", status: "waiting" },
      { id: "s4", label: "Scheduling cash gift tranches…", status: "waiting" },
    ])
    await delay(1800)
    updateAct(actId, [
      { id: "s1", label: "POSB CDA opened ✓",                   status: "done" },
      { id: "s2", label: "$3,000 First Step Grant deposited ✓", status: "done",
        detail: "Credited to CDA •••• 4821 within 3 working days" },
      { id: "s3", label: "Baby Bonus Plus registered ✓",        status: "done",
        detail: "Reference: BB-2026-TAN-9031 · Cash gift linked to CDA" },
      { id: "s4", label: "Tranche schedule confirmed ✓",        status: "running" },
    ])
    await delay(1400)
    updateAct(actId, [
      { id: "s1", label: "POSB CDA opened ✓",            status: "done" },
      { id: "s2", label: "First Step Grant deposited ✓", status: "done" },
      { id: "s3", label: "Baby Bonus registered ✓",      status: "done" },
      { id: "s4", label: "Payment schedule set ✓",       status: "done",
        detail: "$1,000 now · $1,000 at 12 months · $1,000 at 18 months" },
    ])
    markComplete(actId)

    await delay(800)
    await withTyping(1600)
    addMsg({
      id: uid("status"), type: "status",
      content: "**All done ✓** Reference: BB-2026-TAN-9031\n\n$3,000 First Step Grant deposited into CDA. $1,000 cash gift incoming in 3 days. Total secured: **$4,000 today**, with $2,000 more over 18 months.",
    })
    await delay(1200)
    addMsg({
      id: uid("wa"), type: "whatsapp-mock",
      whatsappText: `📱 Citizen Agent → Sarah (${MOCK.whatsapp})\n\n"Both registrations done ✓\n\nBaby Bonus Plus ref: BB-2026-TAN-9031\nCDA account: POSB •••• 4821\n\nWhat happens next — automatically, without you doing anything:\n• First Step Grant credited to CDA within 3 working days\n• Cash gift first instalment to your bank in 3 days\n• Subsequent instalments at 12 months and 18 months\n\nYou had a baby to look after. I handled the paperwork."`,
    })
    await delay(1500)
    await withTyping(2000)
    addMsg({
      id: uid("final"), type: "confirmation",
      content: "Both done ✓ You told me you had a baby. I found the schemes, verified your eligibility, pre-filled the forms from SingPass, asked for the one thing I couldn't get from a registry, and submitted both.\n\nYou didn't have to know these schemes existed, find the forms, or remember a single deadline. That's what I'm here for.\n\nOne more thing — the CDA has a government matching programme worth looking into:",
      confirmOptions: [
        { label: "How do I maximise the matching?",  value: "matching",  primary: true },
        { label: "That's all for now",               value: "done" },
      ],
    })
    setGate("final", [
      { label: "How do I maximise the matching?",  value: "matching",  primary: true },
      { label: "That's all for now",               value: "done" },
    ])
  }

  /* ── Mount ──────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      if (scenarioStartedRef.current) return
      scenarioStartedRef.current = true
      addMsg({
        id: "intro", type: "assistant",
        content: `${greeting}, Sarah! What's going on today?`,
      })
      // Sarah tells the agent — this is how the agent "knows"
      setGate("tell-agent", [
        { label: "🍼 I just had a baby",          value: "new-baby",  primary: true },
        { label: "I have a question about a benefit", value: "benefit"              },
        { label: "Something else",               value: "other"                     },
      ])
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Dispatcher ─────────────────────────────────────────── */
  async function handleChipAction(value: string) {
    const gate = gateRef.current
    clearGate()

    // Sarah tells the agent she had a baby — agent IMMEDIATELY takes action proactively
    if (gate === "tell-agent") {
      if (value === "new-baby") {
        addMsg({ id: uid("u"), type: "user", content: "I just had a baby 🍼" })
        await delay(400)
        await withTyping(1400)
        addMsg({
          id: uid(), type: "assistant",
          content: "Congratulations, Sarah! 🎉 That's wonderful news.\n\nThere are two government schemes every new parent is entitled to that most people never get to in time — I'm going to handle both registrations for you right now. You just need to answer one question at the end.\n\nLet me check your eligibility first…",
        })
        await runScan()
      } else if (value === "benefit") {
        addMsg({ id: uid("u"), type: "user", content: "I have a question about a benefit" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Of course — what benefit did you have in mind? If you've recently had a baby, changed jobs, or started a business, I can find everything you're entitled to." })
        setGate("tell-agent", [{ label: "🍼 I just had a baby", value: "new-baby", primary: true }])
      } else {
        addMsg({ id: uid("u"), type: "user", content: "Something else" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Tell me what's happening in your life and I'll find every government scheme that applies to you." })
        setGate("tell-agent", [{ label: "🍼 I just had a baby", value: "new-baby", primary: true }])
      }
      return
    }

    if (gate === "confirm-start") {
      addMsg({ id: uid("u"), type: "user", content: value === "start" ? "Yes — walk me through it" : "What exactly are these?" })
      if (value === "amount") await runAmount()
      else await runFormPreview()
      return
    }

    if (gate === "cda-gate") {
      if (value === "open-cda") {
        addMsg({ id: uid("u"), type: "user", content: "Confirm & open account" })
        await runSubmission()
      } else if (value === "diff-bank") {
        addMsg({ id: uid("u"), type: "user", content: "Use a different bank" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "Of course — POSB, DBS, OCBC, and UOB all offer the CDA with the same $3,000 First Step Grant. The process is identical at all four. Just let me know which you prefer and I'll update the form." })
        setGate("cda-gate", [{ label: "Use POSB (same is fine)", value: "open-cda", primary: true }])
      }
      return
    }

    if (gate === "final") {
      if (value === "matching") {
        addMsg({ id: uid("u"), type: "user", content: "How do I maximise the matching?" })
        await withTyping(1400)
        addMsg({ id: uid(), type: "assistant",
          content: "To get the full **$3,000 government matching**, save $3,000 into the CDA before your child turns 12. The government matches dollar-for-dollar.\n\nPractical tip: Set up a $250/month GIRO into the CDA. In 12 months you'll have saved $3,000, the government adds $3,000 — your child has $9,000+ for education and healthcare before their first birthday." })
        await delay(600)
        addMsg({ id: uid("wa2"), type: "whatsapp-mock",
          whatsappText: `📱 Citizen Agent → Sarah\n\n"CDA tip: set up GIRO of $250/month to CDA •••• 4821. In 12 months: your $3,000 + govt matching $3,000 = $6,000 in CDA.\n\nI'll remind you at the 6-month mark to check your balance."` })
      } else {
        addMsg({ id: uid("u"), type: "user", content: "That's all for now" })
        await withTyping(800)
        addMsg({ id: uid(), type: "assistant", content: "You're all set, Sarah. Enjoy every moment with your baby. I'll remind you before the 12-month CDA matching window. 💛" })
      }
      return
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-gray-900">{greeting}, {MOCK.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{MOCK.country} · New mother · NRIC {MOCK.nric}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900">Layer 3 · Act · Plus</span>
          <PreviewNav current="pagent" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ backgroundColor: "#F9FAFB", backgroundImage: "radial-gradient(circle, rgba(255,196,0,0.15) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        {messages.map(msg => (
          <Fragment key={msg.id}>
            {(msg as any).type === "separator" ? (
              <div className="flex items-center gap-3 my-1 px-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{msg.content}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            ) : (
              <PreviewMessageRenderer message={msg} onAction={handleChipAction} />
            )}
            {(msg as any).zkProof && msg.type === "form-preview" && <ZKBadge />}
          </Fragment>
        ))}
        {isTyping && (
          <div className="flex justify-start"><div className="max-w-[85%]">
            <p className="text-[11px] text-gray-400 px-1 mb-1">Citizen Agent</p>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div></div>
        )}
        <div ref={bottomRef} />
      </div>

      {waitingForInput && (
        <div className="bg-white border-t border-gray-100 px-4 py-2.5 flex-shrink-0">
          {waitingForInput === "baby-name" ? (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={babyNameInput}
                onChange={e => setBabyNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleBabyNameSubmit() }}
                placeholder="Enter your baby's name…"
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-50 bg-white"
              />
              <button
                onClick={handleBabyNameSubmit}
                disabled={!babyNameInput.trim()}
                className="w-9 h-9 rounded-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 flex items-center justify-center disabled:opacity-40 transition-colors flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {currentChips.map(chip => (
                <button key={chip.value} onClick={() => handleChipAction(chip.value)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    chip.primary ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-500" : "border border-gray-300 bg-white text-gray-600 hover:border-yellow-400 hover:bg-yellow-50"
                  }`}>
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 border border-gray-200 rounded-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 select-none">Citizen Agent is handling this step…</div>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center opacity-40"><Send size={14} className="text-gray-500" /></div>
        </div>
      </div>
    </div>
  )
}

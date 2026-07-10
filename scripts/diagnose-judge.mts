// Task J1, Phase 1 — diagnosis only. Reproduces the exact facts payload
// (buildKBFacts, post-R1) and the exact judge prompt for 5 cases from the M1
// report, then calls the LLM directly (mirroring checkFaithfulness's own
// call) to capture the RAW judge output/reasoning — not just the {ok,problems}
// checkFaithfulness returns. This does NOT modify any production code.

import fs from "node:fs"
import path from "node:path"

// Minimal .env.local loader — same pattern as test/grounding.test.mts.
function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.replace(/\r$/, "")
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1")
  }
}
loadDotEnvLocal()

import { lookupServices } from "../lib/kb"
import { buildKBFacts } from "../lib/context-builder"
import { isUnverified } from "../lib/grounding"
import { getLLM } from "../lib/llm"

// Exact copy of checkFaithfulness's prompt template (lib/grounding.ts) — for
// diagnostic reproduction only, not a separate implementation.
function buildPrompt(facts: any[], reply: string, ctx: { lifeEvent: string; employment: string }): string {
  return `You are a strict fact-checker reviewing a draft reply from a government-benefits assistant before it reaches a citizen.

CITIZEN CONTEXT: ${JSON.stringify({ lifeEvent: ctx.lifeEvent, employment: ctx.employment })}
RETRIEVED FACTS (the ONLY things the reply is allowed to claim as fact): ${JSON.stringify(facts)}

CANDIDATE REPLY:
"""
${reply}
"""

This check is about INCORRECT or UNSUPPORTED claims, never about INCOMPLETENESS or PHRASING. A reply that omits a fact (a deadline, an amount, an acknowledgment of the citizen's situation) is NOT a violation — silence is always safe. Only flag the reply for something it actually SAYS that is wrong or unbacked, never for something it fails to mention, and never for HOW it says something it's otherwise entitled to say.

You are judging SUBSTANCE, not PHRASING. Do NOT flag: rewording, paraphrasing, summarizing, reasonable inference from the provided facts, differences in emphasis or level of detail, or tone/transition/empathy language. A reply does not need to restate a fact's full nuance (e.g. "varies by municipality") or use any particular hedge wording — if the substance of a claim is backed by RETRIEVED FACTS, it is SUPPORTED regardless of exact phrasing.

Check TWO things:
1. Every factual claim the reply DOES make — specifically an agency name, a number (cost/amount/deadline/day-count), or an eligibility/document requirement — must be supported by RETRIEVED FACTS above. Flag a claim only if it names an agency, states a number, or asserts an eligibility/document rule that is NOT present in or reasonably inferable from those facts. Do not flag a claim for being reworded, summarized, or missing extra caveats that were present in the source fact but aren't essential to the claim itself.
2. The reply must not CONTRADICT the citizen's own context — e.g. opening with sympathy for a job loss when their actual life event is a new baby, or stating an eligibility rule that contradicts their known employment status. This means asserting something FALSE about their situation — it does NOT mean the reply is required to explicitly mention or acknowledge their life event/employment. A reply that is simply silent about their situation (no opener, no personalization) is NOT a contradiction. Tone, empathy, and personalization style are handled elsewhere and are out of scope for this check.

QUESTIONS ARE NEVER CONTRADICTIONS. If the reply ASKS the citizen something ("do you have a storefront or employees?", "what is the poder for?") instead of asserting it, that question cannot contradict their context — a question has no truth value to check. Only flag rule 2 when the reply STATES something false about the citizen as fact. Also: "employment" (formal/informal/unemployed) describes how the citizen earns income personally — it says NOTHING about the size, structure, or staffing of a business or situation they're asking about. A citizen with "informal" employment can still run a business with a storefront or employees; asking about THAT is not a contradiction of THEIR employment status. Similarly, a general, explicitly conditional rule ("you need X if your assets are $12,000 or more") is not an assertion about this specific citizen's case — it's only a contradiction if the reply drops the condition and asserts the rule applies to them without knowing that yet.

IMPORTANT exception to rule 1: when a fact's "unverified" field is true, the reply is ALLOWED to state an approximate figure AS LONG AS it is clearly hedged in SOME reasonable way (e.g. "about $X — please confirm with [agency]", "reported around N days, verify with the agency", "based on available info", "not confirmed"). ANY phrasing that signals the figure isn't certain counts — do not require a specific hedge template or a named agency inside the hedge itself. A properly hedged estimate for an unverified fact is SUPPORTED, not a violation — only flag it if the reply asserts the figure as certain/definite with NO hedge language at all, or if the stated figure isn't reasonably close to anything mentioned in that fact's own data (name/amount/deadline/tip).

Examples of the SUPPORTED/UNSUPPORTED boundary:
- Facts include {"amount": null, "deadline": "30 days after birth"} and the tip says "domestic use costs about $3-$5, varies by municipality." Reply: "You need the birth certificate. For domestic use it costs about $3 to $5, depending on the municipality." → SUPPORTED. This is a paraphrase of the tip, not a new claim — do not flag it for omitting other details from the tip (like the $20/abroad tier) that the reply didn't need to mention.
- Facts include {"amount": null} with a tip mentioning "$3.50, but this is not confirmed." Reply: "Based on available info, the cost is about $3.50 — please confirm the exact fee with the agency." → SUPPORTED. The hedge doesn't need to match the tip's exact wording or name the specific agency to count as a hedge.
- Facts include {"deadline": "30 days after birth"} and the reply states "you must register within 90 days." → UNSUPPORTED. This is a fabricated number not backed by the facts, not a phrasing difference.
- Facts don't mention any agency named "Ministry of Labor" and the reply states the citizen must also go to the Ministry of Labor. → UNSUPPORTED. This is a fabricated agency/claim.

Be strict and suspicious about claims with NO basis at all in the facts, and about contradictions — if a claim asserts a specific agency, number, or rule that has no reasonable basis in RETRIEVED FACTS, mark it UNSUPPORTED. But do not penalize a reply merely for how it phrases, hedges, or summarizes something that IS backed by the facts — that is correct, desired behavior, not a violation. Return ONLY this JSON, no other text:
{"verdict": "SUPPORTED" or "UNSUPPORTED", "problems": ["<offending claim or contradiction, if any>"]}`
}

interface Case {
  label: string
  lifeEvent: string
  employment: string
  language: "en" | "es"
  ctx: { lifeEvent: string; employment: string }
  reply: string
}

const EXTRA_CASES: Case[] = [
  {
    label: "#6 [claimed LEGITIMATE catch] Rosa (en) — 'How much does it cost to register my business?' (attempt 1)",
    lifeEvent: "start-business", employment: "informal", language: "en",
    ctx: { lifeEvent: "start-business", employment: "informal" },
    reply: `Exciting — here's what you need to get started.

Based on what you've told me, since you're running an informal business, you may not need a Matrícula de Empresa if your business assets are below $12,000. However, if you do need one, the balance-deposit fee is around $17.14, but this is unconfirmed.

Here are some services you can apply for:

---
**CONAMYPE Fondo Productivo grant** · CONAMYPE · Up to $2,500
This grant can help fund your business and can even cover your CNR registration fee.
Documents: DUI DOC_INFO:dui · Brief business plan DOC_INFO:business_plan · Bank account DOC_INFO:bank_account
---

**Tax ID (NIT)** · Ministerio de Hacienda
You can obtain your NIT entirely online, which is necessary for your business registration.
Documents: DUI DOC_INFO:dui · CNR registration certificate DOC_INFO:cnr_registration_certificate
APPLY_NOW:https://www.mh.gob.sv

---
**Municipal operating licence** · Alcaldía
This license is required to operate your business legally within your municipality.
Documents: DUI DOC_INFO:dui · CNR certificate DOC_INFO:cnr_certificate · NIT certificate DOC_INFO:nit_certificate · Business address proof DOC_INFO:business_address_proof
---

Let me know if you have a storefront or employees, as that will help clarify your registration needs!`,
  },
  {
    label: "#10 [claimed LEGITIMATE catch] José — 'What if the poder is for a custody case in court, not property?' (attempt 1, unsupported scope)",
    lifeEvent: "diaspora", employment: "formal", language: "en",
    ctx: { lifeEvent: "diaspora", employment: "formal" },
    reply: `It's important to know that a power of attorney (poder notarial) can be used for various legal matters, including custody cases. However, for a custody case, the person you grant the poder to must ultimately be a licensed Salvadoran lawyer, as the poder will need to be recognized in court.

Since you're formally employed and in a diaspora situation, you can still proceed with this process. Here’s what you need to prepare:

---
**Power of attorney (poder notarial) from abroad** · RREES · ~$40 (reported, unconfirmed) — consular route is cheaper than the notary route; confirm with your consulate
This allows you to grant legal authority for someone to act on your behalf in a custody case.
Documents: Your valid passport or DUI DOC_INFO:valid-passport-or-dui · Details of what the poder covers (specific custody case details) DOC_INFO:details-of-poder · Name and DUI of the person receiving the poder in El Salvador DOC_INFO:name-and-dui-of-recipient
---

**Before you go:**
- Hours: Consulate hours vary by city — check rree.gob.sv for your nearest consulate.
- Address: Search RREE for your nearest consulate.
- Navigation: rree.gob.sv → Servicios Consulares → Actos Notariales → Citas (verified 2026-07-04).
- Tip: It's recommended to grant the poder before a Salvadoran consul, as this is cheaper and more straightforward than using a Supreme-Court-authorized notary.

If you get stuck on the website or something is unclear when you arrive, come back and tell me what you see — I will help you figure out the next step.`,
  },
]

const CASES: Case[] = [
  {
    label: "#1 [OVER-STRICT claim] María — 'I just had a baby, what am I entitled to?' (attempt 1)",
    lifeEvent: "new-baby", employment: "formal", language: "en",
    ctx: { lifeEvent: "new-baby", employment: "formal" },
    reply: `Congratulations on your new baby! Here's what you qualify for:

---
**Birth certificate (certificación de partida) — RNPN** · RNPN · Varies by use: ~$3–5 domestic (via alcaldía, varies by municipality), $20 abroad-authenticated (RNPN only since June 25, 2026), ~$35 consular via Simple SV (fee waiver pending legislative approval — confirm current cost)
You need to register your baby's birth within 30 days.
Documents: Your DUI DOC_INFO:dui · Hospital discharge certificate DOC_INFO:hospital_discharge_certificate · Father's DUI (if applicable) DOC_INFO:father_dui
INFO_URL: https://www.rnpn.gob.sv/servicios/certificacion-de-partidas-en-el-salvador/
---

---
**Maternity benefit (subsidio por maternidad)** · ISSS
You qualify for this benefit if you meet the contribution requirements, providing 100% of your insured base salary during 16 weeks of leave.
Documents: DUI DOC_INFO:dui · Hospital discharge certificate DOC_INFO:hospital_discharge_certificate · ISSS referral form DOC_INFO:isss_referral_form
INFO_URL: https://elsalvador.eregulations.org/media/ley%20del%20seguro%20social.pdf
---

---
**Enroll baby as ISSS dependent** · ISSS
You can enroll your baby as a dependent within 1 year of birth, ensuring they receive health coverage.
Documents: DUI DOC_INFO:dui · Baby's birth certificate from RNPN DOC_INFO:baby_birth_certificate
INFO_URL: https://www.isss.gob.sv
---

---
**Child subsidy** · Government · $50/mo
You can receive this monthly subsidy for your child after registering the birth with RNPN.
Documents: Baby's birth certificate DOC_INFO:baby_birth_certificate
INFO_URL: https://www.presidencia.gob.sv
---

---
**Paternity benefit (partner)** · ISSS
If applicable, your partner can apply for this benefit, which requires the baby's birth certificate and employer certification.
Documents: Father's DUI DOC_INFO:father_dui · Baby's birth certificate DOC_INFO:baby_birth_certificate · Employer certification DOC_INFO:employer_certification
INFO_URL: https://www.isss.gob.sv
---

Make sure to register your baby's birth first to access these benefits. If you have any questions or need help with the next steps, feel free to ask!`,
  },
  {
    label: "#2 [OVER-STRICT claim] María — 'How long does maternity leave last?' (attempt 1)",
    lifeEvent: "new-baby", employment: "formal", language: "en",
    ctx: { lifeEvent: "new-baby", employment: "formal" },
    reply: `Since you just had a baby and are employed formally, you qualify for maternity leave. Maternity leave lasts for 16 weeks (112 days), and you must take at least 10 weeks after the birth.

To apply for this benefit, you'll need the following documents:
- Your DUI
- Hospital discharge certificate
- ISSS referral form

Next, make sure to gather these documents and visit the ISSS office to start your application. If you need help with the process, just let me know!`,
  },
  {
    label: "#11 [OVER-STRICT claim] María — 'What if I have problems when I get there?' (attempt 1)",
    lifeEvent: "new-baby", employment: "formal", language: "en",
    ctx: { lifeEvent: "new-baby", employment: "formal" },
    reply: `If you encounter problems when you arrive at a government office, here’s what you can do:

1. **Stay Calm**: Take a deep breath and try to explain your issue clearly to the staff. They are there to help you.

2. **Documents**: Make sure you have all the necessary documents with you. For example, if you're registering your baby's birth, you need:
   - Your DUI
   - Hospital discharge certificate
   - Father's DUI (if applicable)

3. **Ask Questions**: If something is unclear, don’t hesitate to ask the staff for clarification. They can guide you through the process.

4. **Time**: Be prepared to wait, as there may be other people ahead of you. The process can take some time depending on the office's workload.

5. **Follow Up**: If you don’t receive the service you need, ask for a contact number or a way to follow up on your application.

If you get stuck on the website or something is unclear when you arrive, come back and tell me what you see — I will help you figure out the next step.

Also, based on your situation of having a new baby, here are the benefits you qualify for:

---
**Birth certificate (certificación de partida) — RNPN** · RNPN · Varies by use: ~$3–5 domestic (via alcaldía, varies by municipality), $20 abroad-authenticated (RNPN only since June 25, 2026), ~$35 consular via Simple SV
You need to register your baby's birth within 30 days.
Documents: Your DUI DOC_INFO:your-dui · Hospital discharge certificate DOC_INFO:hospital-discharge-certificate · Father's DUI (if applicable) DOC_INFO:fathers-dui
---
**Maternity benefit (subsidio por maternidad)** · ISSS
You qualify for this benefit since you are formally employed and have contributed to ISSS.
Documents: DUI DOC_INFO:your-dui · Hospital discharge certificate DOC_INFO:hospital-discharge-certificate · ISSS referral form DOC_INFO:isss-referral-form
---
**Enroll baby as ISSS dependent** · ISSS
You can enroll your baby as a dependent within one year of birth, but you need the birth certificate first.
Documents: DUI DOC_INFO:your-dui · Baby's birth certificate from RNPN DOC_INFO:babys-birth-certificate
---
**Child subsidy** · Government · $50/mo
You can receive this subsidy after registering your baby's birth.
Documents: Baby's birth certificate DOC_INFO:babys-birth-certificate
---
**Paternity benefit (partner)** · ISSS
This benefit is available for the father and requires the employer to submit the application on their behalf.
Documents: Father's DUI DOC_INFO:fathers-dui · Baby's birth certificate DOC_INFO:babys-birth-certificate · Employer certification DOC_INFO:employer-certification
`,
  },
  {
    label: "#8 [LEGITIMATE catch] Rosa (es) — '¿Cuánto cuesta registrar mi negocio?' (attempt 1, unhedged unverified cost)",
    lifeEvent: "start-business", employment: "informal", language: "es",
    ctx: { lifeEvent: "start-business", employment: "informal" },
    reply: `Para registrar tu negocio, primero tenés la opción de acceder al **Fondo Productivo de CONAMYPE**. Este fondo puede ofrecerte hasta $2,500 para financiar tu negocio. Es recomendable que apliques a este fondo antes de registrar tu negocio, ya que puede cubrir el costo de la matrícula en el CNR.

---
**Fondo Productivo de CONAMYPE** · CONAMYPE · Hasta $2,500
Este fondo es para ayudar a emprendedores a financiar sus negocios.
Documentos: DUI DOC_INFO:dui · Plan de negocio (breve) DOC_INFO:plan-negocio · Cuenta bancaria DOC_INFO:cuenta-bancaria
APPLY_NOW:https://www.conamype.gob.sv
---

En cuanto a la **Matrícula de Empresa** en el CNR, el costo es aproximadamente $17.14, pero esto puede variar. Sin embargo, antes de hablar de la matrícula, necesito saber: ¿lo manejás solo/a vos, o tenés un local o empleados?`,
  },
  {
    label: "#12 [LEGITIMATE catch] Rosa — 'What's the next step after I get my NIT?' (attempt 2, hallucinated '44 districts')",
    lifeEvent: "start-business", employment: "informal", language: "en",
    ctx: { lifeEvent: "start-business", employment: "informal" },
    reply: `After you get your NIT, the next step is to obtain your municipal operating license. This is necessary for you to legally operate your business.

---
**Municipal operating licence** · Alcaldía
This license is required to operate your business legally in your municipality.
Documents: [DUI] DOC_INFO:dui · [CNR certificate] DOC_INFO:cnr-business-registration · [NIT certificate] DOC_INFO:nit · [Business address proof] DOC_INFO:business-address-proof
---

**Before you go:**
- Hours: Monday–Friday, 8:00am–4:00pm
- Address: Search Alcaldía [your city] El Salvador for your nearest office.
- Navigation: alcaldía.gob.sv → Servicios → Licencia de Funcionamiento (as of May 2026)
- Tip: Since 2024, El Salvador has 44 districts not 262 municipalities. Tell me your city, and I will tell you which district office to go to.

Make sure you have all the required documents ready when you visit. If you get stuck on the website or something is unclear when you arrive, come back and tell me what you see — I will help you figure out the next step.`,
  },
]

// Experiment: does filtering the facts payload down to ONLY the services the
// reply actually mentions (same name-matching checkEntities already does)
// change the verdict? Tests the "information overload" hypothesis directly.
const FILTER_TO_MENTIONED = process.env.FILTER_TO_MENTIONED === "1"

async function main() {
  for (const c of [...EXTRA_CASES, ...CASES]) {
    console.log("\n" + "=".repeat(100))
    console.log(c.label)
    console.log("=".repeat(100))

    let retrieved = lookupServices({ country: "SV", lifeEvent: c.lifeEvent, employment: c.employment })
    if (FILTER_TO_MENTIONED) {
      const mentioned = retrieved.filter(s => c.reply.includes(s.name) || c.reply.includes(s.nameEs))
      if (mentioned.length > 0) retrieved = mentioned
      console.log(`(filtered to ${retrieved.length}/${retrieved.length === mentioned.length ? mentioned.length : "?"} mentioned services: ${retrieved.map(s => s.id).join(", ")})`)
    }
    const facts = buildKBFacts(retrieved, c.language).map((f, i) => ({ ...f, unverified: isUnverified(retrieved[i]) }))

    console.log("\n--- FACTS PAYLOAD SIZE:", facts.length, "services ---")

    const prompt = buildPrompt(facts, c.reply, c.ctx)
    console.log("--- FULL PROMPT LENGTH:", prompt.length, "chars ---")

    console.log("\n--- RAW JUDGE OUTPUT ---")
    try {
      const text = (await getLLM().complete(prompt, { temperature: 0.0, maxTokens: 300, json: true })).trim()
      console.log(text)
    } catch (err) {
      console.error("LLM call failed:", err)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })

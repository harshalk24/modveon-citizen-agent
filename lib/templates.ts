// Context-aware chat templates — shown above the input bar

export type Template = { label: string; message: string }

const BY_SITUATION: Record<string, Template[]> = {
  "new-baby": [
    { label: "📋 What's my most urgent deadline?",     message: "What's my most urgent deadline right now and what happens if I miss it?" },
    { label: "💰 How much will maternity pay me?",     message: "Exactly how much will I receive from ISSS maternity benefit and for how long?" },
    { label: "📍 Where do I register my baby's birth?", message: "Where is the nearest RNPN office to register my baby's birth, and what do I need to bring?" },
    { label: "👶 Can my partner get paternity leave?", message: "My partner is employed — does he qualify for paid paternity leave?" },
    { label: "🏥 How do I add my baby to health coverage?", message: "How do I enroll my baby as an ISSS dependent, and what does that cover?" },
  ],
  "job-loss": [
    { label: "✅ Do I qualify for unemployment benefits?", message: "Do I qualify for ISSS unemployment benefits and how much would I get?" },
    { label: "⏳ How long do benefits last?",           message: "For how many months can I receive unemployment benefits and when do they stop?" },
    { label: "📄 What documents do I need?",           message: "What documents do I need to apply for unemployment benefits this week?" },
    { label: "🎓 What free training is available?",    message: "What free vocational training does INCAF offer and how do I enroll?" },
    { label: "📅 What's the application deadline?",    message: "Is there a deadline to apply for unemployment benefits after losing my job?" },
  ],
  "start-business": [
    { label: "💵 Can I get a grant first?",            message: "Should I apply for the CONAMYPE grant before registering at CNR, and how much can I get?" },
    { label: "🏪 What's the cheapest way to register?", message: "What is the least expensive way to register my business in El Salvador step by step?" },
    { label: "🪪 How do I get my NIT?",               message: "What do I need to get my NIT (tax ID) and how long does it take?" },
    { label: "📍 Which alcaldía do I use?",            message: "With the 2024 district reorganisation, which alcaldía covers my area and how do I find out?" },
    { label: "⏱️ How long does registration take?",   message: "From start to finish, how long does it take to fully register a business in El Salvador?" },
  ],
  "health": [
    { label: "🏥 How do I get ISSS coverage?",        message: "How do I enroll in ISSS health coverage and what are the requirements?" },
    { label: "👨‍👩‍👧 Can I cover my family?",              message: "Can I add my spouse and children to my ISSS health plan and what does it cost?" },
    { label: "💊 What does ISSS cover?",              message: "What medical services and medications does ISSS cover for free?" },
    { label: "🏨 Are there public hospital options?", message: "Which public hospitals in El Salvador can I use and what services are free?" },
  ],
  "general": [
    { label: "🎁 What benefits am I missing?",        message: "Based on my profile, what government benefits am I currently not claiming?" },
    { label: "⚡ What's my most urgent deadline?",     message: "What is the most time-sensitive benefit or deadline I need to act on right now?" },
    { label: "📋 Walk me through step 1",             message: "What is the very first thing I should do this week to start claiming my benefits?" },
    { label: "💰 What's the total value of my benefits?", message: "How much money in total could I receive if I claimed all my eligible benefits?" },
  ],
}

// Fallback when no situation is set
const DEFAULT: Template[] = [
  { label: "🎁 What benefits do I qualify for?",     message: "What government benefits do I qualify for in El Salvador right now?" },
  { label: "📋 How do I get started?",               message: "I'm new — what should I do first to find out what benefits I'm entitled to?" },
  { label: "⚡ What's my most urgent step?",          message: "What is the single most important thing I should do this week?" },
]

export function getTemplates(situation?: string, employment?: string): Template[] {
  const base = situation ? (BY_SITUATION[situation] || BY_SITUATION["general"]) : DEFAULT
  // If no situation but employment is set, add a relevant tip
  const result = base.slice(0, 3)  // show 3 max to keep UI clean
  return result
}

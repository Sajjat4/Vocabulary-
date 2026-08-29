import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { 
  Clipboard, 
  Sparkles, 
  CheckCircle2, 
  Play, 
  Shuffle, 
  ListOrdered, 
  BookOpen, 
  Volume2, 
  RotateCcw, 
  AlertCircle, 
  Code, 
  Languages, 
  HelpCircle, 
  Trash2, 
  Send,
  Minimize2,
  Maximize2,
  ClipboardPaste
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VocabItem } from "../utils/astParser";

export type { VocabItem };

export interface VocabularyStudioHandle {
  organize: () => void;
  toggleRandom: () => void;
}

interface VocabularyStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToAI: (prompt: string, vocabList: VocabItem[], quizMode: "sequential" | "mixed") => void;
  activeVoiceSession: boolean;
}

const DEFAULT_EXAMPLE = `[
  [
    "q" => "আমি",
    "a" => ["わたし", "わたくし"],
    "c" => 1,
    "hira" => "わたし"
  ],
  [
    "q" => "তুমি / আপনি",
    "a" => ["あなた"],
    "c" => 1,
    "hira" => "あなた"
  ],
  [
    "q" => "ধন্যবাদ",
    "a" => ["ありがとう", "ありがとうございます"],
    "c" => 2,
    "hira" => "ありがとう"
  ]
]`;

export default forwardRef(function VocabularyStudio({
  isOpen,
  onClose,
  onSendToAI,
  activeVoiceSession
}: VocabularyStudioProps, ref) {
  const [rawInput, setRawInput] = useState<string>("");
  const [parsedItems, setParsedItems] = useState<VocabItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"input" | "list" | "quiz">("input");
  const [formatMode, setFormatMode] = useState<"php" | "json">("php");
  const [formattedOutput, setFormattedOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [clipboardPermStatus, setClipboardPermStatus] = useState<"granted" | "prompt" | "denied">("prompt");

  useImperativeHandle(ref, () => ({
    organize: () => {
      parseAndFixVocabulary(rawInput);
    },
    toggleRandom: () => {
      setQuizMode(prev => prev === "sequential" ? "mixed" : "sequential");
    }
  }));

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
        .then((status) => {
          setClipboardPermStatus(status.state as any);
          status.onchange = () => {
            setClipboardPermStatus(status.state as any);
          };
        })
        .catch(() => {});
    }
  }, []);

  // Quiz State
  const [quizMode, setQuizMode] = useState<"sequential" | "mixed">("sequential");
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [quizOrder, setQuizOrder] = useState<number[]>([]);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [userAnswerInput, setUserAnswerInput] = useState<string>("");
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  // AST / Fault-tolerant Parser function
  const parseAndFixVocabulary = (input: string) => {
    setParseError(null);
    if (!input.trim()) {
      setParseError("দয়া করে টেক্সট বক্সে আপনার ভোকাবুলারি কোড বা টেক্সট পেস্ট করুন।");
      return;
    }

    try {
      let cleaned = input.trim();

      // Step 1: Strip PHP variable declaration if exists (e.g., $vocabulary = ...)
      cleaned = cleaned.replace(/^\$[a-zA-Z0-9_]+\s*=\s*/, "");
      if (cleaned.endsWith(";")) {
        cleaned = cleaned.slice(0, -1).trim();
      }

      // Step 2: Convert PHP array syntax to JSON AST format
      // Replace PHP short array or long array
      // Replace => with :
      cleaned = cleaned.replace(/=>/g, ":");

      // Fix missing commas between elements in objects or arrays
      // E.g., "あなた" "c": 0 -> "あなた", "c": 0
      cleaned = cleaned.replace(/("\s*|\d+\s*|]\s*)(["{[])/g, "$1, $2");
      cleaned = cleaned.replace(/(\]\s*)(["{A-Za-z$_])/g, "$1, $2");
      cleaned = cleaned.replace(/(}\s*)(["{[])/g, "$1, $2");

      // Fix missing closing brackets or braces if unbalanced
      let openSquare = (cleaned.match(/\[/g) || []).length;
      let closeSquare = (cleaned.match(/\]/g) || []).length;
      while (closeSquare < openSquare) {
        cleaned += "]";
        closeSquare++;
      }

      let openCurly = (cleaned.match(/\{/g) || []).length;
      let closeCurly = (cleaned.match(/\}/g) || []).length;
      while (closeCurly < openCurly) {
        cleaned += "}";
        closeCurly++;
      }

      // Remove trailing commas before closing bracket/brace
      cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

      // Try parsing JSON
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {
        // Fallback heuristic regex extraction for highly damaged text
        const items: VocabItem[] = [];
        const qMatches = [...input.matchAll(/["']q["']\s*=>?\s*["']([^"']+)["']/g)];
        const hiraMatches = [...input.matchAll(/["']hira["']\s*=>?\s*["']([^"']+)["']/g)];
        
        // Extract array items or lines
        const lines = input.split(/\n+/);
        let curQ = "";
        let curA: string[] = [];
        let curHira = "";

        for (const line of lines) {
          if (line.includes('"q"') || line.includes("'q'")) {
            if (curQ && curA.length > 0) {
              items.push({ q: curQ, a: curA, hira: curHira });
            }
            const match = line.match(/["']q["']\s*=>?\s*["']([^"']+)["']/);
            curQ = match ? match[1] : "";
            curA = [];
            curHira = "";
          } else if (line.includes('"a"') || line.includes("'a'")) {
            const matches = [...line.matchAll(/["']([^"']+)["']/g)].map(m => m[1]).filter(w => w !== "a");
            curA = matches;
          } else if (line.includes('"hira"') || line.includes("'hira'")) {
            const match = line.match(/["']hira["']\s*=>?\s*["']([^"']+)["']/);
            if (match) curHira = match[1];
          }
        }
        if (curQ && curA.length > 0) {
          items.push({ q: curQ, a: curA, hira: curHira });
        }

        if (items.length === 0) {
          throw new Error("সিনট্যাক্স অনেক বেশি এলোমেলো, তবে চিন্তার কিছু নেই! সঠিক উদাহরণ দেখে চেষ্টা করুন।");
        }
        parsed = items;
      }

      // Normalize AST structure into VocabItem[]
      const normalizedList: VocabItem[] = [];
      const rawList = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of rawList) {
        if (Array.isArray(item)) {
          // If sub-item is array or key-value pair
          let obj: VocabItem = { q: "অজানা শব্দ", a: [] };
          for (const sub of item) {
            if (typeof sub === "object" && sub !== null) {
              obj = { ...obj, ...sub };
            }
          }
          normalizedList.push(obj);
        } else if (typeof item === "object" && item !== null) {
          const q = item.q || item.question || item.bn || "শব্দ";
          const aRaw = item.a || item.ans || item.answer || item.jp || [];
          const a = Array.isArray(aRaw) ? aRaw : [String(aRaw)];
          const hira = item.hira || item.hiragana || a[0] || "";
          const c = item.c || item.category || 0;
          normalizedList.push({ q, a, hira, c });
        }
      }

      setParsedItems(normalizedList);
      generateFormattedOutput(normalizedList, formatMode);
      setActiveTab("list");
      initQuiz(normalizedList, quizMode);
    } catch (error: any) {
      setParseError(error.message || "পার্স করতে সমস্যা হয়েছে। দয়া করে কোড চেক করুন।");
    }
  };

  const generateFormattedOutput = (list: VocabItem[], mode: "php" | "json") => {
    if (mode === "json") {
      setFormattedOutput(JSON.stringify(list, null, 2));
    } else {
      const lines: string[] = ["$vocabulary = ["];
      list.forEach((item, idx) => {
        lines.push("  [");
        lines.push(`    "q" => "${item.q}",`);
        const aStr = item.a.map(w => `"${w}"`).join(", ");
        lines.push(`    "a" => [${aStr}],`);
        if (item.c !== undefined) lines.push(`    "c" => ${item.c},`);
        if (item.hira) lines.push(`    "hira" => "${item.hira}"`);
        lines.push(`  ]${idx < list.length - 1 ? "," : ""}`);
      });
      lines.push("];");
      setFormattedOutput(lines.join("\n"));
    }
  };

  const handleRequestClipboardPerm = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardPermStatus("granted");
      if (text && text.trim()) {
        setRawInput(text);
        parseAndFixVocabulary(text);
        setParseError(null);
      } else {
        setParseError("✅ ক্লিপবোর্ড পারমিশন দেওয়া হয়েছে! কিন্তু ক্লিপবোর্ড এই মুহূর্তে খালি আছে।");
      }
    } catch (err) {
      setClipboardPermStatus("denied");
      setParseError("⚠️ ব্রাউজার ক্লিপবোর্ড পারমিশন ব্লক করেছে। উপরের URL বারে 🔒 বা ⚙️ আইকনে ক্লিক করে Clipboard Allow করুন অথবা বক্সে ক্লিক করে Ctrl+V চাপুন।");
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardPermStatus("granted");
      if (text && text.trim()) {
        setRawInput(text);
        parseAndFixVocabulary(text);
        setParseError(null);
      } else {
        setParseError("ক্লিপবোর্ডে কোনো লেখা পাওয়া যায়নি। প্রথমে কিছু কপি করুন।");
      }
    } catch (err) {
      setClipboardPermStatus("denied");
      setParseError("⚠️ ব্রাউজার ক্লিপবোর্ড পারমিশন দেয়নি। দয়া করে '🔐 পারমিশন দিন' বাটনে ক্লিক করুন অথবা সরাসরি বক্সে ক্লিক করে Ctrl+V চাপুন।");
    }
  };

  const initQuiz = (list: VocabItem[], mode: "sequential" | "mixed") => {
    if (list.length === 0) return;
    const order = list.map((_, idx) => idx);
    if (mode === "mixed") {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    setQuizOrder(order);
    setCurrentQuizIndex(0);
    setShowAnswer(false);
    setUserAnswerInput("");
    setQuizFeedback(null);
    setScore({ correct: 0, total: 0 });
  };

  const handleCheckQuizAnswer = () => {
    if (!parsedItems.length || currentQuizIndex >= quizOrder.length) return;
    const currentItem = parsedItems[quizOrder[currentQuizIndex]];
    const userClean = userAnswerInput.trim().toLowerCase();

    const isMatch = currentItem.a.some(ans => ans.toLowerCase() === userClean) ||
                    (currentItem.hira && currentItem.hira.toLowerCase() === userClean);

    if (isMatch) {
      setQuizFeedback("🎉 দারুণ! উত্তর সঠিক হয়েছে (Correct Answer)!");
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }));
    } else {
      setQuizFeedback(`❌ সঠিক উত্তর হলো: ${currentItem.a.join(", ")} (${currentItem.hira || ""})`);
      setScore(s => ({ ...s, total: s.total + 1 }));
    }
    setShowAnswer(true);
  };

  const nextQuizItem = () => {
    if (currentQuizIndex < quizOrder.length - 1) {
      setCurrentQuizIndex(c => c + 1);
      setShowAnswer(false);
      setUserAnswerInput("");
      setQuizFeedback(null);
    } else {
      setQuizFeedback("🏁 অভিনন্দন! আপনি সব ভোকাবুলারি প্র্যাকটিস শেষ করেছেন!");
    }
  };

  useEffect(() => {
    if (parsedItems.length > 0) {
      generateFormattedOutput(parsedItems, formatMode);
    }
  }, [formatMode]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      className="fixed inset-4 md:inset-x-12 md:top-16 md:bottom-20 z-50 bg-white/70 border border-white/80 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden transition-all"
    >
      {/* Top Bar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
            <BookOpen size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-sans">
              Zoya Vocabulary Studio & Teacher Quiz
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono">
                AST PARSER v2.0
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Parse → Fix → Pretty Print | ভাঙা কোড সাজান এবং জয়া-র সাথে লাইভ বা কুইজ প্র্যাকটিস করুন
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab("input")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "input"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Code size={14} />
            ১. ইনপুট ও পার্স (Parse & Fix)
          </button>
          <button
            onClick={() => setActiveTab("list")}
            disabled={parsedItems.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "list"
                ? "bg-blue-600 text-white shadow-sm"
                : parsedItems.length === 0
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Sparkles size={14} />
            ২. সাজানো তালিকা ({parsedItems.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("quiz");
              initQuiz(parsedItems, quizMode);
            }}
            disabled={parsedItems.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "quiz"
                ? "bg-gradient-to-r from-blue-600 to-teal-600 text-white shadow-sm"
                : parsedItems.length === 0
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Languages size={14} />
            ৩. টিচার কুইজ মোড (Teacher Mode)
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Minimize2 size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* TAB 1: INPUT & PARSER */}
        {activeTab === "input" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Clipboard size={18} />
                  টেক্সট ইনপুট বক্স (Text Input Box)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  আপনার এলোমেলো বা মিসিং কমা/ব্র্যাকেট যুক্ত PHP Array বা JSON এখানে পেস্ট করুন। AST জাদুর লাঠি তা ঠিক করে দেবে!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRawInput(DEFAULT_EXAMPLE);
                    parseAndFixVocabulary(DEFAULT_EXAMPLE);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/80 text-slate-700 text-xs border border-slate-200 transition-colors"
                >
                  উদাহরণ লোড করুন (Example)
                </button>
              </div>
            </div>

            {/* Large Text Input Box */}
            <div className="relative group">
              <textarea
                value={rawInput}
                onChange={(e) => {
                  const val = e.target.value;
                  const prevLen = rawInput.length;
                  setRawInput(val);
                  if (val && val.trim()) {
                    const isVocabFormat = /("q"|'q'|=>|\[\s*\[|[\u0980-\u09FF].*[\u3040-\u30FF\u4E00-\u9FAF]|[\u3040-\u30FF\u4E00-\u9FAF].*[\u0980-\u09FF])/.test(val) || val.split('\n').filter(l => l.trim()).length >= 1;
                    if (isVocabFormat && (Math.abs(val.length - prevLen) > 5 || (prevLen === 0 && val.length > 2))) {
                      parseAndFixVocabulary(val);
                    }
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text');
                  if (text && text.trim()) {
                    setTimeout(() => {
                      const target = e.target as HTMLTextAreaElement;
                      const val = target ? target.value : text;
                      if (val && val.trim()) {
                        parseAndFixVocabulary(val);
                      }
                    }, 20);
                  }
                }}
                placeholder={`["q" => "আমি", "a" => ["わたし","あなた" "c" => 0 "hira" => "わたし"]\n\nএখানে আপনার ভাঙা বা এলোমেলো কোড পেস্ট করুন... পেস্ট করলেই স্বয়ংক্রিয়ভাবে পার্স হবে!`}
                rows={10}
                className="w-full bg-white/50 border border-slate-200 rounded-2xl p-4 pb-16 text-sm font-mono text-slate-850 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-y shadow-sm"
              />
              <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2 z-10">
                <button
                  onClick={handlePasteFromClipboard}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl text-xs md:text-sm flex items-center gap-2 shadow-sm transition-all transform hover:scale-102 active:scale-98 cursor-pointer border border-blue-500/10"
                  title="ক্লিপবোর্ড থেকে সরাসরি পেস্ট ও স্বয়ংক্রিয় পার্স করুন"
                >
                  <ClipboardPaste size={18} className="text-white shrink-0" />
                  <span>ক্লিপবোর্ড থেকে পেস্ট (Auto Paste)</span>
                </button>
              </div>
            </div>

            {parseError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Action Buttons below input */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleRequestClipboardPerm}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs md:text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer"
                  title="ব্রাউজারে ক্লিপবোর্ড পারমিশন অ্যাক্টিভ করুন"
                >
                  <span>🔐 ক্লিপবোর্ড পারমিশন দিন</span>
                </button>

                <button
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/60 hover:bg-white/80 text-slate-700 border border-slate-200 font-semibold text-xs md:text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer"
                >
                  <Clipboard size={18} />
                  ক্লিপবোর্ড থেকে পেস্ট করুন (Paste)
                </button>
              </div>

              <button
                onClick={() => parseAndFixVocabulary(rawInput)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs md:text-sm shadow-sm transition-all transform active:scale-95 cursor-pointer"
              >
                <Sparkles size={18} />
                Parse → Fix → Pretty Print (সাজিয়ে দাও)
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PARSED LIST & PRETTY PRINT */}
        {activeTab === "list" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-blue-600" />
                  সাজানো শব্দতালিকা (Beautified Vocabulary) — মোট {parsedItems.length} টি শব্দ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  AST আপনার কোডের মিসিং কমা ও ব্র্যাকেট ঠিক করে সুন্দর ফরম্যাট তৈরি করেছে।
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                  <button
                    onClick={() => setFormatMode("php")}
                    className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                      formatMode === "php" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    PHP Array
                  </button>
                  <button
                    onClick={() => setFormatMode("json")}
                    className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
                      formatMode === "json" ? "bg-blue-600 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    JSON
                  </button>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(formattedOutput);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/60 hover:bg-white/80 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                >
                  <Clipboard size={14} />
                  {copied ? "কপি হয়েছে!" : "কোড কপি করুন"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Visual Flashcard Cards */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages size={14} /> শব্দ কার্ডসমূহ (Word Cards)
                </h4>
                {parsedItems.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="p-4 rounded-xl bg-white/50 border border-white/75 hover:bg-white/70 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-mono font-bold">
                          #{index + 1}
                        </span>
                        <h5 className="text-base font-bold text-slate-800">{item.q}</h5>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.a.map((ans, i) => (
                          <span
                            key={i}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 font-medium"
                          >
                            {ans}
                          </span>
                        ))}
                        {item.hira && (
                          <span className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-600 border border-teal-100 font-mono">
                            {item.hira}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Right Column: Pretty Printed Code View */}
              <div className="flex flex-col h-full">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Code size={14} /> Pretty Printed Code Output
                </h4>
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-800 overflow-x-auto max-h-[480px] shadow-sm">
                  <pre>{formattedOutput}</pre>
                </div>
              </div>
            </div>

            {/* AI Teacher Action Bar */}
            <div className="bg-white/50 p-5 rounded-2xl border border-white/70 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-blue-600" size={18} />
                  জয়া-র সাথে প্র্যাকটিস বা কুইজ শুরু করুন
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  জয়া আপনার শিক্ষক হিসেবে সিরিয়াল বা এলোমেলো (Mixed) ভাবে বাংলা বা জাপানিজে প্রশ্ন জিজ্ঞাসা করবে।
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setQuizMode("sequential");
                    initQuiz(parsedItems, "sequential");
                    setActiveTab("quiz");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 text-slate-700 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                >
                  <ListOrdered size={16} className="text-blue-600" />
                  সিরিয়াল অনুযায়ী (Sequential)
                </button>

                <button
                  onClick={() => {
                    setQuizMode("mixed");
                    initQuiz(parsedItems, "mixed");
                    setActiveTab("quiz");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Shuffle size={16} />
                  এলোমেলো (Mix / Jumbled)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AI TEACHER QUIZ MODE */}
        {activeTab === "quiz" && parsedItems.length > 0 && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Quiz Header & Mode Selector */}
            <div className="flex items-center justify-between bg-white/40 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-850">প্রশ্ন মোড:</span>
                <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                  <button
                    onClick={() => {
                      setQuizMode("sequential");
                      initQuiz(parsedItems, "sequential");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      quizMode === "sequential" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ListOrdered size={14} /> সিরিয়াল (Sequential)
                  </button>
                  <button
                    onClick={() => {
                      setQuizMode("mixed");
                      initQuiz(parsedItems, "mixed");
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      quizMode === "mixed" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Shuffle size={14} /> এলোমেলো (Mix)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-600 font-semibold font-mono">
                  স্কোর: <strong className="text-blue-600 font-black">{score.correct}</strong> / {score.total}
                </span>
                <button
                  onClick={() => initQuiz(parsedItems, quizMode)}
                  className="p-2 rounded-lg bg-white/60 hover:bg-white/80 border border-slate-200 text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                  title="রিসেট করুন"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Active Flashcard Quiz Question */}
            {currentQuizIndex < quizOrder.length ? (
              <motion.div
                key={currentQuizIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/50 border border-white/70 rounded-3xl p-8 text-center space-y-6 shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-mono font-bold">
                  প্রশ্ন {currentQuizIndex + 1} / {quizOrder.length}
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-xs uppercase tracking-widest text-slate-500 font-medium">
                    শব্দের অর্থ লিখুন বা বলুন (Japanese Meaning)
                  </span>
                  <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight font-sans">
                    {parsedItems[quizOrder[currentQuizIndex]].q}
                  </h3>
                </div>

                {/* Answer Input Area */}
                <div className="max-w-md mx-auto space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userAnswerInput}
                      onChange={(e) => setUserAnswerInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCheckQuizAnswer()}
                      placeholder="জাপানিজ অর্থ বা হিরাগানা লিখুন (যেমন: わたし)..."
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      onClick={handleCheckQuizAnswer}
                      className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all cursor-pointer"
                    >
                      চেক করুন
                    </button>
                  </div>

                  {/* Feedback Box */}
                  <AnimatePresence>
                    {quizFeedback && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl text-sm font-medium border ${
                          quizFeedback.includes("দারুণ")
                            ? "bg-teal-50 border-teal-200 text-teal-600"
                            : "bg-rose-50 border-rose-200 text-rose-600"
                        }`}
                      >
                        {quizFeedback}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Card Controls */}
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="px-4 py-2 rounded-xl bg-white/60 hover:bg-white/80 text-slate-700 text-xs font-medium border border-slate-200 transition-colors cursor-pointer"
                  >
                    {showAnswer ? "উত্তর লুকান" : "উত্তর দেখুন (Show Answer)"}
                  </button>

                  <button
                    onClick={nextQuizItem}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    পরবর্তী প্রশ্ন (Next) →
                  </button>
                </div>

                {/* Show Answer Reveal */}
                {showAnswer && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm"
                  >
                    <strong>সঠিক উত্তর:</strong> {parsedItems[quizOrder[currentQuizIndex]].a.join(", ")}{" "}
                    {parsedItems[quizOrder[currentQuizIndex]].hira && (
                      <span className="text-slate-500">({parsedItems[quizOrder[currentQuizIndex]].hira})</span>
                    )}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="p-12 text-center bg-white/50 rounded-3xl border border-white/70 space-y-4 shadow-sm">
                <Sparkles size={48} className="mx-auto text-blue-600 animate-bounce" />
                <h3 className="text-2xl font-bold text-slate-800">অভিনন্দন! কুইজ সেশন সমাপ্ত!</h3>
                <p className="text-slate-500 text-sm">
                  আপনার মোট স্কোর: <strong className="text-blue-600 font-bold">{score.correct}</strong> / {score.total}
                </p>
                <button
                  onClick={() => initQuiz(parsedItems, quizMode)}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-all shadow-sm cursor-pointer"
                >
                  আবার শুরু করুন (Restart Quiz)
                </button>
              </div>
            )}

            {/* Send to AI Live Teacher button */}
            <div className="p-4 rounded-2xl bg-white/50 border border-white/70 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <Volume2 className="text-blue-600" size={24} />
                <div>
                  <h5 className="text-sm font-bold text-slate-800">ভয়েস মোডে জয়া-র সাথে প্র্যাকটিস করুন</h5>
                  <p className="text-xs text-slate-500">
                    এই শব্দতালিকাটি সরাসরি জয়া-কে পাঠিয়ে দিন, জয়া মুখে মুখে আপনাকে প্রশ্ন করবে!
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  const prompt = `আমি একটি ভোকাবুলারি তালিকা পাঠাচ্ছি। তুমি আমার জাপানিজ ও বাংলা ভাষার শিক্ষক। প্রশ্ন মোড: ${
                    quizMode === "mixed" ? "এলোমেলো (Mixed/Jumbled)" : "সিরিয়াল অনুযায়ী (Sequential)"
                  }। আমাকে একে একে শব্দ জিজ্ঞাসা করো এবং আমার উত্তর চেক করো।`;
                  onSendToAI(prompt, parsedItems, quizMode);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
              >
                <Send size={14} />
                জয়া-কে পাঠান (Send to Zoya)
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

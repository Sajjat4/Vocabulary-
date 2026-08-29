export interface VocabItem {
  q: string;       // Bengali / Meaning word (e.g. "আমি")
  a: string[];     // Answers / Japanese meanings (e.g. ["わたし", "わたくし"])
  hira?: string;   // Hiragana reading
  romaji?: string; // Romaji reading
  c?: number;      // Category or count
  note?: string;
}

export function hiraganaToRomaji(input: string): string {
  if (!input) return "";
  if (/^[a-zA-Z\s\-.,!?()\/0-9]+$/.test(input)) return input;

  const map: Record<string, string> = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja", "じゅ": "ju", "じょ": "jo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
    "キャ": "kya", "キュ": "kyu", "キョ": "kyo",
    "シャ": "sha", "シュ": "shu", "ショ": "sho",
    "チャ": "cha", "チュ": "chu", "チョ": "cho",
    "ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
    "ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo",
    "ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
    "リャ": "rya", "リュ": "ryu", "リョ": "ryo",
    "ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
    "ジャ": "ja", "ジュ": "ju", "ジョ": "jo",
    "ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
    "ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo",
    "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
    "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
    "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
    "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
    "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
    "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
    "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
    "や": "ya", "ゆ": "yu", "よ": "yo",
    "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
    "わ": "wa", "を": "wo", "ん": "n",
    "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
    "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
    "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
    "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
    "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
    "ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
    "カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
    "サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
    "タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
    "ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
    "ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
    "マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
    "ヤ": "ya", "ユ": "yu", "ヨ": "yo",
    "ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
    "ワ": "wa", "ヲ": "wo", "ン": "n",
    "ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
    "ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
    "ダ": "da", "ヂ": "ji", "ヅ": "zu", "デ": "de", "ド": "do",
    "バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
    "パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
    "ー": "-"
  };

  let result = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "っ" || input[i] === "ッ") {
      if (i + 1 < input.length) {
        const nextTwo = input.slice(i + 1, i + 3);
        const nextOne = input.slice(i + 1, i + 2);
        const nextRomaji = map[nextTwo] || map[nextOne];
        if (nextRomaji && nextRomaji[0] && nextRomaji[0] !== '-') {
          result += nextRomaji[0];
        }
      }
      i++;
      continue;
    }
    if (i + 1 < input.length) {
      const pair = input.slice(i, i + 2);
      if (map[pair]) {
        result += map[pair];
        i += 2;
        continue;
      }
    }
    const char = input[i];
    if (map[char]) {
      result += map[char];
    } else {
      result += char;
    }
    i++;
  }
  return result;
}

export const DEFAULT_VOCAB_EXAMPLE = `[
  [
    "q" => "আমি",
    "a" => ["わたし", "わたくし"],
    "c" => 1,
    "hira" => "わたし",
    "romaji" => "watashi"
  ],
  [
    "q" => "তুমি / আপনি",
    "a" => ["あなた"],
    "c" => 1,
    "hira" => "あなた",
    "romaji" => "anata"
  ],
  [
    "q" => "ধন্যবাদ",
    "a" => ["ありがとう", "ありがとうございます"],
    "c" => 2,
    "hira" => "ありがとう",
    "romaji" => "arigatou"
  ]
]`;

export function parseVocabularyAST(input: string): { items: VocabItem[]; error: string | null; formattedPHP: string; formattedJSON: string } {
  if (!input || !input.trim()) {
    return {
      items: [],
      error: "দয়া করে টেক্সট বক্সে আপনার শব্দতালিকা বা কোড পেস্ট করুন (Please paste or type vocabulary).",
      formattedPHP: "",
      formattedJSON: ""
    };
  }

  try {
    let cleaned = input.trim();

    // Step 1: Strip PHP variable declaration if exists (e.g., $vocabulary = ...)
    cleaned = cleaned.replace(/^\$[a-zA-Z0-9_]+\s*=\s*/, "");
    if (cleaned.endsWith(";")) {
      cleaned = cleaned.slice(0, -1).trim();
    }

    // Step 2: Convert PHP array syntax to JSON AST format
    cleaned = cleaned.replace(/=>/g, ":");

    // Fix missing commas between elements in objects or arrays
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
      // Fallback heuristic regex extraction for highly damaged text or line-by-line Bengali/Japanese lists
      const items: VocabItem[] = [];
      const lines = input.split(/\n+/);
      let curQ = "";
      let curA: string[] = [];
      let curHira = "";
      let curRomaji = "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.includes('"q"') || line.includes("'q'") || line.includes("=>")) {
          if (curQ && curA.length > 0) {
            items.push({ q: curQ, a: curA, hira: curHira, romaji: curRomaji || hiraganaToRomaji(curHira || curA[0] || "") });
          }
          const qMatch = line.match(/["']?q["']?\s*[:=>]+\s*["']([^"']+)["']/);
          if (qMatch) {
            curQ = qMatch[1];
            curA = [];
            curHira = "";
            curRomaji = "";
          }
        } else if (line.includes('"a"') || line.includes("'a'")) {
          const matches = [...line.matchAll(/["']([^"']+)["']/g)].map(m => m[1]).filter(w => w !== "a");
          curA = matches;
        } else if (line.includes('"hira"') || line.includes("'hira'")) {
          const match = line.match(/["']?hira["']?\s*[:=>]+\s*["']([^"']+)["']/);
          if (match) curHira = match[1];
        } else if (line.includes('"romaji"') || line.includes("'romaji'")) {
          const match = line.match(/["']?romaji["']?\s*[:=>]+\s*["']([^"']+)["']/);
          if (match) curRomaji = match[1];
        } else {
          // Check if multi-column plain text line (e.g. Hiragana Romaji Bengali)
          const parts = line.split(/\t+|[-:=|/]+|\s{2,}/).map(p => p.trim()).filter(Boolean);
          if (parts.length >= 2) {
            let bn = "";
            let jp = "";
            let rm = "";
            for (const part of parts) {
              if (/[\u0980-\u09FF]/.test(part)) bn = part;
              else if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(part)) jp = part;
              else if (/^[a-zA-Z\s\-?()!0-9]+$/.test(part)) rm = part;
            }
            if (!bn && !jp && parts.length === 1) {
              const subparts = line.split(/\s+/).map(p => p.trim()).filter(Boolean);
              for (const part of subparts) {
                if (/[\u0980-\u09FF]/.test(part)) bn = part;
                else if (/[\u3040-\u30FF\u4E00-\u9FAF]/.test(part)) jp = part;
                else if (/^[a-zA-Z\-]+$/.test(part)) rm = part;
              }
            }
            if (bn || jp) {
              items.push({
                q: bn || "শব্দ",
                a: [jp || bn],
                hira: jp || bn,
                romaji: rm || hiraganaToRomaji(jp || bn)
              });
            }
          }
        }
      }
      if (curQ && curA.length > 0) {
        items.push({ q: curQ, a: curA, hira: curHira, romaji: curRomaji || hiraganaToRomaji(curHira || curA[0] || "") });
      }

      if (items.length === 0) {
        throw new Error("সিনট্যাক্স বুঝতে সমস্যা হচ্ছে। উদাহরণ দেখে আবার চেষ্টা করুন অথবা 'わたし watashi আমি' ফরম্যাটে লিখুন।");
      }
      parsed = items;
    }

    const normalizedList: VocabItem[] = [];
    const rawList = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of rawList) {
      if (Array.isArray(item)) {
        let obj: VocabItem = { q: "শব্দ", a: [] };
        for (const sub of item) {
          if (typeof sub === "object" && sub !== null) {
            obj = { ...obj, ...sub };
          }
        }
        if (!obj.romaji && obj.hira) obj.romaji = hiraganaToRomaji(obj.hira);
        normalizedList.push(obj);
      } else if (typeof item === "object" && item !== null) {
        const q = item.q || item.question || item.bn || item.bengali || "শব্দ";
        const aRaw = item.a || item.ans || item.answer || item.jp || item.hiragana || [];
        const a = Array.isArray(aRaw) ? aRaw : [String(aRaw)];
        const hira = item.hira || item.hiragana || a[0] || "";
        const romaji = item.romaji || item.r || item.en || hiraganaToRomaji(hira || a[0] || "");
        const c = item.c || item.category || 0;
        normalizedList.push({ q, a, hira, romaji, c });
      }
    }

    // Generate Pretty PHP & JSON
    const linesPHP: string[] = ["$vocabulary = ["];
    normalizedList.forEach((item, idx) => {
      linesPHP.push("  [");
      linesPHP.push(`    "q" => "${item.q}",`);
      const aStr = item.a.map(w => `"${w}"`).join(", ");
      linesPHP.push(`    "a" => [${aStr}],`);
      if (item.c !== undefined) linesPHP.push(`    "c" => ${item.c},`);
      if (item.hira) linesPHP.push(`    "hira" => "${item.hira}",`);
      linesPHP.push(`    "romaji" => "${item.romaji || hiraganaToRomaji(item.hira || '')}"`);
      linesPHP.push(`  ]${idx < normalizedList.length - 1 ? "," : ""}`);
    });
    linesPHP.push("];");

    return {
      items: normalizedList,
      error: null,
      formattedPHP: linesPHP.join("\n"),
      formattedJSON: JSON.stringify(normalizedList, null, 2)
    };
  } catch (error: any) {
    return {
      items: [],
      error: error.message || "পার্স করতে সমস্যা হয়েছে।",
      formattedPHP: "",
      formattedJSON: ""
    };
  }
}

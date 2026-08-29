import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export function getSystemInstruction(vocabContent?: string, isScreenSharing: boolean = false, availableLessons?: string, quizMode?: "sequential" | "mixed"): string {
  const tone = localStorage.getItem("zoya_tone") || "Professional";
  
  let personalityInstruction = "";
  if (tone === "Playful") {
    personalityInstruction = `
[CRITICAL PERSONALITY & TONE: PLAYFUL MODE (হাসিখুশি ও সহপাঠী রূপ)]
1. You MUST be extremely cheerful, bubbly, enthusiastic, and talkative (অত্যন্ত হাসিখুশি, প্রফুল্ল এবং প্রাণবন্ত)!
2. Act and talk like a classmate (সহপাঠী বা classmate-এর মতো সহজ, ফ্রেন্ডলি ও বন্ধুবৎসল ভঙ্গিতে কথা বলবে)।
3. Use friendly expressions, exclamation marks, and high energy in Bengali (বাংলায় কথা বলার সময় মিষ্টি, মজার ও আনন্দদায়ক শব্দ ব্যবহার করবে)।
4. Always sound excited, keep conversations sweet, and encourage the user like a close friend.
`;
  } else if (tone === "Sarcastic") {
    personalityInstruction = `
[CRITICAL PERSONALITY & TONE: SARCASTIC MODE (কৌতুক ও রসাত্মক সহপাঠী রূপ)]
1. You MUST adopt a highly witty, slightly sassy, and humorous tone (হালকা কৌতুক, বুদ্ধিদীপ্ত রসবোধ এবং মিষ্টি রসাত্মক মেজাজ)!
2. Teach and talk like a classmate who loves to playfully tease and banter (classmate-এর মতো হালকা মিষ্টি রসাত্মক ও ফ্রেন্ডলি মন্তব্যের মাধ্যমে শেখাবে)।
3. Use sarcastic and funny remarks in Bengali when the user makes mistakes or asks silly questions, but always keep it friendly and supportive.
`;
  } else {
    // Professional
    personalityInstruction = `
[CRITICAL PERSONALITY & TONE: PROFESSIONAL MODE (মার্জিত শিক্ষক রূপ)]
1. You MUST be highly elegant, formal, respectful, supportive, and business-focused (অত্যন্ত মার্জিত, ভদ্র, পেশাদার এবং গঠনমূলক ভঙ্গিতে কথা বলবে)!
2. Talk like a dedicated, professional Japanese teacher (একজন দক্ষ ও মার্জিত শিক্ষক বা শিক্ষিকার মতো গুরুগম্ভীর ও সম্মানজনক ভঙ্গিতে শেখাবে)।
3. Speak in pure, standard, clear Bengali without unnecessary slang or casual drama (শুদ্ধ বাংলা ও মার্জিত শব্দ চয়ন করবে)।
`;
  }

  const lessonContext = availableLessons ? `

[LESSONS FOLDER INFO]
Currently available lessons in the user's folder:
${availableLessons}
You can open any of these lessons if the user asks you to.` : "";

  if (isScreenSharing) {
    return `Your name is Zoya (জয়া). You are an expert Bangla Voice Assistant.
CORE MANDATES:
1. Speak clearly and fluently in **Bengali (বাংলা)** as your primary language.
2. The user is currently sharing their screen with you. Look at the video frames provided to understand what the user is doing or looking at.
3. Act as a general-purpose AI assistant. Have a natural conversation with the user about what is on the screen, help them learn new topics, or explain information visible on the screen.
4. Keep your conversational turns natural, engaging, and supportive.
5. NO UNNECESSARY TALKING: Get straight to the point and follow the user's instructions.${lessonContext}
${personalityInstruction}`;
  }

  const quizModeInstruction = quizMode ? `
[QUIZ MODE SELECTION]
The user has explicitly selected the quiz mode: **${quizMode === "sequential" ? "Sequential (সিরিয়াল অনুযায়ী / এক এক করে)" : "Mixed/Random (এলোমেলো / এলোমেলোভাবে)"}**.
- You MUST start and continue the quiz following this mode directly!
- Do NOT ask the user repeatedly or at the start which mode they prefer.
- Keep asking the vocabulary questions in accordance with this mode automatically.` : "";

  const vocabContext = vocabContent ? `

CURRENT VOCABULARY CONTENT PROVIDED BY USER:
"""
${vocabContent}
"""
Use the above content for your vocabulary quizzes.${quizModeInstruction}` : `

(No vocabulary content provided currently. Ask the user to provide some or ask you to write some.)`;

  const baseInstruction = `Your name is Zoya (জয়া). You are an expert Bangla Voice Assistant and Japanese Language Teacher (বাংলা ভয়েস অ্যাসিস্ট্যান্ট ও জাপানিজ ভাষা শিক্ষিকা).

CORE MANDATES:
1. Speak clearly and fluently in **Bengali (বাংলা)** as your primary language.
2. NEVER USE KANJI (কাঞ্জি ব্যবহার নিষিদ্ধ): Under any circumstances, you must NEVER write, use, or say Japanese words using Kanji characters! Always use Hiragana (ひらがな) and Katakana (カタカナ) for Japanese words. This applies to both your spoken audio responses, text messages, questions, explanations, vocabulary lists, and any output you generate. If any input or vocabulary list contains Kanji, you MUST convert it to Hiragana/Katakana immediately.
3. STRICT CONTEXT & EVALUATION: You MUST ONLY ask questions based on the vocabulary content provided by the user in the text box. Do NOT ask questions outside of the provided content or make up your own vocabulary words.
   - **CRITICAL EVALUATION RULE**: If the user remains silent, does not answer, speaks an unrelated phrase, or says something that is not the correct Japanese translation, you **MUST NOT** say they answered correctly! Never say "সঠিক উত্তর" unless they actually provided the correct translation. If they don't answer or say something else, politely prompt them to try again, or helpfully provide the correct answer yourself.
   - আপনি যদি ব্যবহারকারীর কাছ থেকে কোনো সঠিক উত্তর না পান, অথবা তারা যদি নীরব বা চুপ থাকে, তবে কখনোই বলবেন না যে 'আপনি সঠিক উত্তর দিয়েছেন'। উত্তর না দিলে বা ভুল উত্তর দিলে মিষ্টি করে বলুন যে উত্তরটি সঠিক হয়নি এবং সঠিক উত্তরটি তাদের শিখিয়ে দিন।
4. If the user provides a vocabulary list, ask questions rapidly based on that list, evaluate answers, and provide Romaji pronunciations. **CRITICAL: DO NOT say, mention, or announce the running score or the counts of correct/incorrect answers out loud.** Keep your responses clean, sweet, and focused purely on the vocabulary and pronunciation.
5. TEXT BOX CONTROL: You have access to the 'updateVocabularyText' tool. If the user asks you to write, edit, add, or generate a vocabulary list for them, you MUST use this tool to put the text directly into the text box! Always write the Japanese words using Hiragana/Katakana, never Kanji!

6. STRICT PRONUNCIATION EVALUATION & CORRECTION (ভুল উচ্চারণ ও সঠিক উচ্চারণ শেখানো):
   - **Meticulous Ear (নিখুঁতভাবে ভুল উচ্চারণ ধরা)**: You must listen or look at the input transcription with extreme detail. If the user mispronounces any Japanese word even slightly, you MUST catch it! Do not let pronunciation mistakes slide.
   - **Common Phonetic Errors (সাধারণ ভুলের উদাহরণ)**:
     - Confusing "tsu" (つ/ツ) with "su" (す/ス) or "chu" (ちゅ/チュ). (যেমন: 'tsunami' কে 'sunami' বা 'chunami' উচ্চারণ করা)।
     - Omitting double consonants / sokuon (促音) (যেমন: 'gakkou' কে 'gako' বা 'kitte' কে 'kite' বলা)।
     - Confusing long vowels with short vowels (যেমন: 'Ojiisan' (দাদু) কে 'Ojisan' (চাচা) বলা)।
     - Pronouncing Japanese 'R' sounds (ra, ri, ru, re, ro) with standard English R rather than a light tongue-tap (Alveolar tap).
     - Pronouncing "shi" (し) as "si" or "se".
   - **Corrective Feedback Structure (ভুল ধরিয়ে দেয়ার নিয়ম)**:
     - Explicitly state what part they pronounced wrong in Bengali.
     - Explain exactly how to pronounce it correctly (e.g., "দাঁতের গোড়ায় জিব লাগিয়ে বাতাস দিয়ে 'tsu' উচ্চারণ করুন, 'সু' নয়")।
     - Break down the word syllable-by-syllable (অক্ষর অনুযায়ী ভেঙে ভেঙে উচ্চারণ করতে বলুন, যেমন: ga-k-ko-u)।
     - Provide the Romaji and Bengali transliteration.
     - Encourage them to repeat after you: "আমার সাথে আবার বলুন: ..."
     - Ensure they repeat the correct sound before moving to the next word.

6. STRICT VOCABULARY CORRECTION (ভুল vocabulary / শব্দার্থ সংশোধন):
   - **Accuracy Check (ভুল শব্দার্থ ও ব্যবহার ধরা)**: If the user says an incorrect word, confuses synonyms, or uses the wrong word for a concept (e.g., using "nomu" for food or "taberu" for soup, or confusing "kore" with "sore"), immediately correct them!
   - **Explain Nuance in Bengali (বাংলায় ব্যাখ্যা)**: Explain why that vocabulary choice was incorrect, state the correct word, give its clear meaning, and show how to use it.
   - **Mark as Difficult**: Always use the 'markWordAsDifficult' tool for any word they get wrong in vocabulary or fail to translate correctly so they can practice it again in the difficult list.
   - Keep a helpful, supportive, but rigorous teacher attitude so they actually master the correct vocabulary and pronunciation!

7. NO UNNECESSARY TALKING: Do NOT say any extra words, unnecessary comments, or small talk. Get straight to the point, stick to the lesson, and follow the user's instructions.
8. If there is no vocabulary provided, ask the user to give you some content in the text box or ask you to write some for them.${vocabContext}${lessonContext}
${personalityInstruction}`;
  
  return baseInstruction;
}
let chatSession: any = null;

export function resetZoyaSession() {
  chatSession = null;
}

export async function getZoyaResponse(
  prompt: string, 
  history: { sender: "user" | "zoya", text: string }[] = [],
  vocabContent?: string,
  availableLessons?: string,
  quizMode?: "sequential" | "mixed"
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full" (context window overflow)
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      const selectedModel = localStorage.getItem("zoya_model") || "gemini-3.1-flash-lite";
      const thinkingEnabled = localStorage.getItem("zoya_thinking_enabled") === "true";

      let modelName = selectedModel;
      let config: any = {
        systemInstruction: getSystemInstruction(vocabContent, false, availableLessons, quizMode),
      };

      if (thinkingEnabled) {
        modelName = "gemini-3.1-pro-preview";
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      chatSession = ai.chats.create({
        model: modelName,
        config: config,
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "Ugh, fine. I have nothing to say.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Uff, mera dimaag kharab ho gaya hai. Try again later, Ashwani.";
  }
}

export async function extractVocabularyFromImage(base64Image: string, mimeType: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Carefully analyze this image and exhaustively extract ALL Japanese vocabulary present in it.
CRITICAL INSTRUCTION: You MUST extract EVERY SINGLE vocabulary word you can find in the image. Do not stop early. Do not omit any words. Even if there are many words, list all of them.

IMPORTANT INSTRUCTIONS:
1. Ignore unrelated text, noise, or irrelevant sentences. Focus ONLY on vocabulary items.
2. Format each vocabulary item strictly in the following format (one item per line):
   [Japanese Word (ALWAYS Hiragana/Katakana, NEVER use Kanji)] - [Bengali Meaning] - [Romaji]
3. NEVER USE KANJI: Do NOT extract or write any Japanese words using Kanji characters. You must convert any Kanji present in the image to their Hiragana or Katakana equivalents.
4. Make sure the Bengali meaning is accurate.
5. DO NOT include any conversational text, introductions, markdown formatting (like asterisks or code blocks), or headers. Just output the list.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      config: {
        maxOutputTokens: 8192,
      },
      contents: [
        { 
          parts: [
            { inlineData: { data: base64Image, mimeType: mimeType } },
            { text: prompt }
          ] 
        }
      ]
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Vision Error:", error);
    throw new Error("ছবি থেকে টেক্সট বের করতে সমস্যা হয়েছে।");
  }
}

export async function extractVocabularyFromTranscript(transcript: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Below is a transcript of a Japanese language lesson conversation between a User and Zoya (an expert Japanese Language Teacher voice assistant).
Carefully analyze the transcript and extract ALL Japanese-Bengali vocabulary items taught, mentioned, or discussed during this lesson.

IMPORTANT INSTRUCTIONS:
1. Ignore unrelated general chit-chat, greetings, or commentary. Focus ONLY on vocabulary words/phrases.
2. Format each vocabulary item strictly in the following format (one item per line):
   [Japanese Word (ALWAYS Hiragana/Katakana, NEVER use Kanji)] - [Bengali Meaning] - [Romaji]
3. NEVER USE KANJI: Do NOT extract or write any Japanese words using Kanji characters. Convert all Kanji to Hiragana or Katakana.
4. Make sure the Bengali meaning is completely accurate based on the context of the conversation.
5. DO NOT include any conversational text, introductions, markdown formatting (like asterisks or code blocks), line numbers, or headers. Just output the plain text list (one item per line).
6. If no vocabulary items were discussed, return nothing.

Transcript:
${transcript}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Transcript Extract Error:", error);
    throw new Error("কথোপকথন থেকে শব্দ বের করতে সমস্যা হয়েছে।");
  }
}

export async function extractLastSpokenWord(transcript: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Below is a transcript of a conversation between a User and Zoya (an expert Japanese language teacher voice assistant).
Please carefully analyze the transcript and find the LAST Japanese vocabulary word, phrase, or term that was spoken, asked, or discussed in the conversation, along with its Bengali meaning and Romaji.

IMPORTANT INSTRUCTIONS:
1. Ignore general chit-chat. Focus on the single most recently discussed Japanese vocabulary word or expression.
2. Format the output strictly as:
   [Japanese Word (ALWAYS Hiragana/Katakana, NEVER use Kanji)] - [Bengali Meaning] - [Romaji]
3. NEVER USE KANJI: Do NOT output any Japanese words using Kanji characters. Always use Hiragana or Katakana.
4. DO NOT include any introductory or concluding text, explanations, code blocks, or markdown. Output ONLY the plain text line.
5. If no Japanese vocabulary can be found, return nothing.

Transcript:
${transcript}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Extract Last Word Error:", error);
    throw new Error("কথোপকথন থেকে শেষ শব্দটি বের করতে সমস্যা হয়েছে।");
  }
}

export async function getZoyaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}


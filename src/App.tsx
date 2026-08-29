import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  Check,
  Unlock,
  Lock,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  VolumeX,
  Keyboard,
  Send,
  Trash2,
  Settings,
  Sliders,
  X,
  Sparkles,
  Smile,
  MessageSquareText,
  Monitor,
  MonitorOff,
  AlertCircle,
  Layers,
  Globe,
  BookOpen,
  Code,
  ClipboardPaste,
  Camera,
  Image as ImageIcon,
  Star,
  Play,
  RotateCcw,
  CheckCircle2,
  Award,
  Folder,
  FolderOpen,
  PlusCircle,
} from "lucide-react";
import {
  getZoyaResponse,
  getZoyaAudio,
  resetZoyaSession,
  extractVocabularyFromImage,
  extractVocabularyFromTranscript,
  extractLastSpokenWord,
} from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import Stars from "./components/Stars";
import PermissionModal from "./components/PermissionModal";
import VocabularyStudio, {
  VocabularyStudioHandle,
} from "./components/VocabularyStudio";
import {
  parseVocabularyAST,
  DEFAULT_VOCAB_EXAMPLE,
  VocabItem,
} from "./utils/astParser";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import bgImage from "./assets/images/bg.jpg";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("zoya_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("zoya_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [noiseThreshold, setNoiseThreshold] = useState<number>(() => {
    const val = localStorage.getItem("zoya_noise_threshold");
    return val ? parseFloat(val) : 0.005;
  });

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.noiseThreshold = noiseThreshold;
    }
  }, [noiseThreshold]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTone, setCurrentTone] = useState<
    "Professional" | "Sarcastic" | "Playful"
  >(() => {
    return (localStorage.getItem("zoya_tone") as any) || "Sarcastic";
  });

  const [selectedModel, setSelectedModel] = useState<
    "gemini-3.1-flash-lite" | "gemini-3.5-flash" | "gemini-3.1-pro-preview"
  >(() => {
    return (
      (localStorage.getItem("zoya_model") as any) || "gemini-3.1-flash-lite"
    );
  });

  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(() => {
    return localStorage.getItem("zoya_thinking_enabled") === "true";
  });

  const handleToneChange = useCallback(
    async (tone: "Professional" | "Sarcastic" | "Playful") => {
      setCurrentTone(tone);
      localStorage.setItem("zoya_tone", tone);
      resetZoyaSession();

      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
        setIsSessionActive(false);
        setAppState("idle");
      }
    },
    [isSessionActive],
  );

  const handleModelChange = useCallback(
    async (model: "gemini-3.1-flash-lite" | "gemini-3.5-flash" | "gemini-3.1-pro-preview") => {
      setSelectedModel(model);
      localStorage.setItem("zoya_model", model);
      resetZoyaSession();

      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
        setIsSessionActive(false);
        setAppState("idle");
      }
    },
    [isSessionActive],
  );

  const handleThinkingChange = useCallback(
    async (enabled: boolean) => {
      setThinkingEnabled(enabled);
      localStorage.setItem("zoya_thinking_enabled", enabled ? "true" : "false");
      resetZoyaSession();

      if (enabled) {
        setSelectedModel("gemini-3.1-pro-preview");
        localStorage.setItem("zoya_model", "gemini-3.1-pro-preview");
      }

      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
        setIsSessionActive(false);
        setAppState("idle");
      }
    },
    [isSessionActive],
  );

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showVocabStudio, setShowVocabStudio] = useState(false);
  const [vocabInput, setVocabInput] = useState<string>(() => {
    return localStorage.getItem("zoya_vocab_draft") || "";
  });
  const [parsedVocab, setParsedVocab] = useState<VocabItem[]>(() => {
    const draft = localStorage.getItem("zoya_vocab_draft") || "";
    return draft ? parseVocabularyAST(draft).items : [];
  });
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [prettyCode, setPrettyCode] = useState<string>(() => {
    const draft = localStorage.getItem("zoya_vocab_draft") || "";
    return draft ? parseVocabularyAST(draft).formattedPHP : "";
  });
  const [vocabQuizMode, setVocabQuizMode] = useState<"sequential" | "mixed">(
    "sequential",
  );
  const [homeTab, setHomeTab] = useState<
    "input" | "parsed" | "difficult" | "lessons"
  >("input");
  const [clipboardPermStatus, setClipboardPermStatus] = useState<
    "granted" | "prompt" | "denied"
  >("prompt");
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const vocabStudioRef = useRef<VocabularyStudioHandle>(null);

  // Lesson interface
  interface Lesson {
    id: string;
    name: string;
    vocab: VocabItem[];
    createdAt: string;
  }

  // Lessons Folder State
  const [lessons, setLessons] = useState<Lesson[]>(() => {
    const saved = localStorage.getItem("zoya_lessons");
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isEditingLessonName, setIsEditingLessonName] = useState(false);
  const [lessonNameInput, setLessonNameInput] = useState("");

  // Lesson Quiz State
  const [lessonQuizActive, setLessonQuizActive] = useState(false);
  const [lessonQuizIndex, setLessonQuizIndex] = useState(0);
  const [lessonQuizShowAnswer, setLessonQuizShowAnswer] = useState(false);
  const [lessonQuizAnswerInput, setLessonQuizAnswerInput] = useState("");
  const [lessonQuizFeedback, setLessonQuizFeedback] = useState<string | null>(
    null,
  );
  const [lessonQuizScore, setLessonQuizScore] = useState(0);
  const [lessonQuizOrder, setLessonQuizOrder] = useState<number[]>([]);

  useEffect(() => {
    localStorage.setItem("zoya_lessons", JSON.stringify(lessons));
  }, [lessons]);

  const lessonsRef = useRef(lessons);
  useEffect(() => {
    lessonsRef.current = lessons;
  }, [lessons]);

  // Difficult Vocabulary State and Practice/Quiz
  const [difficultVocab, setDifficultVocab] = useState<VocabItem[]>(() => {
    const saved = localStorage.getItem("zoya_difficult_vocab");
    return saved ? JSON.parse(saved) : [];
  });
  const [diffQuizActive, setDiffQuizActive] = useState(false);
  const [diffQuizIndex, setDiffQuizIndex] = useState(0);
  const [diffQuizShowAnswer, setDiffQuizShowAnswer] = useState(false);
  const [diffQuizAnswerInput, setDiffQuizAnswerInput] = useState("");
  const [diffQuizFeedback, setDiffQuizFeedback] = useState<string | null>(null);
  const [diffQuizScore, setDiffQuizScore] = useState(0);
  const [diffQuizOrder, setDiffQuizOrder] = useState<number[]>([]);

  useEffect(() => {
    localStorage.setItem(
      "zoya_difficult_vocab",
      JSON.stringify(difficultVocab),
    );
  }, [difficultVocab]);

  const [showSaveLessonModal, setShowSaveLessonModal] = useState(false);
  const [lessonNameInputValue, setLessonNameInputValue] = useState("");

  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const difficultVocabRef = useRef(difficultVocab);
  useEffect(() => {
    difficultVocabRef.current = difficultVocab;
  }, [difficultVocab]);

  const handleToggleDifficult = useCallback((item: VocabItem) => {
    const jp = item.hira || item.a[0] || "";
    const bn = item.q;
    if (!jp) return;

    setDifficultVocab((prev) => {
      const exists = prev.some(
        (d) =>
          (d.hira || d.a[0] || "").trim().toLowerCase() ===
          jp.trim().toLowerCase(),
      );
      if (exists) {
        return prev.filter(
          (d) =>
            (d.hira || d.a[0] || "").trim().toLowerCase() !==
            jp.trim().toLowerCase(),
        );
      } else {
        return [
          ...prev,
          {
            q: bn,
            a: item.a,
            hira: jp,
            romaji: item.romaji,
            c: item.c || 1,
          },
        ];
      }
    });
  }, []);

  const speakJapanese = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    window.speechSynthesis.speak(utterance);
  }, []);

  const startDiffQuiz = useCallback(() => {
    if (difficultVocab.length === 0) return;
    const indices = Array.from({ length: difficultVocab.length }, (_, i) => i);
    // Shuffle indices for dynamic testing
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setDiffQuizOrder(indices);
    setDiffQuizIndex(0);
    setDiffQuizScore(0);
    setDiffQuizActive(true);
    setDiffQuizShowAnswer(false);
    setDiffQuizAnswerInput("");
    setDiffQuizFeedback(null);
  }, [difficultVocab]);

  const handleDiffQuizAnswer = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!diffQuizActive || diffQuizFeedback) return;

      const currentIdx = diffQuizOrder[diffQuizIndex];
      const currentItem = difficultVocab[currentIdx];
      const correctAnswers = currentItem.a.map((ans) =>
        ans.trim().toLowerCase(),
      );
      const userAnswer = diffQuizAnswerInput.trim().toLowerCase();

      const isCorrect =
        correctAnswers.some((ans) => ans === userAnswer) ||
        (currentItem.hira &&
          currentItem.hira.trim().toLowerCase() === userAnswer) ||
        (currentItem.romaji &&
          currentItem.romaji.trim().toLowerCase() === userAnswer);

      if (isCorrect) {
        setDiffQuizScore((prev) => prev + 1);
        setDiffQuizFeedback(" সঠিক উত্তর হয়েছে! সাবাশ!");
        speakJapanese(currentItem.hira || currentItem.a[0] || "");
      } else {
        setDiffQuizFeedback(
          ` দুঃখিত, উত্তরটি সঠিক নয়। সঠিক উত্তর: ${currentItem.hira || currentItem.a[0]} (${currentItem.romaji || ""})`,
        );
        speakJapanese(currentItem.hira || currentItem.a[0] || "");
      }
    },
    [
      diffQuizActive,
      diffQuizFeedback,
      diffQuizIndex,
      diffQuizOrder,
      difficultVocab,
      diffQuizAnswerInput,
      speakJapanese,
    ],
  );

  const nextDiffQuizQuestion = useCallback(() => {
    setDiffQuizFeedback(null);
    setDiffQuizAnswerInput("");
    setDiffQuizShowAnswer(false);
    if (diffQuizIndex + 1 < diffQuizOrder.length) {
      setDiffQuizIndex((prev) => prev + 1);
    } else {
      setDiffQuizActive(false);
    }
  }, [diffQuizIndex, diffQuizOrder]);

  const startLessonQuiz = useCallback((lessonVocab: VocabItem[]) => {
    if (!lessonVocab || lessonVocab.length === 0) return;
    const indices = Array.from({ length: lessonVocab.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setLessonQuizOrder(indices);
    setLessonQuizIndex(0);
    setLessonQuizScore(0);
    setLessonQuizActive(true);
    setLessonQuizShowAnswer(false);
    setLessonQuizAnswerInput("");
    setLessonQuizFeedback(null);
  }, []);

  const handleLessonQuizAnswer = useCallback(
    (e: React.FormEvent, lessonVocab: VocabItem[]) => {
      e.preventDefault();
      if (!lessonQuizActive || lessonQuizFeedback) return;

      const currentIdx = lessonQuizOrder[lessonQuizIndex];
      const currentItem = lessonVocab[currentIdx];
      if (!currentItem) return;

      const correctAnswers = currentItem.a.map((ans) =>
        ans.trim().toLowerCase(),
      );
      const userAnswer = lessonQuizAnswerInput.trim().toLowerCase();

      const isCorrect =
        correctAnswers.some((ans) => ans === userAnswer) ||
        (currentItem.hira &&
          currentItem.hira.trim().toLowerCase() === userAnswer) ||
        (currentItem.romaji &&
          currentItem.romaji.trim().toLowerCase() === userAnswer);

      if (isCorrect) {
        setLessonQuizScore((prev) => prev + 1);
        setLessonQuizFeedback(" সঠিক উত্তর হয়েছে! সাবাশ!");
        speakJapanese(currentItem.hira || currentItem.a[0] || "");
      } else {
        setLessonQuizFeedback(
          ` দুঃখিত, উত্তরটি সঠিক নয়। সঠিক উত্তর: ${currentItem.hira || currentItem.a[0]} (${currentItem.romaji || ""})`,
        );
        speakJapanese(currentItem.hira || currentItem.a[0] || "");
      }
    },
    [
      lessonQuizActive,
      lessonQuizFeedback,
      lessonQuizIndex,
      lessonQuizOrder,
      lessonQuizAnswerInput,
      speakJapanese,
    ],
  );

  const nextLessonQuizQuestion = useCallback(() => {
    setLessonQuizFeedback(null);
    setLessonQuizAnswerInput("");
    setLessonQuizShowAnswer(false);
    if (lessonQuizIndex + 1 < lessonQuizOrder.length) {
      setLessonQuizIndex((prev) => prev + 1);
    } else {
      setLessonQuizActive(false);
    }
  }, [lessonQuizIndex, lessonQuizOrder]);

  const parsedVocabRef = useRef(parsedVocab);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    parsedVocabRef.current = parsedVocab;
  }, [parsedVocab]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const handleSaveLesson = useCallback(async (silent: boolean = false) => {
    // 1. Check if parsedVocab has items first
    const currentParsed = parsedVocabRef.current;
    if (currentParsed && currentParsed.length > 0) {
      const nextLessonNum = lessonsRef.current.length + 1;
      const newLessonId = `lesson-${Date.now()}`;
      const newLessonName = `Lesson ${nextLessonNum}: Class Set (${new Date().toLocaleDateString()})`;
      const newLesson: Lesson = {
        id: newLessonId,
        name: newLessonName,
        vocab: [...currentParsed],
        createdAt: new Date().toLocaleDateString(),
      };
      const updatedLessons = [...lessonsRef.current, newLesson];
      setLessons(updatedLessons);
      localStorage.setItem("zoya_lessons", JSON.stringify(updatedLessons));
      setSelectedLessonId(newLessonId);
      setHomeTab("lessons");

      // Clear current parsedVocab and inputs
      setParsedVocab([]);
      setVocabInput("");
      setPrettyCode("");

      const successMessage = `আমি আপনার সাজানো তালিকা থেকে ${currentParsed.length}টি শব্দ দিয়ে '${newLessonName}' তৈরি করেছি এবং তা আপনার ' লেসন ফোল্ডার'-এ সেভ করে দিয়েছি!`;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-z",
          sender: "zoya",
          text: successMessage,
        },
      ]);

      if (!silent && !isMutedRef.current) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(successMessage);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
        setAppState("idle");
      }
      return;
    }

    // 2. Otherwise fallback to chat messages history
    const history = messagesRef.current;
    const vocabRelatedMessages = history.filter(
      (m) =>
        m.text &&
        m.text.trim().length > 0 &&
        !m.text.includes(" ") &&
        !m.text.includes("বিশ্লেষণ করছি"),
    );

    if (vocabRelatedMessages.length === 0) {
      const responseText =
        "আমাদের এখনও কোনো ক্লাসের আলোচনা বা সাজানো শব্দতালিকা নেই। দয়া করে প্রথমে শব্দ দিয়ে আলোচনা করুন বা একটি ছবি বিশ্লেষণ করুন!";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-z",
          sender: "zoya",
          text: responseText,
        },
      ]);

      if (!silent && !isMutedRef.current) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
        setAppState("idle");
      }
      return;
    }

    setAppState("processing");
    const statusMsgId = Date.now().toString() + "-status";
    setMessages((prev) => [
      ...prev,
      {
        id: statusMsgId,
        sender: "zoya",
        text: "আমি আপনার কথোপকথন বিশ্লেষণ করে শব্দতালিকা বের করছি, একটু অপেক্ষা করুন... ",
      },
    ]);

    try {
      const transcript = vocabRelatedMessages
        .map((m) => `${m.sender === "user" ? "User" : "Zoya"}: ${m.text}`)
        .join("\n");

      const extractedText = await extractVocabularyFromTranscript(transcript);
      setMessages((prev) => prev.filter((m) => m.id !== statusMsgId));

      if (!extractedText || !extractedText.trim()) {
        const responseText =
          "আমি আমাদের ক্লাসের আলোচনা থেকে নতুন কোনো জাপানি শব্দ খুঁজে পাইনি। আপনি কি জাপানিজ এবং বাংলা শব্দ জোড় নিয়ে কথা বলছিলেন?";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);

        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return;
      }

      const res = parseVocabularyAST(extractedText);
      if (res.error || !res.items || res.items.length === 0) {
        const responseText =
          "দুঃখিত, কথোপকথন থেকে পাওয়া শব্দগুলো সাজাতে একটু সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        return;
      }

      const newItems = res.items;
      const currentVocab = parsedVocabRef.current;
      const uniqueNewItems = newItems.filter((newItem) => {
        return !currentVocab.some(
          (existingItem) =>
            existingItem.q.trim().toLowerCase() ===
              newItem.q.trim().toLowerCase() ||
            existingItem.a.some((ans) =>
              newItem.a.some(
                (newAns) =>
                  ans.trim().toLowerCase() === newAns.trim().toLowerCase(),
              ),
            ),
        );
      });

      if (uniqueNewItems.length === 0) {
        const responseText =
          "আমাদের ক্লাসের আলোচনার শব্দগুলো ইতিমধ্যে আপনার শব্দতালিকায় সেভ করা আছে!";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);

        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return;
      }

      const updatedList = [...currentVocab, ...uniqueNewItems];
      const formatRes = parseVocabularyAST(JSON.stringify(updatedList));
      if (!formatRes.error) {
        setParsedVocab(updatedList);
        setPrettyCode(formatRes.formattedPHP);
        setVocabInput(formatRes.formattedPHP);

        // Also save to Lessons folder as a new Lesson
        const nextLessonNum = lessonsRef.current.length + 1;
        const newLessonId = `lesson-${Date.now()}`;
        const newLessonName = `Lesson ${nextLessonNum}: Class Chat (${new Date().toLocaleDateString()})`;
        const newLesson: Lesson = {
          id: newLessonId,
          name: newLessonName,
          vocab: uniqueNewItems,
          createdAt: new Date().toLocaleDateString(),
        };
        const updatedLessons = [...lessonsRef.current, newLesson];
        setLessons(updatedLessons);
        localStorage.setItem("zoya_lessons", JSON.stringify(updatedLessons));
        setSelectedLessonId(newLessonId);
        setHomeTab("lessons");

        const successMessage = `আমি আমাদের ক্লাসের আলোচনা থেকে ${uniqueNewItems.length}টি নতুন শব্দ দিয়ে '${newLessonName}' তৈরি করেছি এবং তা আপনার ' লেসন ফোল্ডার'-এ সেভ করে দিয়েছি!`;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: successMessage,
          },
        ]);

        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(successMessage);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
      }
    } catch (err) {
      console.error("Save lesson error:", err);
      setMessages((prev) => prev.filter((m) => m.id !== statusMsgId));
      const responseText =
        "দুঃখিত, শব্দতালিকা সেভ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-z",
          sender: "zoya",
          text: responseText,
        },
      ]);
    } finally {
      setAppState("idle");
    }
  }, []);

  const handleSaveLessonRef = useRef(handleSaveLesson);
  useEffect(() => {
    handleSaveLessonRef.current = handleSaveLesson;
  }, [handleSaveLesson]);

  const handleSaveWord = useCallback(async (silent: boolean = false) => {
    const history = messagesRef.current;
    const vocabRelatedMessages = history.filter(
      (m) =>
        m.text &&
        m.text.trim().length > 0 &&
        !m.text.includes(" ") &&
        !m.text.includes("বিশ্লেষণ করছি"),
    );

    if (vocabRelatedMessages.length === 0) {
      const responseText =
        "আমাদের এখনও কোনো ক্লাসের আলোচনা হয়নি। দয়া করে প্রথমে আমার সাথে কিছু শব্দ নিয়ে কথা বলুন!";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-z",
          sender: "zoya",
          text: responseText,
        },
      ]);

      if (!silent && !isMutedRef.current) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
        setAppState("idle");
      }
      return;
    }

    setAppState("processing");
    const statusMsgId = Date.now().toString() + "-status";
    setMessages((prev) => [
      ...prev,
      {
        id: statusMsgId,
        sender: "zoya",
        text: "আমি শেষ আলোচিত শব্দটি বিশ্লেষণ করে কঠিন শব্দ তালিকায় সেভ করছি, একটু অপেক্ষা করুন... ",
      },
    ]);

    try {
      const transcript = vocabRelatedMessages
        .map((m) => `${m.sender === "user" ? "User" : "Zoya"}: ${m.text}`)
        .join("\n");

      const extractedText = await extractLastSpokenWord(transcript);
      setMessages((prev) => prev.filter((m) => m.id !== statusMsgId));

      if (!extractedText || !extractedText.trim()) {
        const responseText =
          "আমি আমাদের সাম্প্রতিক আলোচনা থেকে নতুন কোনো জাপানি শব্দ খুঁজে পাইনি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);

        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return;
      }

      const cleanLine = extractedText.replace(/[`*\[\]]/g, "").trim();
      const parts = cleanLine.split(/\s*[-–—:]\s*/);
      if (parts.length >= 2) {
        const jp = parts[0].trim();
        const bn = parts[1].trim();
        const romaji = parts[2] ? parts[2].trim() : "";

        const newItem: VocabItem = {
          q: bn,
          a: [jp],
          hira: jp,
          romaji: romaji,
          c: 1,
        };

        const currentDifficult = difficultVocabRef.current;
        const exists = currentDifficult.some(
          (item) =>
            (item.hira || item.a[0] || "").trim().toLowerCase() ===
              jp.trim().toLowerCase() ||
            item.q.trim().toLowerCase() === bn.trim().toLowerCase(),
        );

        if (exists) {
          const responseText = `"${jp}" (${bn}) শব্দটি ইতিমধ্যে আপনার কঠিন শব্দতালিকায় সেভ করা আছে!`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);

          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
          return;
        }

        const updatedList = [...currentDifficult, newItem];
        setDifficultVocab(updatedList);
        setHomeTab("difficult");

        const successMessage = `আমি "${jp}" (অর্থ: ${bn}) শব্দটিকে আপনার কঠিন শব্দতালিকায় যোগ করেছি! প্রতিদিন এগুলো চর্চা করে সহজেই মুখস্থ করতে পারবেন।`;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: successMessage,
          },
        ]);

        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(successMessage);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
      } else {
        throw new Error("Invalid format returned by Gemini");
      }
    } catch (err) {
      console.error("Save word error:", err);
      setMessages((prev) => prev.filter((m) => m.id !== statusMsgId));
      const responseText =
        "দুঃখিত, শেষ শব্দটি সেভ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-z",
          sender: "zoya",
          text: responseText,
        },
      ]);
    } finally {
      setAppState("idle");
    }
  }, []);

  const handleSaveWordRef = useRef(handleSaveWord);
  useEffect(() => {
    handleSaveWordRef.current = handleSaveWord;
  }, [handleSaveWord]);

  const toggleListeningRef = useRef<any>(null);

  // Execute Unified Voice/Text Command Action Runner
  const executeCommand = useCallback(
    async (
      action: string,
      finalTranscript: string,
      silent: boolean = false,
      value?: string,
    ) => {
      if (action === "clear_chat") {
        setMessages([]);
        resetZoyaSession();
        const responseText = "চ্যাট ইতিহাস মুছে ফেলা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "delete_all_lessons") {
        setLessons([]);
        setSelectedLessonId(null);
        setLessonQuizActive(false);
        const responseText = "আপনার সকল সেভকৃত লেসন মুছে ফেলা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "clear_difficult") {
        setDifficultVocab([]);
        setDiffQuizActive(false);
        const responseText = "কঠিন শব্দতালিকা সম্পূর্ণ মুছে ফেলা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "save_lesson") {
        await handleSaveLesson(silent);
        return true;
      }

      if (action === "save_word") {
        await handleSaveWord(silent);
        return true;
      }

      if (action === "start_lesson_quiz") {
        const activeLesson =
          lessonsRef.current.find((l) => l.id === selectedLessonId) ||
          lessonsRef.current[0];
        if (activeLesson && activeLesson.vocab.length > 0) {
          setSelectedLessonId(activeLesson.id);
          setHomeTab("lessons");
          const responseText = `আমি '${activeLesson.name}' লেসনের মৌখিক কুইজ শুরু করেছি। জয়া আপনাকে প্রশ্ন জিজ্ঞাসা করছে...`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
          setTimeout(() => {
            if (!isSessionActive) {
              toggleListeningRef.current?.(
                activeLesson.vocab,
                vocabQuizMode,
                activeLesson.name,
              );
            }
          }, 300);
        } else {
          const responseText =
            "কুইজ শুরু করার মতো কোনো সেভ করা লেসন পাওয়া যায়নি। প্রথমে একটি লেসন সেভ করুন।";
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
        }
        return true;
      }

      if (action === "start_difficult_quiz") {
        if (difficultVocabRef.current.length > 0) {
          setHomeTab("difficult");
          const responseText =
            "আমি কঠিন শব্দতালিকার মৌখিক কুইজ শুরু করেছি। জয়া আপনাকে প্রশ্ন জিজ্ঞাসা করছে...";
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
          setTimeout(() => {
            if (!isSessionActive) {
              toggleListeningRef.current?.(
                difficultVocabRef.current,
                vocabQuizMode,
                "কঠিন শব্দসমূহ",
              );
            }
          }, 300);
        } else {
          const responseText =
            "কুইজ শুরু করার মতো কোনো কঠিন শব্দ এখনও সেভ করা হয়নি।";
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
        }
        return true;
      }

      if (action === "stop_quiz") {
        if (isSessionActive) {
          toggleListeningRef.current?.();
        }
        const responseText = "কুইজ বন্ধ করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "tab_lessons") {
        setHomeTab("lessons");
        const responseText = "লেসন ফোল্ডার স্ক্রিনে নিয়ে এসেছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "tab_difficult") {
        setHomeTab("difficult");
        const responseText = "কঠিন শব্দতালিকা স্ক্রিনে নিয়ে এসেছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "tab_chat") {
        setHomeTab("chat");
        const responseText = "চ্যাট স্ক্রিনে নিয়ে এসেছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "organize_text") {
        const responseText = "ঠিক আছে, আমি তোমার টেক্সট সাজিয়ে দিচ্ছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        setShowVocabStudio(true);
        setTimeout(() => {
          if (vocabStudioRef.current) {
            vocabStudioRef.current.organize();
          }
        }, 100);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "toggle_random") {
        const responseText = "ঠিক আছে, রেন্ডম মোড পরিবর্তন করছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        setShowVocabStudio(true);
        setTimeout(() => {
          if (vocabStudioRef.current) {
            vocabStudioRef.current.toggleRandom();
          }
        }, 100);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "clear_input") {
        setVocabInput("");
        setParsedVocab([]);
        setPrettyCode("");
        const responseText = "ইনপুট বক্সটি খালি করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "load_example") {
        setVocabInput(DEFAULT_VOCAB_EXAMPLE);
        handleParseHomeVocab(DEFAULT_VOCAB_EXAMPLE);
        const responseText =
          "ডিফল্ট জাপানিজ উদাহরণ লোড করা হয়েছে এবং পার্স করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "parse_input") {
        handleParseHomeVocab();
        const responseText =
          "আপনার ইনপুট পার্স করে সাজানো তালিকা তৈরি করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "mute_voice") {
        setIsMuted(true);
        const responseText = "জয়াকে মিউট করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        return true;
      }

      if (action === "unmute_voice") {
        setIsMuted(false);
        const responseText = "জয়াকে আনমিউট করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "open_vocab_studio") {
        setShowVocabStudio(true);
        const responseText = "শব্দকোষ স্টুডিও ওপেন করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "close_vocab_studio") {
        setShowVocabStudio(false);
        const responseText = "শব্দকোষ স্টুডিও বন্ধ করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "open_settings") {
        setShowSettings(true);
        const responseText = "সেটিংস প্যানেল খোলা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "close_settings") {
        setShowSettings(false);
        const responseText = "সেটিংস প্যানেল বন্ধ করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "tab_input") {
        setHomeTab("input");
        const responseText = "ইনপুট বক্স স্ক্রিন দেখাচ্ছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "tab_parsed") {
        setHomeTab("parsed");
        const responseText = "সাজানো শব্দতালিকা দেখাচ্ছি।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "show_quiz_answer") {
        setLessonQuizShowAnswer(true);
        setDiffQuizShowAnswer(true);
        const responseText = "চলতি কুইজের সঠিক উত্তর দেখানো হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "hide_quiz_answer") {
        setLessonQuizShowAnswer(false);
        setDiffQuizShowAnswer(false);
        const responseText = "কুইজের উত্তর লুকানো হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "next_quiz_question") {
        if (lessonQuizActive) {
          nextLessonQuizQuestion();
        } else if (diffQuizActive) {
          nextDiffQuizQuestion();
        }
        const responseText = "পরবর্তী প্রশ্ন লোড করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        if (!silent && !isMutedRef.current) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
          setAppState("idle");
        }
        return true;
      }

      if (action === "stop_session") {
        if (isSessionActive) {
          setIsSessionActive(false);
          if (liveSessionRef.current) {
            liveSessionRef.current.stop();
            liveSessionRef.current = null;
          }
          setAppState("idle");
          resetZoyaSession();
        }
        const responseText = "লাইভ সেশন বন্ধ করা হয়েছে।";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        return true;
      }

      if (action === "start_session") {
        if (!isSessionActive) {
          setTimeout(() => {
            toggleListeningRef.current?.();
          }, 100);
        }
        const responseText = "লাইভ সেশন চালু করা হচ্ছে...";
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);
        return true;
      }

      if (action === "select_lesson" && value) {
        let matchedLesson = null;
        const indexNum = parseInt(value, 10);
        if (!isNaN(indexNum)) {
          const targetIdx = indexNum - 1;
          if (targetIdx >= 0 && targetIdx < lessonsRef.current.length) {
            matchedLesson = lessonsRef.current[targetIdx];
          }
        }
        if (!matchedLesson) {
          const valLower = value.toLowerCase();
          matchedLesson = lessonsRef.current.find((l) =>
            l.name.toLowerCase().includes(valLower),
          );
        }

        if (matchedLesson) {
          setSelectedLessonId(matchedLesson.id);
          setHomeTab("lessons");
          const responseText = `'${matchedLesson.name}' লেসনটি সিলেক্ট করা হয়েছে এবং মৌখিক লাইভ প্র্যাকটিস শুরু করা হচ্ছে।`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }

          // Immediately start voice practice for this lesson
          const vocabToPractice = matchedLesson.vocab;
          const lessonName = matchedLesson.name;
          setTimeout(() => {
            if (!isSessionActive) {
              toggleListeningRef.current?.(
                vocabToPractice,
                vocabQuizMode,
                lessonName,
              );
            }
          }, 300);
        } else {
          const responseText = `দুঃখিত, '${value}' নামে কোনো লেসন খুঁজে পাওয়া যায়নি।`;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + "-z",
              sender: "zoya",
              text: responseText,
            },
          ]);
          if (!silent && !isMutedRef.current) {
            setAppState("speaking");
            const audioBase64 = await getZoyaAudio(responseText);
            if (audioBase64) {
              await playPCM(audioBase64);
            }
            setAppState("idle");
          }
        }
        return true;
      }

      if (action === "submit_quiz_answer" && value) {
        if (lessonQuizActive) {
          setLessonQuizAnswerInput(value);
          const currentLesson = lessonsRef.current.find(
            (l) => l.id === selectedLessonId,
          );
          if (currentLesson) {
            const currentIdx = lessonQuizOrder[lessonQuizIndex];
            const currentItem = currentLesson.vocab[currentIdx];
            if (currentItem) {
              const correctAnswers = currentItem.a.map((ans) =>
                ans.trim().toLowerCase(),
              );
              const userAnswer = value.trim().toLowerCase();
              const isCorrect =
                correctAnswers.some((ans) => ans === userAnswer) ||
                (currentItem.hira &&
                  currentItem.hira.trim().toLowerCase() === userAnswer) ||
                (currentItem.romaji &&
                  currentItem.romaji.trim().toLowerCase() === userAnswer);

              if (isCorrect) {
                setLessonQuizScore((prev) => prev + 1);
                setLessonQuizFeedback(" সঠিক উত্তর হয়েছে! সাবাশ!");
                speakJapanese(currentItem.hira || currentItem.a[0] || "");
              } else {
                setLessonQuizFeedback(
                  ` দুঃখিত, উত্তরটি সঠিক নয়। সঠিক উত্তর: ${currentItem.hira || currentItem.a[0]} (${currentItem.romaji || ""})`,
                );
                speakJapanese(currentItem.hira || currentItem.a[0] || "");
              }
            }
          }
        } else if (diffQuizActive) {
          setDiffQuizAnswerInput(value);
          const currentIdx = diffQuizOrder[diffQuizIndex];
          const currentItem = difficultVocabRef.current[currentIdx];
          if (currentItem) {
            const correctAnswers = currentItem.a.map((ans) =>
              ans.trim().toLowerCase(),
            );
            const userAnswer = value.trim().toLowerCase();
            const isCorrect =
              correctAnswers.some((ans) => ans === userAnswer) ||
              (currentItem.hira &&
                currentItem.hira.trim().toLowerCase() === userAnswer) ||
              (currentItem.romaji &&
                currentItem.romaji.trim().toLowerCase() === userAnswer);

            if (isCorrect) {
              setDiffQuizScore((prev) => prev + 1);
              setDiffQuizFeedback(" সঠিক উত্তর হয়েছে! সাবাশ!");
              speakJapanese(currentItem.hira || currentItem.a[0] || "");
            } else {
              setDiffQuizFeedback(
                ` দুঃখিত, উত্তরটি সঠিক নয়। সঠিক উত্তর: ${currentItem.hira || currentItem.a[0]} (${currentItem.romaji || ""})`,
              );
              speakJapanese(currentItem.hira || currentItem.a[0] || "");
            }
          }
        }
        return true;
      }

      return false;
    },
    [
      startLessonQuiz,
      startDiffQuiz,
      selectedLessonId,
      lessonQuizActive,
      lessonQuizIndex,
      lessonQuizOrder,
      diffQuizActive,
      diffQuizIndex,
      diffQuizOrder,
      nextLessonQuizQuestion,
      nextDiffQuizQuestion,
      isSessionActive,
      speakJapanese,
      handleSaveLesson,
      handleSaveWord,
    ],
  );

  useEffect(() => {
    localStorage.setItem("zoya_vocab_draft", vocabInput);
  }, [vocabInput]);

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "clipboard-read" as PermissionName })
        .then((status) => {
          setClipboardPermStatus(status.state as any);
          status.onchange = () => {
            setClipboardPermStatus(status.state as any);
          };
        })
        .catch(() => {});
    }
  }, []);

  const handleParseHomeVocab = useCallback(
    (textToParse?: string) => {
      const text = textToParse !== undefined ? textToParse : vocabInput;
      const res = parseVocabularyAST(text);
      if (res.error) {
        setVocabError(res.error);
      } else {
        setVocabError(null);
        setParsedVocab(res.items);
        setPrettyCode(res.formattedPHP);
        if (textToParse !== undefined) {
          setVocabInput(res.formattedPHP);
        }
        setHomeTab("parsed");
      }
    },
    [vocabInput],
  );

  const handleRequestClipboardPerm = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardPermStatus("granted");
      if (text && text.trim()) {
        setVocabInput(text);
        handleParseHomeVocab(text);
        setVocabError(
          " ক্লিপবোর্ড পারমিশন সফল হয়েছে এবং লেখা পেস্ট করা হয়েছে!",
        );
      } else {
        setVocabError(
          " ক্লিপবোর্ড পারমিশন সফলভাবে দেওয়া হয়েছে! কিন্তু ক্লিপবোর্ডে কোনো লেখা নেই, প্রথমে কিছু কপি করুন।",
        );
      }
    } catch (err) {
      setClipboardPermStatus("denied");
      setVocabError(
        " ব্রাউজার ক্লিপবোর্ড পারমিশন ব্লক বা ডিনাই করেছে। উপরের URL বারে বা আইকনে ক্লিক করে 'Clipboard' -> 'Allow' করুন অথবা সরাসরি বক্সে ক্লিক করে Ctrl+V চাপুন।",
      );
    }
  }, [handleParseHomeVocab]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClipboardPermStatus("granted");
      if (text && text.trim()) {
        setVocabInput(text);
        handleParseHomeVocab(text);
        setVocabError(null);
      } else {
        setVocabError(
          "ক্লিপবোর্ডে কোনো লেখা পাওয়া যায়নি। প্রথমে কিছু কপি করুন।",
        );
      }
    } catch (err) {
      setClipboardPermStatus("denied");
      setVocabError(
        " ব্রাউজার ক্লিপবোর্ড পারমিশন দেয়নি। দয়া করে ' পারমিশন দিন' বাটনে ক্লিক করুন অথবা সরাসরি বক্সে ক্লিক করে Ctrl+V চাপুন।",
      );
    }
  }, [handleParseHomeVocab]);

  const handleDeleteVocabItem = useCallback((idxToDelete: number) => {
    setParsedVocab((prev) => {
      const updated = prev.filter((_, idx) => idx !== idxToDelete);
      const res = parseVocabularyAST(JSON.stringify(updated));
      if (!res.error) {
        setPrettyCode(res.formattedPHP);
        setVocabInput(res.formattedPHP);
      }
      return updated;
    });
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    setVocabError("ছবি থেকে শব্দতালিকা পড়া হচ্ছে...");
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        try {
          const extractedText = await extractVocabularyFromImage(
            base64Data,
            file.type,
          );
          if (extractedText) {
            setVocabInput(extractedText);
            handleParseHomeVocab(extractedText);
            setVocabError(" ছবি থেকে শব্দতালিকা সফলভাবে পাওয়া গেছে!");

            // Auto-start session
            if (!isSessionActive) {
              setTimeout(() => {
                toggleListening();
              }, 1000);
            }
          } else {
            setVocabError(" ছবি থেকে কোনো লেখা পাওয়া যায়নি।");
          }
        } catch (err) {
          setVocabError(" ছবি প্রসেস করতে সমস্যা হয়েছে।");
        } finally {
          setIsAnalyzingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setVocabError(" ফাইল পড়তে সমস্যা হয়েছে।");
      setIsAnalyzingImage(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(
    async (finalTranscript: string) => {
      if (!finalTranscript.trim()) {
        setAppState("idle");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), sender: "user", text: finalTranscript },
      ]);

      // If live session is active, send text through it
      if (isSessionActive && liveSessionRef.current) {
        liveSessionRef.current.sendText(finalTranscript);
        return;
      }

      setAppState("processing");

      // 1. Check for browser commands
      const commandResult = processCommand(finalTranscript);

      let responseText = "";

      if (commandResult.isBrowserAction) {
        responseText = commandResult.action;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);

        if (!isMuted) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        }

        setAppState("idle");

        setTimeout(() => {
          if (commandResult.url) {
            window.open(commandResult.url, "_blank");
          }
        }, 1500);
      } else if (
        commandResult.action &&
        commandResult.action !== "organize_text" &&
        commandResult.action !== "toggle_random"
      ) {
        const handled = await executeCommand(
          commandResult.action,
          finalTranscript,
          false,
          commandResult.value,
        );
        if (handled) {
          setAppState("idle");
          return;
        }
      } else if (commandResult.action === "organize_text") {
        // Compute available lessons with full vocabulary info so AI is aware of all stored files/lessons
        const availableLessonsInfo = lessonsRef.current.length > 0 
            ? lessonsRef.current.map(l => {
                const wordsList = l.vocab.map(v => `  * ${v.q} - ${v.a.join(', ')} (${v.romaji || ''})`).join("\n");
                return `- Lesson: ${l.name}\n${wordsList}`;
              }).join("\n\n")
            : "No lessons saved yet.";

        // 2. General Chit-Chat via Gemini
        responseText = await getZoyaResponse(
          finalTranscript,
          messagesRef.current,
          vocabInput,
          availableLessonsInfo
        );
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "-z",
            sender: "zoya",
            text: responseText,
          },
        ]);

        if (!isMuted) {
          setAppState("speaking");
          const audioBase64 = await getZoyaAudio(responseText);
          if (audioBase64) {
            await playPCM(audioBase64);
          }
        }
        setAppState("idle");
      }
    },
    [isMuted, isSessionActive],
  );

  const toggleListening = async (
    customVocabList?: VocabItem[],
    customQuizMode?: "sequential" | "mixed",
    lessonName?: string,
  ) => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetZoyaSession();

        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        session.noiseThreshold = noiseThreshold;
        liveSessionRef.current = session;

        session.onStateChange = (state) => {
          setAppState(state);
        };

        session.onMessage = (sender, text) => {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString() + "-" + sender, sender, text },
          ]);
          if (sender === "user") {
            const commandResult = processCommand(text);
            if (commandResult.action) {
              setTimeout(async () => {
                await executeCommand(
                  commandResult.action,
                  text,
                  false,
                  commandResult.value,
                );
              }, 100);
            }
          }
        };

        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        session.onUpdateVocabText = (newText) => {
          setVocabInput(newText);
          handleParseHomeVocab(newText);
        };

        // Determine active vocab list and details for the quiz
        let activeVocab = customVocabList;
        if (!activeVocab) {
          if (homeTab === "lessons" && selectedLessonId) {
            const currentLesson = lessonsRef.current.find(
              (l) => l.id === selectedLessonId,
            );
            if (currentLesson) {
              activeVocab = currentLesson.vocab;
            }
          } else if (homeTab === "difficult") {
            activeVocab = difficultVocabRef.current;
          } else if (homeTab === "parsed" && parsedVocab.length > 0) {
            activeVocab = parsedVocab;
          }
        }

        session.onMarkDifficult = (index) => {
          if (activeVocab && index > 0 && index <= activeVocab.length) {
            const item = activeVocab[index - 1];
            setDifficultVocab((prev) => {
              const jpWord = item.hira || item.a[0] || "";
              const exists = prev.some(
                (d) =>
                  (d.hira || d.a[0] || "").trim().toLowerCase() ===
                  jpWord.trim().toLowerCase(),
              );
              if (!exists) {
                return [...prev, item];
              }
              return prev;
            });
          }
        };

        session.onSetQuizMode = (mode) => {
          setVocabQuizMode(mode);
        };

        session.onNavigateUI = (tab) => {
          setHomeTab(tab);
        };

        session.onStartQuiz = (source, quizLessonName) => {
          if (source === 'lesson') {
             if (quizLessonName) {
               const lesson = lessonsRef.current.find(l => l.name.toLowerCase() === quizLessonName.toLowerCase());
               if (lesson) {
                 setSelectedLessonId(lesson.id);
                 setHomeTab("lessons");
                 executeCommand("start_lesson_quiz", "", true);
                 return;
               }
             }
             setHomeTab("lessons");
             executeCommand("start_lesson_quiz", "", true);
          } else if (source === 'difficult') {
             setHomeTab("difficult");
             executeCommand("start_difficult_quiz", "", true);
          } else if (source === 'parsed') {
             setHomeTab("parsed");
          }
        };

        session.onOpenLesson = (quizLessonName) => {
           if (quizLessonName) {
             const lesson = lessonsRef.current.find(l => l.name.toLowerCase() === quizLessonName.toLowerCase());
             if (lesson) {
               setSelectedLessonId(lesson.id);
               setHomeTab("lessons");
             }
           }
        };


        const mode = customQuizMode || vocabQuizMode;
        const name =
          lessonName ||
          (homeTab === "lessons"
            ? lessonsRef.current.find((l) => l.id === selectedLessonId)?.name
            : "");

        const previousMessages = messagesRef.current.slice(-8);
        const previousContextText =
          previousMessages.length > 0
            ? previousMessages.map((m) => `${m.sender}: ${m.text}`).join("\n")
            : undefined;

        const availableLessonsInfo = lessonsRef.current.length > 0 
            ? lessonsRef.current.map(l => {
                const wordsList = l.vocab.map(v => `  * ${v.q} - ${v.a.join(', ')} (${v.romaji || ''})`).join("\n");
                return `- Lesson: ${l.name}\n${wordsList}`;
              }).join("\n\n")
            : "No lessons saved yet.";

        await session.start(vocabInput, false, previousContextText, availableLessonsInfo, mode);

        if (activeVocab && activeVocab.length > 0) {
          const lessonPrefix = name ? `'${name}' লেসন থেকে ` : "";
          const vocabPrompt =
            `আমি একটি শব্দতালিকা পাঠাচ্ছি। তুমি আমার জাপানিজ ও বাংলা ভাষার শিক্ষক (Bangla Voice Assistant & Japanese Teacher)। 

তোমার কাজ:
১. ব্যবহারকারী ইতিমধ্যেই প্র্যাকটিস করার মোড হিসেবে **${mode === "sequential" ? "সিরিয়াল অনুযায়ী (Sequential)" : "এলোমেলো (Mixed/Random)"}** সিলেক্ট করেছেন। তাকে পুনরায় জিজ্ঞেস করার কোনো দরকার নেই যে কোন মোড দিয়ে তিনি শুরু করতে চান। তাকে বাংলায় উষ্ণ স্বাগত জানাও এবং সরাসরি প্রথম শব্দটির জাপানিজ অনুবাদ বাংলায় জিজ্ঞাসা করে প্র্যাকটিস শুরু করো!
২. তুমি সাথে সাথে 'setQuizMode' টুলটি কল করে মোডটি সেট করে দিবে (যদি না ইতিমধ্যে সেট থাকে)।
৩. আমার উত্তর সঠিক হলে বা আমি কোনো উত্তর দেওয়ার সাথে সাথে আমাকে উৎসাহ দিয়ে পরবর্তী প্রশ্নে চলে যাও। কোনো অপ্রয়োজনীয় দীর্ঘ আলোচনা করবে না, সরাসরি পরের শব্দে চলে যাবে।
৪. উত্তর ভুল হলে বা আমি জিজ্ঞাসা করলে আমাকে রোমাজি (Roomaji) সহ সঠিক উচ্চারণ ও অর্থ বুঝিয়ে দাও এবং সাথে সাথে markWordAsDifficult টুলটি কল করে ওই শব্দটি (যার index তুমি জানো) কঠিন তালিকায় যুক্ত করে দাও।
৫. আমার কয়টি ভুল ও কয়টি সঠিক উত্তর হলো, তার হিসেব (Count) রাখবে এবং জিজ্ঞেস করলে বা কুইজের শেষে জানাবে।
৬. কুইজ শেষ হলে আমাকে জানাবে যে আমরা কঠিন শব্দগুলো এখন প্র্যাকটিস করতে পারি।

শব্দতালিকা:
` +
            activeVocab
              .map(
                (v, idx) =>
                  `${idx + 1}. বাংলা: ${v.q} | জাপানিজ: ${v.a.join(", ")} ${v.hira ? `(${v.hira})` : ""} | রোমাজি: ${v.romaji || ""}`,
              )
              .join("\n");

          setTimeout(() => {
            session.sendText(vocabPrompt);
          }, 600);
        }
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  useEffect(() => {
    toggleListeningRef.current = toggleListening;
  }, [toggleListening]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  const handleSendVocabToAI = useCallback(
    (prompt: string, vocabList: VocabItem[], quizMode: "sequential" | "mixed") => {
      setParsedVocab(vocabList);
      setHomeTab("parsed");
      setVocabInput(prompt);
      localStorage.setItem("zoya_vocab_draft", prompt);
      setShowVocabStudio(false);
      
      if (isSessionActive) {
        setIsSessionActive(false);
        if (liveSessionRef.current) {
          liveSessionRef.current.stop();
          liveSessionRef.current = null;
        }
        setAppState("idle");
        resetZoyaSession();
        
        setTimeout(() => {
          toggleListening(vocabList, quizMode, "Vocabulary Studio List");
        }, 800);
      } else {
        toggleListening(vocabList, quizMode, "Vocabulary Studio List");
      }
    },
    [isSessionActive, toggleListening],
  );

  return (
    <div 
      className="h-[100dvh] w-screen text-slate-800 flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0"
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] pointer-events-none"></div>

      {showPermissionModal && (
        <PermissionModal onClose={() => setShowPermissionModal(false)} />
      )}

      {/* Cinematic Background Gradients - Adjusted for Galaxy Theme */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <Stars />
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-pink-300/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-300/30 blur-[120px] rounded-full" />
        <div className="absolute top-[30%] right-[-10%] w-[30%] h-[40%] bg-purple-300/30 blur-[100px] rounded-full" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-blue-500 flex items-center justify-center font-extrabold text-base text-white shadow-[0_8px_24px_rgba(244,63,94,0.2)]">
            Z
          </div>
          <h1 className="text-2xl font-sans font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Zoya
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => {
                setConfirmModalConfig({
                  isOpen: true,
                  title: "চ্যাট মুছুন",
                  message: "আপনি কি আসলেই আপনার চ্যাট ইতিহাস মুছে ফেলতে চান?",
                  onConfirm: () => {
                    setMessages([]);
                    resetZoyaSession();
                  },
                });
              }}
              className="p-2.5 rounded-full bg-white/60 hover:bg-rose-100 hover:text-rose-600 text-slate-700 transition-all border border-white/50 shadow-sm backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
              title="Clear Chat History"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-full bg-white/60 hover:bg-white/80 text-slate-700 transition-all border border-white/50 shadow-sm backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 rounded-full bg-white/60 hover:bg-white/80 text-slate-700 transition-all border border-white/50 shadow-sm backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Settings Drawer */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sidebar drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#161b22]/95 border-l border-white/10 p-6 z-50 backdrop-blur-xl shadow-2xl flex flex-col justify-between"
            >
              <div className="overflow-y-auto scrollbar-hide flex-1">
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-red-500 to-teal-500 rounded-2xl shadow-[0_4px_12px_rgba(139,92,246,0.25)]">
                      <Settings size={20} className="text-white" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-xl font-sans font-extrabold tracking-tight text-white">
                        Console Settings
                      </h2>
                      <p className="text-xs text-white/60 font-semibold">
                        Fine-tune Zoya's personality & traits
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10 text-white cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Tone / Sass Level Configuration */}
                <div className="space-y-4">
                  <h3 className="text-sm font-mono tracking-wider text-amber-400 uppercase text-left">
                    Personality Mode
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed text-left">
                    Select how sassy or professional Zoya behaves. Adjusting
                    this mode will adapt her voice responses and reset active
                    chat flows instantly.
                  </p>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {/* Sarcastic Mode */}
                    <button
                      onClick={() => handleToneChange("Sarcastic")}
                      className={`text-left p-5 rounded-[2rem] border transition-all duration-350 relative overflow-hidden cursor-pointer ${
                        currentTone === "Sarcastic"
                          ? "bg-teal-500/15 border-teal-500/55 shadow-[0_8px_25px_rgba(139,92,246,0.25)]"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles
                            size={18}
                            className={
                              currentTone === "Sarcastic"
                                ? "text-teal-400"
                                : "text-white/40"
                            }
                          />
                          <span className="font-sans font-extrabold text-white text-lg">
                            Sarcastic (Classic)
                          </span>
                        </div>
                        {currentTone === "Sarcastic" && (
                          <span className="text-[10px] bg-teal-500 text-white font-mono px-2.5 py-1 rounded-xl uppercase tracking-wider font-extrabold shadow">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/70 mt-2.5 leading-relaxed font-medium">
                        Her original self. Highly witty roasts, sassy Hinglish
                        attitude, eye-rolls, and humorous drama.
                      </p>
                    </button>

                    {/* Playful Mode */}
                    <button
                      onClick={() => handleToneChange("Playful")}
                      className={`text-left p-5 rounded-[2rem] border transition-all duration-350 relative overflow-hidden cursor-pointer ${
                        currentTone === "Playful"
                          ? "bg-amber-500/15 border-amber-500/55 shadow-[0_8px_25px_rgba(236,72,153,0.25)]"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Smile
                            size={18}
                            className={
                              currentTone === "Playful"
                                ? "text-amber-400 animate-bounce"
                                : "text-white/40"
                            }
                          />
                          <span className="font-sans font-extrabold text-white text-lg">
                            Playful
                          </span>
                        </div>
                        {currentTone === "Playful" && (
                          <span className="text-[10px] bg-amber-500 text-white font-mono px-2.5 py-1 rounded-xl uppercase tracking-wider font-extrabold shadow">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/70 mt-2.5 leading-relaxed font-medium">
                        Cheerful, friendly, positive energy. Loves making
                        lighthearted jokes and keeping conversations sweet and
                        fun.
                      </p>
                    </button>

                    {/* Professional Mode */}
                    <button
                      onClick={() => handleToneChange("Professional")}
                      className={`text-left p-5 rounded-[2rem] border transition-all duration-350 relative overflow-hidden cursor-pointer ${
                        currentTone === "Professional"
                          ? "bg-blue-500/15 border-blue-500/55 shadow-[0_8px_25px_rgba(6,182,212,0.25)]"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquareText
                            size={18}
                            className={
                              currentTone === "Professional"
                                ? "text-blue-400"
                                : "text-white/40"
                            }
                          />
                          <span className="font-sans font-extrabold text-white text-lg">
                            Professional
                          </span>
                        </div>
                        {currentTone === "Professional" && (
                          <span className="text-[10px] bg-blue-500 text-white font-mono px-2.5 py-1 rounded-xl uppercase tracking-wider font-extrabold shadow">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/70 mt-2.5 leading-relaxed font-medium">
                        Supportive, polite, elegant, and business-focused.
                        Direct answers without the witty dramatic roasts.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Gemini Intelligence Section */}
                <div className="space-y-4 mt-8">
                  <h3 className="text-sm font-mono tracking-wider text-amber-400 uppercase text-left flex items-center gap-2">
                    <Layers size={14} className="text-amber-400" />
                    <span>Gemini Intelligence</span>
                  </h3>
                  <p className="text-xs text-white/50 leading-relaxed text-left">
                    Choose the AI brain model that Zoya runs on. Higher-tier models deliver deeper reasoning but consume more memory resources.
                  </p>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {/* Fast Tasks */}
                    <button
                      onClick={() => handleModelChange("gemini-3.1-flash-lite")}
                      disabled={thinkingEnabled}
                      className={`text-left p-4 rounded-[1.5rem] border transition-all duration-350 relative overflow-hidden ${
                        thinkingEnabled ? "opacity-40 cursor-not-allowed bg-white/2 border-white/2" : "cursor-pointer"
                      } ${
                        selectedModel === "gemini-3.1-flash-lite" && !thinkingEnabled
                          ? "bg-teal-500/15 border-teal-500/55 shadow-[0_8px_25px_rgba(16,185,129,0.2)] text-white"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/90"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-extrabold text-white text-base">
                            Gemini Flash Lite
                          </span>
                        </div>
                        {selectedModel === "gemini-3.1-flash-lite" && !thinkingEnabled && (
                          <span className="text-[9px] bg-teal-500 text-white font-mono px-2 py-0.5 rounded-lg uppercase font-extrabold">
                            Fastest
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed font-medium">
                        Optimized for ultra-fast, snappy speech & instant replies.
                      </p>
                    </button>

                    {/* General Tasks */}
                    <button
                      onClick={() => handleModelChange("gemini-3.5-flash")}
                      disabled={thinkingEnabled}
                      className={`text-left p-4 rounded-[1.5rem] border transition-all duration-350 relative overflow-hidden ${
                        thinkingEnabled ? "opacity-40 cursor-not-allowed bg-white/2 border-white/2" : "cursor-pointer"
                      } ${
                        selectedModel === "gemini-3.5-flash" && !thinkingEnabled
                          ? "bg-blue-500/15 border-blue-500/55 shadow-[0_8px_25px_rgba(6,182,212,0.2)] text-white"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/90"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-extrabold text-white text-base">
                            Gemini 3.5 Flash
                          </span>
                        </div>
                        {selectedModel === "gemini-3.5-flash" && !thinkingEnabled && (
                          <span className="text-[9px] bg-blue-500 text-white font-mono px-2 py-0.5 rounded-lg uppercase font-extrabold">
                            Balanced
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed font-medium">
                        Excellent for standard chats, translations, and learning feedback.
                      </p>
                    </button>

                    {/* Complex Tasks */}
                    <button
                      onClick={() => handleModelChange("gemini-3.1-pro-preview")}
                      disabled={thinkingEnabled}
                      className={`text-left p-4 rounded-[1.5rem] border transition-all duration-350 relative overflow-hidden ${
                        thinkingEnabled ? "opacity-40 cursor-not-allowed bg-white/2 border-white/2" : "cursor-pointer"
                      } ${
                        selectedModel === "gemini-3.1-pro-preview" || thinkingEnabled
                          ? "bg-red-500/15 border-red-500/55 shadow-[0_8px_25px_rgba(217,70,239,0.2)] text-white"
                          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/90"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-sans font-extrabold text-white text-base">
                            Gemini 3.1 Pro
                          </span>
                        </div>
                        {(selectedModel === "gemini-3.1-pro-preview" || thinkingEnabled) && (
                          <span className="text-[9px] bg-red-500 text-white font-mono px-2 py-0.5 rounded-lg uppercase font-extrabold">
                            Advanced
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed font-medium">
                        Unmatched logical thinking for complex queries, idioms, & code analysis.
                      </p>
                    </button>
                  </div>
                </div>

                {/* High Thinking Mode Section */}
                <div className="space-y-4 mt-8 p-5 rounded-[2rem] bg-teal-500/5 border border-teal-500/20 backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-teal-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-teal-500/20 rounded-xl text-teal-400">
                        <Award size={18} />
                      </div>
                      <div className="text-left">
                        <h4 className="text-sm font-sans font-extrabold text-white">
                          High Thinking Mode
                        </h4>
                        <p className="text-[10px] text-teal-300 font-mono uppercase tracking-wider font-bold">
                          ThinkingLevel.HIGH
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleThinkingChange(!thinkingEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        thinkingEnabled ? "bg-teal-500" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          thinkingEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-[11px] text-white/65 leading-relaxed text-left">
                    Force-enables deeper, systemized rationalizing. Automatically overrides brain model to <strong>Gemini 3.1 Pro</strong> for your most challenging language, vocabulary, and grammar queries.
                  </p>
                </div>

                {/* Voice Sensitivity & Noise Control (Glassmorphic Slider) */}
                <div className="space-y-4 mt-8 p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-md relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_12px_24px_-10px_rgba(0,0,0,0.3)]">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>
                  
                  <h3 className="text-sm font-mono tracking-wider text-teal-400 uppercase text-left flex items-center gap-2">
                    <Sliders size={14} className="text-teal-400" />
                    <span>Voice Recognition & Noise Gate</span>
                  </h3>
                  
                  <p className="text-xs text-white/50 leading-relaxed text-left">
                    Adjust how sensitive Zoya is to your voice. Higher threshold filters background noises, fan humming, and echoes, while a lower threshold catches even soft whispers.
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-white/80">
                      <span>Threshold Sensitivity</span>
                      <span className="font-mono text-teal-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        {noiseThreshold === 0 ? "Off (Ultra Sensitive)" : `${(noiseThreshold * 1000).toFixed(1)} mU`}
                      </span>
                    </div>

                    <div className="relative flex items-center gap-3">
                      <MicOff size={14} className="text-white/40" />
                      <input
                        type="range"
                        min="0"
                        max="0.04"
                        step="0.001"
                        value={noiseThreshold}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setNoiseThreshold(val);
                          localStorage.setItem("zoya_noise_threshold", val.toString());
                        }}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
                      />
                      <Mic size={14} className="text-teal-400" />
                    </div>

                    <div className="flex justify-between text-[10px] text-white/40 font-medium px-1">
                      <span>Whisper Mode</span>
                      <span>Normal</span>
                      <span>Noisy Room</span>
                    </div>
                  </div>
                </div>

                {isSessionActive && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-300 text-center leading-relaxed">
                    Note: Changing tone will close the current voice channel so
                    Zoya can restart with her new traits.
                  </div>
                )}
              </div>

              {/* Quick Actions Footer */}
              <div className="border-t border-white/10 pt-4 mt-6 space-y-3">
                <div className="flex justify-between items-center text-xs text-white/40 py-1">
                  <span>Engine Model:</span>
                  <span className="font-mono text-[10px] text-amber-400 bg-white/5 px-2 py-1 rounded">
                    {isSessionActive
                      ? "3.1-flash-live-preview"
                      : thinkingEnabled
                      ? "gemini-3.1-pro-preview (Thinking)"
                      : selectedModel}
                  </span>
                </div>

                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setConfirmModalConfig({
                        isOpen: true,
                        title: "চ্যাট রিসেট",
                        message:
                          "আপনি কি আসলেই আপনার চ্যাট ইতিহাস মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।",
                        onConfirm: () => {
                          setMessages([]);
                          resetZoyaSession();
                          setShowSettings(false);
                        },
                      });
                    }}
                    className="w-full py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 transition-colors duration-200 rounded-xl flex items-center justify-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    <Trash2 size={16} />
                    <span>Clear Conversation History</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content - Organized 2-Column Home Screen Dashboard */}
      <main className="relative z-10 w-full flex-1 flex flex-col gap-6 overflow-y-auto px-4 md:px-8 py-6 pt-20 pb-12">
        {/* Date & System Status Bar on Home Screen */}
        <div className="w-full flex flex-wrap items-center justify-between gap-4 bg-white/45 border border-white/60 px-6 py-4 rounded-[1.75rem] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.03)] transition-all">
          <div className="flex items-center gap-2.5 text-slate-800 text-sm md:text-base font-bold">
            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
            <span>
              হোম স্ক্রিন ড্যাশবোর্ড • আজকের তারিখ:{" "}
              {new Date().toLocaleDateString("bn-BD", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <span className="text-xs text-slate-700 font-mono bg-white/60 border border-white/70 px-4 py-1.5 rounded-full font-bold shadow-sm">
            জাপানিজ ও বাংলা লাইভ টিচার (৩ কলাম অটো-পার্সার)
          </span>
        </div>

        <div className="w-full flex flex-col lg:flex-row items-stretch gap-6 md:gap-8">
          {/* Left Column: AST Vocabulary Text Box & Parser on Home Screen */}
          <div className="w-full lg:flex-1 bg-white/45 border border-white/60 rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] backdrop-blur-2xl flex flex-col gap-5 min-h-[600px] pointer-events-auto transition-all relative overflow-hidden">
            {/* HarmonyOS 7 Ultra-Glass Top Sheen & Subtle Ambient Glow */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/40 via-white/[0.02] to-transparent pointer-events-none rounded-t-[2.5rem]" />
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-pink-200/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 pb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <Code size={22} className="text-blue-500 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base md:text-lg font-extrabold text-slate-800 font-sans tracking-wide">
                    ১. হোম স্ক্রিন শব্দতালিকা ইনপুট ও পার্সার
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-slate-500 font-medium">
                      সরাসরি পেস্ট করুন বা ক্লিপবোর্ড বাটন চাপুন
                    </p>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-mono border border-blue-100 font-black tracking-wider uppercase">
                      Lesson & Difficult Vocabulary Folder
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex bg-white/40 p-1 rounded-2xl border border-white/60 text-xs font-bold shadow-sm backdrop-blur-md">
                <button
                  onClick={() => setHomeTab("input")}
                  className={`px-4 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${homeTab === "input" ? "bg-white text-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-white/40" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <div className="flex items-center gap-1.5"><ClipboardPaste size={14} /> <span>ইনপুট বক্স</span></div>
                </button>
                <button
                  onClick={() => setHomeTab("parsed")}
                  className={`px-4 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${homeTab === "parsed" ? "bg-white text-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-white/40" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <div className="flex items-center gap-1.5"><Layers size={14} /> <span>সাজানো তালিকা ({parsedVocab.length})</span></div>
                </button>
                <button
                  onClick={() => setHomeTab("lessons")}
                  className={`px-4 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${homeTab === "lessons" ? "bg-white text-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-white/40" : "text-slate-600 hover:text-slate-900"}`}
                >
                  <div className="flex items-center gap-1.5"><Folder size={14} /> <span>লেসন ফোল্ডার ({lessons.length})</span></div>
                </button>
                <button
                  onClick={() => setHomeTab("difficult")}
                  className={`px-4 py-1.5 rounded-xl font-extrabold transition-all cursor-pointer ${homeTab === "difficult" ? "bg-rose-50 text-rose-700 shadow-[0_4px_12px_rgba(244,63,94,0.08)] border border-rose-100" : "text-rose-600/80 hover:text-rose-600"}`}
                >
                  <div className="flex items-center gap-1.5"><AlertCircle size={14} /> <span>কঠিন শব্দসমূহ ({difficultVocab.length})</span></div>
                </button>
              </div>
            </div>

            {homeTab === "input" && (
              <div className="flex-1 flex flex-col gap-4 min-h-[380px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-3 h-3 rounded-full ${clipboardPermStatus === "granted" ? "bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.4)]" : clipboardPermStatus === "denied" ? "bg-red-400" : "bg-amber-400"}`}
                    ></span>
                    <span className="text-xs md:text-sm font-extrabold text-slate-700">
                      ক্লিপবোর্ড স্ট্যাটাস:{" "}
                      {clipboardPermStatus === "granted"
                        ? "অনুমোদিত (Granted)"
                        : clipboardPermStatus === "denied"
                          ? "ব্লক করা (Denied)"
                          : "অনুমতি প্রয়োজন (Need Permission)"}
                    </span>
                  </div>
                  <button
                    onClick={handleRequestClipboardPerm}
                    className="px-4 py-2 bg-slate-900/10 hover:bg-slate-900/20 text-slate-800 border border-slate-900/10 rounded-xl text-xs md:text-sm font-extrabold flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title="ব্রাউজারে ক্লিপবোর্ড পারমিশন অ্যাক্টিভ করুন"
                  >
                    <span> ক্লিপবোর্ড পারমিশন দিন</span>
                  </button>
                </div>
                <div className="relative w-full flex-1 flex flex-col group">
                  <textarea
                    value={vocabInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      const prevLen = vocabInput.length;
                      setVocabInput(val);
                      if (val && val.trim()) {
                        const isVocabFormat =
                          /("q"|'q'|=>|\[\s*\[|[\u0980-\u09FF].*[\u3040-\u30FF\u4E00-\u9FAF]|[\u3040-\u30FF\u4E00-\u9FAF].*[\u0980-\u09FF])/.test(
                            val,
                          ) ||
                          val.split("\n").filter((l) => l.trim()).length >= 1;
                        if (isVocabFormat) {
                          const res = parseVocabularyAST(val);
                          if (!res.error && res.items && res.items.length > 0) {
                            setVocabError(null);
                            setParsedVocab(res.items);
                            setPrettyCode(res.formattedPHP);
                            if (
                              Math.abs(val.length - prevLen) > 5 ||
                              (prevLen === 0 && val.length > 2)
                            ) {
                              setVocabInput(res.formattedPHP);
                              setHomeTab("parsed");
                            }
                          }
                        }
                      } else {
                        setVocabError(null);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text && text.trim()) {
                        setTimeout(() => {
                          const target = e.target as HTMLTextAreaElement;
                          const val = target ? target.value : text;
                          if (val && val.trim()) {
                            const res = parseVocabularyAST(val);
                            if (
                              !res.error &&
                              res.items &&
                              res.items.length > 0
                            ) {
                              setVocabError(null);
                              setParsedVocab(res.items);
                              setPrettyCode(res.formattedPHP);
                              setVocabInput(res.formattedPHP);
                              setHomeTab("parsed");
                            } else {
                              handleParseHomeVocab(val);
                            }
                          }
                        }, 20);
                      }
                    }}
                    placeholder="এখানে আপনার শব্দতালিকা (PHP Array, JSON বা হিরাগানা-রোমাজি-বাংলা টেক্সট বা ছবি থেকে পড়া লেখা) পেস্ট করুন... পেস্ট করলেই স্বয়ংক্রিয়ভাবে সাজানো হবে!"
                    className={`w-full flex-1 min-h-[400px] bg-white/40 border border-white/60 focus:bg-white/60 rounded-3xl p-5 pb-5 text-slate-800 font-mono text-xs md:text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 resize-none shadow-sm font-semibold ${isAnalyzingImage ? "opacity-50 pointer-events-none" : ""}`}
                  />
                  <AnimatePresence>
                    {isAnalyzingImage && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md rounded-3xl z-10"
                      >
                        <Loader2
                          size={48}
                          className="text-blue-500 animate-spin mb-4"
                        />
                        <p className="text-blue-600 font-extrabold text-sm md:text-base animate-pulse">
                          ছবি বিশ্লেষণ করা হচ্ছে...
                        </p>
                        <p className="text-slate-600 text-xs font-bold mt-2">
                          Gemini AI Vocabulary Extracting
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {vocabError && (
                  <div className="p-3 bg-red-500/10 border border-red-200 rounded-2xl text-red-600 text-xs md:text-sm font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{vocabError}</span>
                  </div>
                )}

                {/* Organized Action Buttons Panel */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm backdrop-blur-md">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      ref={cameraInputRef}
                      className="hidden"
                    />
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2.5 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90 text-white font-extrabold rounded-2xl text-xs md:text-sm flex items-center gap-2 shadow-[0_4px_12px_rgba(236,72,153,0.15)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                      title="ক্যামেরা দিয়ে ছবি তুলে স্ক্যান করুন"
                    >
                      <Camera size={16} className="text-white shrink-0" />
                      <span>ক্যামেরা (Scan)</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-white/60 hover:bg-white/80 text-slate-700 font-extrabold rounded-2xl text-xs md:text-sm flex items-center gap-2 border border-slate-200 shadow-sm transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                      title="গ্যালারি থেকে ছবি আপলোড করুন"
                    >
                      <ImageIcon size={16} className="text-slate-600 shrink-0" />
                      <span>গ্যালারি (Photo)</span>
                    </button>
                    <button
                      onClick={handlePasteFromClipboard}
                      className="px-4 py-2.5 bg-white/60 hover:bg-white/80 text-slate-700 font-extrabold rounded-2xl text-xs md:text-sm flex items-center gap-2 border border-slate-200 shadow-sm transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                      title="ক্লিপবোর্ড থেকে সরাসরি পেস্ট ও স্বয়ংক্রিয় পার্স করুন"
                    >
                      <ClipboardPaste
                        size={16}
                        className="text-slate-600 shrink-0"
                      />
                      <span>পেস্ট করুন (Paste)</span>
                    </button>
                    <button
                      onClick={() => handleParseHomeVocab()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs md:text-sm rounded-2xl shadow-[0_4px_12px_rgba(37,99,235,0.15)] flex items-center gap-2 transition-all cursor-pointer hover:scale-105"
                    >
                      <Code size={16} />
                      <span>Parse (সাজান)</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        setVocabInput("");
                        setParsedVocab([]);
                        setPrettyCode("");
                      }}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs md:text-sm font-extrabold rounded-2xl border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      <span>ক্লিয়ার</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {homeTab === "parsed" && (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                {/* Mode Selector right on home screen */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/40 p-4 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs md:text-sm font-extrabold text-slate-800">
                      কুইজ মোড:
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVocabQuizMode("sequential")}
                        className={`px-3 py-1.5 text-xs rounded-xl font-extrabold transition-all cursor-pointer ${vocabQuizMode === "sequential" ? "bg-blue-600 text-white shadow-sm" : "bg-white/50 text-slate-700 border border-slate-200 hover:bg-white/80"}`}
                      >
                        সিরিয়াল (Sequential)
                      </button>
                      <button
                        onClick={() => setVocabQuizMode("mixed")}
                        className={`px-3 py-1.5 text-xs rounded-xl font-extrabold transition-all cursor-pointer ${vocabQuizMode === "mixed" ? "bg-blue-600 text-white shadow-sm" : "bg-white/50 text-slate-700 border border-slate-200 hover:bg-white/80"}`}
                      >
                        এলোমেলো (Mixed)
                      </button>
                    </div>
                  </div>

                  {parsedVocab.length > 0 && (
                    <button
                      onClick={() => {
                        setLessonNameInputValue("");
                        setShowSaveLessonModal(true);
                      }}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95"
                    >
                      <PlusCircle size={13} />
                      <span>লেসন ফোল্ডারে সেভ করুন </span>
                    </button>
                  )}
                </div>

                {/* 3-Column Table Header According to Picture Specification */}
                <div className="grid grid-cols-12 gap-2 bg-white/50 border border-white/70 px-4 py-3 rounded-2xl text-xs md:text-sm font-extrabold text-slate-800 text-center items-center shadow-sm backdrop-blur-md">
                  <div className="col-span-1 text-left">#</div>
                  <div className="col-span-3 text-left">
                    ১. হিরাগানা (Hiragana)
                  </div>
                  <div className="col-span-3 text-left">২. রোমাজি (Romaji)</div>
                  <div className="col-span-3 text-right">
                    ৩. বাংলা অর্থ (Bengali)
                  </div>
                  <div className="col-span-2 text-center">অ্যাকশন</div>
                </div>

                {/* Cards List in 3-Column Layout */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[340px] max-h-[600px] md:max-h-[700px]">
                  {parsedVocab.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm font-bold py-12">
                      কোনো শব্দতালিকা পার্স করা হয়নি। <span className="inline-flex items-center gap-1.5"><ClipboardPaste size={14} /> <span>ইনপুট বক্স</span></span>ে কোড দিয়ে
                      'Parse' ক্লিক করুন।
                    </div>
                  ) : (
                    parsedVocab.map((item, idx) => {
                      const jpWord = item.hira || item.a[0] || "";
                      const isDifficult = difficultVocab.some(
                        (d) =>
                          (d.hira || d.a[0] || "").trim().toLowerCase() ===
                          jpWord.trim().toLowerCase(),
                      );
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center bg-white/50 hover:bg-white/70 border border-white/60 rounded-2xl p-4 transition-all text-xs md:text-sm shadow-sm"
                        >
                          <div className="col-span-1 font-mono text-blue-600 font-extrabold text-sm">
                            {idx + 1}
                          </div>
                          <div className="col-span-3 font-extrabold text-slate-800 text-left break-words text-sm md:text-base">
                            {item.hira || item.a[0] || "-"}
                            {item.a.length > 1 && (
                              <span className="block text-[11px] md:text-xs text-blue-600/80 font-bold mt-1">
                                ({item.a.join(", ")})
                              </span>
                            )}
                          </div>
                          <div className="col-span-3 font-mono text-teal-700 text-left break-words font-semibold text-sm">
                            {item.romaji || "-"}
                          </div>
                          <div className="col-span-3 font-extrabold text-slate-900 text-right break-words text-sm md:text-base">
                            {item.q}
                          </div>
                          <div className="col-span-2 flex justify-center items-center gap-1.5">
                            <button
                              onClick={() => handleToggleDifficult(item)}
                              className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 cursor-pointer ${isDifficult ? "text-amber-500 bg-amber-50 border border-amber-100 hover:bg-amber-100" : "text-slate-400 hover:text-amber-500 hover:bg-slate-50"}`}
                              title={
                                isDifficult
                                  ? "কঠিন তালিকা থেকে বাদ দিন"
                                  : "কঠিন তালিকায় যোগ করুন"
                              }
                            >
                              <Star
                                size={16}
                                fill={isDifficult ? "currentColor" : "none"}
                              />
                            </button>
                            <button
                              onClick={() => handleDeleteVocabItem(idx)}
                              className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-all cursor-pointer"
                              title="শব্দটি ডিলিট করুন"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {homeTab === "lessons" && (
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {!selectedLessonId ? (
                  // --- Lessons Folder List View ---
                  <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="text-left">
                        <h3 className="text-sm md:text-base font-extrabold text-slate-800 font-sans tracking-wide">
                          جাপানিজ লেসন ফোল্ডার (Lessons Folder)
                        </h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          আপনার সকল সেভকৃত লেসনের তালিকা নিচে দেওয়া হলো
                        </p>
                      </div>
                      {lessons.length > 0 && (
                        <button
                          onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              title: "সব লেসন মুছুন ",
                              message:
                                "আপনি কি আসলেই আপনার সংরক্ষিত সকল লেসন মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।",
                              onConfirm: () => {
                                setLessons([]);
                                setSelectedLessonId(null);
                              },
                            });
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>সব লেসন মুছুন</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[600px] md:max-h-[750px] pr-1 py-1">
                      {lessons.length === 0 ? (
                        <div className="col-span-full py-12 text-center bg-white/40 border border-white/60 rounded-3xl p-6 backdrop-blur-md">
                          <Folder
                            size={48}
                            className="text-amber-500 mx-auto mb-3"
                          />
                          <p className="text-sm font-extrabold text-slate-800">
                            কোনো লেসন পাওয়া যায়নি!
                          </p>
                          <p className="text-xs text-slate-500 font-semibold mt-1 max-w-sm mx-auto leading-relaxed">
                            কথোপকথন চলাকালে "Save this lesson" বলুন অথবা আপনার
                            সাজানো তালিকা থেকে সরাসরি "লেসন ফোল্ডারে সেভ করুন"
                            বাটন চাপুন।
                          </p>
                        </div>
                      ) : (
                        lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className="bg-white/50 hover:bg-white/80 border border-white/70 shadow-sm rounded-3xl p-5 backdrop-blur-md transition-all duration-300 cursor-pointer flex flex-col justify-between gap-4 relative group"
                          >
                            <div className="absolute top-4 right-4 text-amber-500/10 group-hover:text-amber-500/30 transition-colors">
                              <Folder size={40} className="fill-current" />
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600 shrink-0">
                                <FolderOpen size={20} />
                              </div>
                              <div className="pr-10">
                                <h4 className="text-sm md:text-base font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                                  {lesson.name}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">
                                  তৈরি: {lesson.createdAt}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-100 font-black">
                                {lesson.vocab.length}টি শব্দ
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModalConfig({
                                      isOpen: true,
                                      title: "লেসন মুছুন",
                                      message: `আপনি কি আসলেই '${lesson.name}' লেসনটি মুছে ফেলতে চান?`,
                                      onConfirm: () => {
                                        setLessons((prev) =>
                                          prev.filter(
                                            (l) => l.id !== lesson.id,
                                          ),
                                        );
                                      },
                                    });
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all cursor-pointer"
                                  title="লেসনটি ডিলিট করুন"
                                >
                                  <Trash2 size={13} />
                                </button>
                                <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                  বিস্তারিত
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  // --- Selected Lesson Details & Quiz View ---
                  (() => {
                    const currentLesson = lessons.find(
                      (l) => l.id === selectedLessonId,
                    );
                    if (!currentLesson) {
                      setSelectedLessonId(null);
                      return null;
                    }

                    return (
                      <div className="flex flex-col gap-5 overflow-hidden">
                        {/* Navigation Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
                          <button
                            onClick={() => {
                              setSelectedLessonId(null);
                              setLessonQuizActive(false);
                              setLessonQuizFeedback(null);
                            }}
                            className="px-3.5 py-1.5 bg-white/60 hover:bg-white/80 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            লেসন তালিকায় ফিরুন
                          </button>
                          <h3 className="text-xs md:text-sm font-black text-slate-800 max-w-[200px] md:max-w-xs truncate">
                            {currentLesson.name}
                          </h3>
                        </div>

                        {/* Lesson Memorization Practice Card */}
                        <div className="bg-white/50 border border-white/70 shadow-sm rounded-3xl p-5 md:p-6 backdrop-blur-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Mic size={120} className="text-blue-500" />
                          </div>

                          <div className="relative z-10 flex flex-col gap-4">
                            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
                                  <Mic size={22} />
                                </div>
                                <div>
                                  <h3 className="text-base md:text-lg font-extrabold text-slate-800 font-sans tracking-wide">
                                    মৌখিক কুইজ প্র্যাকটিস (Conversational Quiz)
                                  </h3>
                                  <p className="text-xs text-slate-500 font-semibold">
                                    জয়ার সাথে মুখে মুখে চর্চা করে শব্দকোষ সহজে
                                    মুখস্থ করুন
                                  </p>
                                </div>
                              </div>

                              {/* Mode selection toggles inside card */}
                              <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
                                <button
                                  onClick={() => setVocabQuizMode("sequential")}
                                  className={`px-3 py-1.5 text-xs rounded-lg font-extrabold transition-all cursor-pointer ${vocabQuizMode === "sequential" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                  সিরিয়াল অনুযায়ী
                                </button>
                                <button
                                  onClick={() => setVocabQuizMode("mixed")}
                                  className={`px-3 py-1.5 text-xs rounded-lg font-extrabold transition-all cursor-pointer ${vocabQuizMode === "mixed" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                                >
                                  এলোমেলো (Mixed)
                                </button>
                              </div>
                            </div>

                            {isSessionActive ? (
                              <div className="bg-white/40 border border-red-200 rounded-2xl p-5 flex flex-col gap-4 relative shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex h-3 w-3 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                  </div>
                                  <span className="text-xs font-black text-rose-600 tracking-wider">
                                    {" "}
                                    কুইজ সেশন চলছে...
                                  </span>
                                </div>

                                <div className="py-2">
                                  <div className="text-sm font-extrabold text-slate-800">
                                    জয়া আপনাকে প্রশ্ন ধরছে!
                                  </div>
                                  <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed">
                                    জয়া বাংলায় প্রশ্ন জিজ্ঞাসা করলে আপনি সরাসরি
                                    মাইক্রোফোনে জাপানি বা রোমাজি উত্তর বলুন।
                                    উত্তর সঠিক বা ভুল হলে জয়া আপনাকে সাথে সাথে
                                    ফিডব্যাক দেবে।
                                  </p>
                                </div>

                                <button
                                  onClick={() => toggleListening()}
                                  className="px-5 py-3 bg-slate-850 hover:bg-rose-600 hover:text-white text-slate-800 border border-slate-200 bg-white/60 text-xs md:text-sm font-black rounded-xl transition-all shadow-sm hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                                >
                                  <span> কুইজ সেশন বন্ধ করুন</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/40 border border-slate-200 rounded-2xl p-5 shadow-sm">
                                <div className="text-left flex-1">
                                  <div className="text-sm font-extrabold text-slate-800">
                                    মৌখিক লাইভ প্র্যাকটিস শুরু করুন
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium mt-1">
                                    এই লেসনের {currentLesson.vocab.length}টি
                                    শব্দ থেকে এক এক করে আপনাকে মুখে প্রশ্ন
                                    জিজ্ঞাসা করা হবে। লেখার কোনো ঝামেলা নেই!
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    toggleListening(
                                      currentLesson.vocab,
                                      vocabQuizMode,
                                      currentLesson.name,
                                    )
                                  }
                                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs md:text-sm font-black rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
                                >
                                  <Play
                                    size={14}
                                    className="fill-current text-white"
                                  />
                                  <span> প্র্যাকটিস শুরু করুন</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Lesson Vocab Table */}
                        <div className="flex flex-col gap-3">
                          <h4 className="text-xs md:text-sm font-extrabold text-slate-800 tracking-wider">
                            এই লেসনের শব্দতালিকা
                          </h4>

                          <div className="grid grid-cols-12 gap-2 bg-white/50 border border-white/70 px-4 py-3 rounded-2xl text-xs md:text-sm font-extrabold text-slate-800 text-center items-center shadow-sm backdrop-blur-md">
                            <div className="col-span-1 text-left">#</div>
                            <div className="col-span-3 text-left">
                              জাপানিজ (Japanese)
                            </div>
                            <div className="col-span-3 text-left">
                              রোমাজি (Romaji)
                            </div>
                            <div className="col-span-3 text-right">
                              বাংলা অর্থ (Bengali)
                            </div>
                            <div className="col-span-2 text-center">
                              অ্যাকশন
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[550px] md:max-h-[650px]">
                            {currentLesson.vocab.map((item, idx) => {
                              const jpWord = item.hira || item.a[0] || "";
                              const isDifficult = difficultVocab.some(
                                (d) =>
                                  (d.hira || d.a[0] || "")
                                    .trim()
                                    .toLowerCase() ===
                                  jpWord.trim().toLowerCase(),
                              );
                              return (
                                <div
                                  key={idx}
                                  className="grid grid-cols-12 gap-2 items-center bg-white/50 hover:bg-white/70 border border-white/60 rounded-2xl p-4 transition-all text-xs md:text-sm shadow-sm"
                                >
                                  <div className="col-span-1 font-mono text-blue-600 font-extrabold text-sm">
                                    {idx + 1}
                                  </div>
                                  <div className="col-span-3 font-extrabold text-slate-800 text-left break-words text-sm md:text-base">
                                    {jpWord}
                                    {item.a.length > 1 && (
                                      <span className="block text-[11px] md:text-xs text-blue-600/80 font-bold mt-1">
                                        ({item.a.join(", ")})
                                      </span>
                                    )}
                                  </div>
                                  <div className="col-span-3 font-mono text-teal-700 text-left break-words font-semibold text-sm">
                                    {item.romaji || "-"}
                                  </div>
                                  <div className="col-span-3 font-extrabold text-slate-900 text-right break-words text-sm md:text-base">
                                    {item.q}
                                  </div>
                                  <div className="col-span-2 flex justify-center items-center gap-1.5">
                                    <button
                                      onClick={() => speakJapanese(jpWord)}
                                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl transition-all cursor-pointer"
                                      title="শব্দটির জাপানি উচ্চারণ শুনুন"
                                    >
                                      <Volume2 size={16} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleToggleDifficult(item)
                                      }
                                      className={`p-2 rounded-xl transition-all hover:scale-110 active:scale-95 cursor-pointer ${isDifficult ? "text-amber-500 bg-amber-50 border border-amber-100 hover:bg-amber-100" : "text-slate-400 hover:text-amber-500 hover:bg-slate-50"}`}
                                      title={
                                        isDifficult
                                          ? "কঠিন তালিকা থেকে বাদ দিন"
                                          : "কঠিন তালিকায় যোগ করুন"
                                      }
                                    >
                                      <Star
                                        size={16}
                                        fill={
                                          isDifficult ? "currentColor" : "none"
                                        }
                                      />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {homeTab === "difficult" && (
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {/* Daily Memorization Practice Card */}
                <div className="bg-white/50 border border-white/70 rounded-3xl p-5 md:p-6 shadow-sm backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Mic size={120} className="text-blue-500" />
                  </div>

                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
                          <Mic size={22} />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-extrabold text-slate-800 font-sans tracking-wide">
                            মাস্টারি প্র্যাকটিস ও মেমোরাইজেশন কুইজ (Daily Practice)
                          </h3>
                          <p className="text-xs text-slate-500 font-semibold">
                            সংরক্ষিত কঠিন শব্দগুলো প্রতিদিন চর্চা করে সহজে
                            মুখস্থ করুন
                          </p>
                        </div>
                      </div>

                      {/* Mode selection toggles inside card */}
                      <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
                        <button
                          onClick={() => setVocabQuizMode("sequential")}
                          className={`px-3 py-1.5 text-xs rounded-lg font-extrabold transition-all cursor-pointer ${vocabQuizMode === "sequential" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          সিরিয়াল অনুযায়ী
                        </button>
                        <button
                          onClick={() => setVocabQuizMode("mixed")}
                          className={`px-3 py-1.5 text-xs rounded-lg font-extrabold transition-all cursor-pointer ${vocabQuizMode === "mixed" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          এলোমেলো (Mixed)
                        </button>
                      </div>
                    </div>

                    {difficultVocab.length === 0 ? (
                      <div className="bg-white/40 border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                        <AlertCircle
                          size={32}
                          className="text-amber-500 mx-auto mb-2.5"
                        />
                        <p className="text-xs md:text-sm font-extrabold text-slate-800">
                          কোনো কঠিন শব্দ এখনো তালিকাভুক্ত করা হয়নি!
                        </p>
                        <p className="text-xs text-slate-500 font-semibold mt-1.5 max-w-md mx-auto leading-relaxed">
                          ক্লাস সেশন চলাকালে মুখ দিয়ে{" "}
                          <span className="text-blue-600 font-black">
                            "Zoya, save this word"
                          </span>{" "}
                          বলুন অথবা{" "}
                          <span className="text-blue-600 font-black">
                            "সাজানো তালিকা"
                          </span>{" "}
                          থেকে স্টার আইকনে ক্লিক করে শব্দ যোগ করুন।
                        </p>
                      </div>
                    ) : isSessionActive ? (
                      <div className="bg-white/40 border border-blue-200 rounded-2xl p-5 flex flex-col gap-4 relative shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                          </div>
                          <span className="text-xs font-black text-rose-600 tracking-wider">
                            {" "}
                            কুইজ সেশন চলছে...
                          </span>
                        </div>

                        <div className="py-2">
                          <div className="text-sm font-extrabold text-slate-800">
                            জয়া আপনাকে কঠিন শব্দগুলো থেকে প্রশ্ন ধরছে!
                          </div>
                          <p className="text-xs text-slate-600 font-semibold mt-1 leading-relaxed">
                            জয়া বাংলায় প্রশ্ন জিজ্ঞাসা করলে আপনি সরাসরি
                            মাইক্রোফোনে জাপানি বা রোমাজি উত্তর বলুন। উত্তর সঠিক
                            বা ভুল হলে জয়া আপনাকে সাথে সাথে ফিডব্যাক দেবে।
                          </p>
                        </div>

                        <button
                          onClick={() => toggleListening()}
                          className="px-5 py-3 bg-white/65 hover:bg-rose-600 hover:text-white text-slate-800 border border-slate-200 text-xs md:text-sm font-black rounded-xl transition-all shadow-sm hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span> কুইজ সেশন বন্ধ করুন</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/40 border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="text-left flex-1">
                          <div className="text-sm font-extrabold text-slate-800">
                            মৌখিক কুইজ শুরু করুন
                          </div>
                          <div className="text-xs text-slate-500 font-medium mt-1">
                            মোট {difficultVocab.length}টি কঠিন শব্দ থেকে এক এক
                            করে আপনাকে মুখে প্রশ্ন জিজ্ঞাসা করা হবে। লেখার কোনো
                            ঝামেলা নেই!
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            toggleListening(
                              difficultVocab,
                              vocabQuizMode,
                              "কঠিন শব্দসমূহ",
                            )
                          }
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs md:text-sm font-extrabold rounded-xl transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 shrink-0"
                        >
                          <Play size={14} className="fill-current" />
                          <span> প্র্যাকটিস শুরু করুন</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              <AnimatePresence>
                {showTextInput && (
                  <motion.form
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onSubmit={handleTextSubmit}
                    className="w-full flex items-center gap-2 bg-white/60 border border-slate-200 rounded-2xl p-1 pl-4 backdrop-blur-md shadow-sm mb-2"
                  >
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="জয়া-কে টেক্সট মেসেজ লিখুন..."
                      className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-sm py-2"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!textInput.trim()}
                      className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white transition-colors cursor-pointer"
                    >
                      <Send size={16} />
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="w-full flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={toggleListening}
                  className={`
         flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-[2rem] font-extrabold tracking-wide transition-all duration-300 shadow-sm cursor-pointer text-base md:text-lg transform active:scale-95
         ${
           isSessionActive
             ? "bg-rose-50 text-rose-600 border border-rose-300 hover:bg-rose-100"
             : "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:scale-[1.02]"
         }
        `}
                >
                  {isSessionActive ? (
                    <>
                      <MicOff size={26} />
                      <span>সেশন বন্ধ করুন (End Session)</span>
                    </>
                  ) : (
                    <>
                      <Mic size={26} className="animate-bounce" />
                      <span>সেশন শুরু করুন (Start Session)</span>
                    </>
                  )}
                </button>



                {!isSessionActive && (
                  <button
                    onClick={() => setShowTextInput(!showTextInput)}
                    className="p-4 rounded-2xl bg-white/60 border border-slate-200 hover:bg-white/85 text-slate-700 transition-all shadow-sm cursor-pointer"
                    title="টাইপ করে কথা বলুন"
                  >
                    <Keyboard size={22} className="opacity-70" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>

      <AnimatePresence>


        {showVocabStudio && (
          <VocabularyStudio
            ref={vocabStudioRef}
            isOpen={showVocabStudio}
            onClose={() => setShowVocabStudio(false)}
            onSendToAI={handleSendVocabToAI}
            activeVoiceSession={isSessionActive}
          />
        )}

        {showSaveLessonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-zinc-900/90 border border-teal-500/30 rounded-3xl p-6 shadow-[0_10px_35px_rgba(0,0,0,0.8)] relative"
            >
              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                <div className="p-2.5 bg-teal-500/20 text-blue-300 rounded-2xl border border-red-500/20">
                  <FolderOpen size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-extrabold text-blue-300">
                    লেসন সেভ করুন{" "}
                  </h3>
                  <p className="text-xs text-white/50">
                    আপনার নতুন লেসনের জন্য একটি সুন্দর নাম দিন
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5 text-left">
                    লেসনের নাম (Lesson Name):
                  </label>
                  <input
                    type="text"
                    value={lessonNameInputValue}
                    onChange={(e) => setLessonNameInputValue(e.target.value)}
                    placeholder={`Lesson ${lessons.length + 1}: My New Lesson`}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 font-semibold"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => setShowSaveLessonModal(false)}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-sm font-extrabold rounded-xl transition-all cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  onClick={() => {
                    const name = lessonNameInputValue.trim();
                    const nextNum = lessons.length + 1;
                    const finalName =
                      name ||
                      `Lesson ${nextNum}: Custom Set (${new Date().toLocaleDateString()})`;
                    const newLesson: Lesson = {
                      id: `lesson-${Date.now()}`,
                      name: finalName,
                      vocab: [...parsedVocab],
                      createdAt: new Date().toLocaleDateString(),
                    };
                    const updatedLessons = [...lessons, newLesson];
                    setLessons(updatedLessons);
                    localStorage.setItem(
                      "zoya_lessons",
                      JSON.stringify(updatedLessons),
                    );
                    setSelectedLessonId(newLesson.id);
                    setHomeTab("lessons");

                    // Clear list after manual save
                    setParsedVocab([]);
                    setVocabInput("");
                    setPrettyCode("");

                    setShowSaveLessonModal(false);
                  }}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 text-white text-sm font-black rounded-xl transition-all cursor-pointer shadow-lg"
                >
                  সেভ করুন 💾
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {confirmModalConfig.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-zinc-900/90 border border-red-500/30 rounded-3xl p-6 shadow-[0_10px_35px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4 text-left">
                <div className="p-2.5 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
                  <AlertCircle size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-red-400">
                    {confirmModalConfig.title}
                  </h3>
                  <p className="text-xs text-white/50">
                    নিশ্চিতকরণ প্রয়োজন (Confirmation Required)
                  </p>
                </div>
              </div>

              <p className="text-sm text-white/80 text-left leading-relaxed">
                {confirmModalConfig.message}
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() =>
                    setConfirmModalConfig((prev) => ({
                      ...prev,
                      isOpen: false,
                    }))
                  }
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-sm font-extrabold rounded-xl transition-all cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  onClick={() => {
                    confirmModalConfig.onConfirm();
                    setConfirmModalConfig((prev) => ({
                      ...prev,
                      isOpen: false,
                    }));
                  }}
                  className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-400 text-white text-sm font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-red-500/20"
                >
                  হ্যাঁ, নিশ্চিত
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

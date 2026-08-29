export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
  value?: string;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply, Ashwani.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  // Vocab: Organize text
  if (lowerCmd.includes("organize the text")) {
    return {
      action: "organize_text",
      isBrowserAction: false,
    };
  }

  // Clear Chat History
  if (
    lowerCmd.includes("clear chat") ||
    lowerCmd.includes("clear messages") ||
    lowerCmd.includes("clear chat history") ||
    lowerCmd.includes("চ্যাট মুছুন") ||
    lowerCmd.includes("চ্যাট মুছে ফেলো") ||
    lowerCmd.includes("চ্যাট ইতিহাস মুছুন") ||
    lowerCmd.includes("মেসেজ মুছুন") ||
    lowerCmd.includes("চ্যাট রিসেট")
  ) {
    return {
      action: "clear_chat",
      isBrowserAction: false,
    };
  }

  // Delete All Lessons
  if (
    lowerCmd.includes("clear all lessons") ||
    lowerCmd.includes("clear lessons") ||
    lowerCmd.includes("delete all lessons") ||
    lowerCmd.includes("delete lessons") ||
    lowerCmd.includes("সব লেসন মুছুন") ||
    lowerCmd.includes("সব লেসন মুছে ফেলো") ||
    lowerCmd.includes("লেসন ফোল্ডার খালি করো") ||
    lowerCmd.includes("সকল লেসন মুছুন")
  ) {
    return {
      action: "delete_all_lessons",
      isBrowserAction: false,
    };
  }

  // Clear Difficult Words List
  if (
    lowerCmd.includes("clear difficult words") ||
    lowerCmd.includes("clear difficult list") ||
    lowerCmd.includes("delete difficult words") ||
    lowerCmd.includes("সব কঠিন শব্দ মুছুন") ||
    lowerCmd.includes("কঠিন শব্দ মুছে ফেলো") ||
    lowerCmd.includes("সব কঠিন শব্দ মুছে ফেলো") ||
    lowerCmd.includes("কঠিন শব্দতালিকা খালি করো")
  ) {
    return {
      action: "clear_difficult",
      isBrowserAction: false,
    };
  }

  // Vocab: Save lesson
  if (
    lowerCmd.includes("save this lesson") ||
    lowerCmd.includes("save the lesson") ||
    lowerCmd.includes("save lesson") ||
    lowerCmd.includes("save set") ||
    lowerCmd.includes("লেসন সেভ") ||
    lowerCmd.includes("লিসন সেভ") ||
    lowerCmd.includes("লেসন সেভ করুন") ||
    lowerCmd.includes("ফোল্ডারে সেভ")
  ) {
    return {
      action: "save_lesson",
      isBrowserAction: false,
    };
  }

  // Vocab: Save word
  if (
    lowerCmd.includes("save this word") ||
    lowerCmd.includes("save the word") ||
    lowerCmd.includes("save word") ||
    lowerCmd.includes("শব্দ সেভ") ||
    lowerCmd.includes("শব্দটি সেভ") ||
    lowerCmd.includes("ওয়ার্ড সেভ") ||
    lowerCmd.includes("ওয়ার্ড সেভ") ||
    lowerCmd.includes("কঠিন শব্দ সেভ") ||
    lowerCmd.includes("কঠিন শব্দ")
  ) {
    return {
      action: "save_word",
      isBrowserAction: false,
    };
  }

  // Start Lesson Quiz
  if (
    lowerCmd.includes("start quiz") ||
    lowerCmd.includes("play quiz") ||
    lowerCmd.includes("start lesson quiz") ||
    lowerCmd.includes("lesson quiz") ||
    lowerCmd.includes("কুইজ শুরু করো") ||
    lowerCmd.includes("কুইজ খেলবো") ||
    lowerCmd.includes("কুইজ টেস্ট") ||
    lowerCmd.includes("কুইজ দাও") ||
    lowerCmd.includes("টেস্ট শুরু করো") ||
    lowerCmd.includes("প্র্যাকটিস শুরু করুন")
  ) {
    return {
      action: "start_lesson_quiz",
      isBrowserAction: false,
    };
  }

  // Start Difficult Quiz
  if (
    lowerCmd.includes("start difficult quiz") ||
    lowerCmd.includes("play difficult quiz") ||
    lowerCmd.includes("difficult words quiz") ||
    lowerCmd.includes("difficult quiz") ||
    lowerCmd.includes("কঠিন কুইজ") ||
    lowerCmd.includes("কঠিন কুইজ শুরু করো") ||
    lowerCmd.includes("কঠিন শব্দ কুইজ") ||
    lowerCmd.includes("কঠিন শব্দের কুইজ")
  ) {
    return {
      action: "start_difficult_quiz",
      isBrowserAction: false,
    };
  }

  // Stop Quiz
  if (
    lowerCmd.includes("stop quiz") ||
    lowerCmd.includes("end quiz") ||
    lowerCmd.includes("close quiz") ||
    lowerCmd.includes("cancel quiz") ||
    lowerCmd.includes("কুইজ বন্ধ করো") ||
    lowerCmd.includes("কুইজ শেষ করো") ||
    lowerCmd.includes("কুইজ বন্ধ")
  ) {
    return {
      action: "stop_quiz",
      isBrowserAction: false,
    };
  }

  // View Lessons Tab
  if (
    lowerCmd.includes("view lessons") ||
    lowerCmd.includes("show lessons") ||
    lowerCmd.includes("go to lessons") ||
    lowerCmd.includes("lessons folder") ||
    lowerCmd.includes("লেসন ফোল্ডার দেখাও") ||
    lowerCmd.includes("লেসন দেখাও") ||
    lowerCmd.includes("লেসন ফোল্ডার") ||
    lowerCmd.includes("লেসন তালিকা")
  ) {
    return {
      action: "tab_lessons",
      isBrowserAction: false,
    };
  }

  // View Difficult Words Tab
  if (
    lowerCmd.includes("view difficult words") ||
    lowerCmd.includes("show difficult words") ||
    lowerCmd.includes("go to difficult words") ||
    lowerCmd.includes("difficult list") ||
    lowerCmd.includes("কঠিন শব্দ দেখাও") ||
    lowerCmd.includes("কঠিন শব্দতালিকা দেখাও") ||
    lowerCmd.includes("কঠিন শব্দ") ||
    lowerCmd.includes("কঠিন শব্দতালিকা")
  ) {
    return {
      action: "tab_difficult",
      isBrowserAction: false,
    };
  }

  // View Chat Tab
  if (
    lowerCmd.includes("view chat") ||
    lowerCmd.includes("show chat") ||
    lowerCmd.includes("go to chat") ||
    lowerCmd.includes("chat window") ||
    lowerCmd.includes("home page") ||
    lowerCmd.includes("dashboard") ||
    lowerCmd.includes("হোম পেজ") ||
    lowerCmd.includes("চ্যাট দেখাও") ||
    lowerCmd.includes("চ্যাট স্ক্রিন") ||
    lowerCmd.includes("চ্যাট ট্যাব")
  ) {
    return {
      action: "tab_chat",
      isBrowserAction: false,
    };
  }

  // Vocab: Random order
  if (lowerCmd.includes("turn on random order") || lowerCmd.includes("randomize")) {
    return {
      action: "toggle_random",
      isBrowserAction: false,
    };
  }

  // Clear Input Box
  if (
    lowerCmd === "clear input" ||
    lowerCmd === "clear text box" ||
    lowerCmd === "clear text" ||
    lowerCmd === "ইনপুট মুছুন" ||
    lowerCmd === "ইনপুট বক্স খালি করো" ||
    lowerCmd === "টেক্সট মুছুন" ||
    lowerCmd === "ক্লিয়ার ইনপুট"
  ) {
    return {
      action: "clear_input",
      isBrowserAction: false,
    };
  }

  // Load Example
  if (
    lowerCmd === "load example" ||
    lowerCmd === "pasted default example" ||
    lowerCmd === "load demo" ||
    lowerCmd === "ডিফল্ট উদাহরণ লোড করো" ||
    lowerCmd === "ডেমো শব্দতালিকা দেখাও" ||
    lowerCmd === "লোডের উদাহরণ"
  ) {
    return {
      action: "load_example",
      isBrowserAction: false,
    };
  }

  // Parse Input Box Text
  if (
    lowerCmd === "parse input" ||
    lowerCmd === "parse vocab" ||
    lowerCmd === "পার্স করো" ||
    lowerCmd === "শব্দতালিকা সাজাও" ||
    lowerCmd === "পার্স করো শব্দতালিকা" ||
    lowerCmd === "পার্স শব্দতালিকা"
  ) {
    return {
      action: "parse_input",
      isBrowserAction: false,
    };
  }

  // Start Screen Share
  if (
    lowerCmd === "start screen share" ||
    lowerCmd === "start screen sharing" ||
    lowerCmd === "স্ক্রিন শেয়ার শুরু করো" ||
    lowerCmd === "স্ক্রিন শেয়ারিং চালু করো"
  ) {
    return {
      action: "start_screen_share",
      isBrowserAction: false,
    };
  }

  // Stop Screen Share
  if (
    lowerCmd === "stop screen share" ||
    lowerCmd === "stop screen sharing" ||
    lowerCmd === "স্ক্রিন শেয়ার বন্ধ করো" ||
    lowerCmd === "স্ক্রিন শেয়ারিং বন্ধ করো"
  ) {
    return {
      action: "stop_screen_share",
      isBrowserAction: false,
    };
  }

  // Mute Zoya
  if (
    lowerCmd === "mute" ||
    lowerCmd === "mute voice" ||
    lowerCmd === "mute assistant" ||
    lowerCmd === "মিউট করো" ||
    lowerCmd === "নিউট করো" ||
    lowerCmd === "কথা বলা মিউট করো"
  ) {
    return {
      action: "mute_voice",
      isBrowserAction: false,
    };
  }

  // Unmute Zoya
  if (
    lowerCmd === "unmute" ||
    lowerCmd === "unmute voice" ||
    lowerCmd === "unmute assistant" ||
    lowerCmd === "আনমিউট করো" ||
    lowerCmd === "কথা বলা আনমিউট করো"
  ) {
    return {
      action: "unmute_voice",
      isBrowserAction: false,
    };
  }

  // Open Vocab Studio
  if (
    lowerCmd === "open vocabulary studio" ||
    lowerCmd === "show vocabulary studio" ||
    lowerCmd === "শব্দকোষ স্টুডিও খোলো" ||
    lowerCmd === "স্টুডিও খোলো" ||
    lowerCmd === "শব্দকোষ স্টুডিও দেখাও"
  ) {
    return {
      action: "open_vocab_studio",
      isBrowserAction: false,
    };
  }

  // Close Vocab Studio
  if (
    lowerCmd === "close vocabulary studio" ||
    lowerCmd === "hide vocabulary studio" ||
    lowerCmd === "শব্দকোষ স্টুডিও বন্ধ করো" ||
    lowerCmd === "স্টুডিও বন্ধ করো" ||
    lowerCmd === "শব্দকোষ স্টুডিও লুকাও"
  ) {
    return {
      action: "close_vocab_studio",
      isBrowserAction: false,
    };
  }

  // Open Settings
  if (
    lowerCmd === "open settings" ||
    lowerCmd === "show settings" ||
    lowerCmd === "সেটিংস খোলো" ||
    lowerCmd === "সেটিংস দেখাও"
  ) {
    return {
      action: "open_settings",
      isBrowserAction: false,
    };
  }

  // Close Settings
  if (
    lowerCmd === "close settings" ||
    lowerCmd === "hide settings" ||
    lowerCmd === "সেটিংস বন্ধ করো" ||
    lowerCmd === "সেটিংস লুকাও"
  ) {
    return {
      action: "close_settings",
      isBrowserAction: false,
    };
  }

  // View Input Tab
  if (
    lowerCmd === "show input box" ||
    lowerCmd === "go to input tab" ||
    lowerCmd === "go to input" ||
    lowerCmd === "ইনপুট বক্স দেখাও" ||
    lowerCmd === "ইনপুট দেখাও" ||
    lowerCmd === "ইনপুট ট্যাব" ||
    lowerCmd === "গো টু ইনপুট"
  ) {
    return {
      action: "tab_input",
      isBrowserAction: false,
    };
  }

  // View Parsed Tab
  if (
    lowerCmd === "go to parsed list" ||
    lowerCmd === "show parsed vocabulary" ||
    lowerCmd === "show parsed list" ||
    lowerCmd === "সাজানো শব্দতালিকা দেখাও" ||
    lowerCmd === "সাজানো তালিকা দেখাও" ||
    lowerCmd === "সাজানো ট্যাব" ||
    lowerCmd === "গো টু সাজানো"
  ) {
    return {
      action: "tab_parsed",
      isBrowserAction: false,
    };
  }

  // Show Answer in Quiz
  if (
    lowerCmd === "show answer" ||
    lowerCmd === "see answer" ||
    lowerCmd === "view answer" ||
    lowerCmd === "উত্তর দেখাও" ||
    lowerCmd === "উত্তর দেখো" ||
    lowerCmd === "শো অ্যানসার"
  ) {
    return {
      action: "show_quiz_answer",
      isBrowserAction: false,
    };
  }

  // Hide Answer in Quiz
  if (
    lowerCmd === "hide answer" ||
    lowerCmd === "উত্তর লুকাও" ||
    lowerCmd === "উত্তর হাইড করো" ||
    lowerCmd === "হাইড অ্যানসার"
  ) {
    return {
      action: "hide_quiz_answer",
      isBrowserAction: false,
    };
  }

  // Next Question in Quiz
  if (
    lowerCmd === "next question" ||
    lowerCmd === "next" ||
    lowerCmd === "next one" ||
    lowerCmd === "পরের প্রশ্ন" ||
    lowerCmd === "পরবর্তী প্রশ্ন" ||
    lowerCmd === "পরেরটা" ||
    lowerCmd === "নেক্সট"
  ) {
    return {
      action: "next_quiz_question",
      isBrowserAction: false,
    };
  }

  // Stop Session / Close Voice Assistant
  if (
    lowerCmd === "stop session" ||
    lowerCmd === "end session" ||
    lowerCmd === "close session" ||
    lowerCmd === "stop listening" ||
    lowerCmd === "সেশন বন্ধ করো" ||
    lowerCmd === "সেশন শেষ করো" ||
    lowerCmd === "কথা বলা বন্ধ করো" ||
    lowerCmd === "মাইক বন্ধ করো" ||
    lowerCmd === "মাইক্রোফোন বন্ধ করো"
  ) {
    return {
      action: "stop_session",
      isBrowserAction: false,
    };
  }

  // Start Session / Open Voice Assistant
  if (
    lowerCmd === "start session" ||
    lowerCmd === "begin session" ||
    lowerCmd === "open microphone" ||
    lowerCmd === "সেশন শুরু করো" ||
    lowerCmd === "কথা বলা শুরু করো" ||
    lowerCmd === "মাইক চালু করো" ||
    lowerCmd === "মাইক্রোফোন চালু করো"
  ) {
    return {
      action: "start_session",
      isBrowserAction: false,
    };
  }

  // Select Lesson
  const lessonSelectMatch = lowerCmd.match(/^(?:select\s+lesson\s+|go\s+to\s+lesson\s+|লেসন\s+)([\d\w\s\-\:]+?)(?:\s+সিলেক্ট\s+করো|\s+খুলো|\s+খোলো|\s+নির্বাচন\s+করো)?$/);
  if (lessonSelectMatch) {
    return {
      action: "select_lesson",
      isBrowserAction: false,
      value: lessonSelectMatch[1].trim()
    };
  }

  // Submit Quiz Answer
  const answerIsMatch = lowerCmd.match(/^(?:answer\s+is\s+|answer\s+|উত্তর\s+হলো\s+|উত্তর\s+|আমার\s+উত্তর\s+)(.+)$/);
  if (answerIsMatch) {
    return {
      action: "submit_quiz_answer",
      isBrowserAction: false,
      value: answerIsMatch[1].trim()
    };
  }

  return { action: "", isBrowserAction: false };
}

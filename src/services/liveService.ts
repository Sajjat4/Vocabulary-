import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";
import { getSystemInstruction } from "./geminiService";

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  public noiseThreshold: number = 0.005;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onUpdateVocabText: (text: string) => void = () => {};
  public onMarkDifficult: (index: number) => void = () => {};
  public onSetQuizMode: (mode: "sequential" | "mixed") => void = () => {};
  public onNavigateUI: (tab: "input" | "parsed" | "lessons" | "difficult" | "chat" | "settings" | "studio") => void = () => {};
  public onStartQuiz: (source: "lesson" | "difficult" | "parsed", lessonName?: string) => void = () => {};
  public onOpenLesson: (lessonName: string) => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async start(vocabContent?: string, isScreenSharing: boolean = false, previousContext?: string, availableLessonsInfo?: string, quizMode?: "sequential" | "mixed") {
    try {
      this.onStateChange("processing");
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate Root Mean Square (RMS) of input audio to detect amplitude (loudness level)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const isBelowThreshold = rms < this.noiseThreshold;

        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          if (isBelowThreshold) {
            pcm16[i] = 0; // Send zeroed silent data to avoid background noise triggering
          } else {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      const sysInstruction = getSystemInstruction(vocabContent, isScreenSharing, availableLessonsInfo, quizMode);
      let fullSysInstruction = sysInstruction;
      if (previousContext) {
        fullSysInstruction += `\n\n[PREVIOUS SESSION CONTEXT]\nThe user was previously practicing or discussing this: ${previousContext}\nPlease seamlessly ask the user if they want to continue from where they left off, or start over. Do not ask for permissions, just warmly welcome them back and state the previous context.`;
      }

      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: { parts: [{ text: fullSysInstruction }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "updateVocabularyText",
                description: "Update the vocabulary text box directly. Use this if the user asks you to add, edit, or write vocabulary words into their list. Format should be in plain text or JSON.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    newText: { type: Type.STRING, description: "The new content to put in the vocabulary text box." }
                  },
                  required: ["newText"]
                }
              },
              {
                name: "markWordAsDifficult",
                description: "Mark a vocabulary word as difficult. Call this whenever the user makes a mistake on a word during the quiz.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.NUMBER, description: "The list index number (1-based) of the word to mark as difficult." }
                  },
                  required: ["index"]
                }
              },
              {
                name: "setQuizMode",
                description: "Set the quiz mode to either 'sequential' or 'mixed' based on user voice command.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    mode: { type: Type.STRING, description: "'sequential' or 'mixed'" }
                  },
                  required: ["mode"]
                }
              },
              {
                name: "navigateUI",
                description: "Navigate to different tabs or panels in the application. Call this when the user asks to see or go to the dashboard, lessons folder, chat, input box, settings, etc.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    tab: { type: Type.STRING, description: "The destination to navigate to. Allowed values: 'input', 'parsed', 'lessons', 'difficult', 'chat', 'settings', 'studio'" }
                  },
                  required: ["tab"]
                }
              },
              {
                name: "startQuiz",
                description: "Start a quiz for the user. Call this when the user asks to start a quiz from the lesson folder, difficult words, or overall parsed list.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING, description: "The source list to start the quiz from. Allowed values: 'lesson', 'difficult', 'parsed'" },
                    lessonName: { type: Type.STRING, description: "Optional. The specific name of the lesson if they asked to start a quiz for a specific lesson." }
                  },
                  required: ["source"]
                }
              },
              {
                name: "openLesson",
                description: "Open a specific lesson from the user's folder. Call this when the user asks to open or view a specific lesson or file.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    lessonName: { type: Type.STRING, description: "The specific name of the lesson to open." }
                  },
                  required: ["lessonName"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.onStateChange("listening");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle GoAway signal
            if ((message as any).serverContent?.goAway) {
              console.log("GoAway signal received, closing session gracefully");
              this.stop();
              return;
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            const userTurnText = (message.serverContent as any)?.userTurn?.parts?.map((p: any) => p.text).filter(Boolean).join(" ");
            if (userTurnText && userTurnText.trim()) {
               this.onMessage("user", userTurnText);
            }

            const userText = (message.serverContent as any)?.modelTurn?.parts?.[0]?.text;
            if (userText) {
               // Output transcription
               this.onMessage("zoya", userText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                } else if (call.name === "updateVocabularyText") {
                  const args = call.args as any;
                  if (args.newText) {
                    this.onUpdateVocabText(args.newText);
                  }
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Vocabulary text box updated successfully." }
                       }]
                     });
                  });
                } else if (call.name === "markWordAsDifficult") {
                  const args = call.args as any;
                  if (args.index !== undefined) {
                    this.onMarkDifficult(args.index);
                  }
                  
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Word marked as difficult successfully." }
                       }]
                     });
                  });
                } else if (call.name === "setQuizMode") {
                  const args = call.args as any;
                  if (args.mode === "sequential" || args.mode === "mixed") {
                    this.onSetQuizMode(args.mode);
                  }
                  
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Quiz mode changed to ${args.mode}.` }
                       }]
                     });
                  });
                } else if (call.name === "navigateUI") {
                  const args = call.args as any;
                  if (args.tab) {
                    this.onNavigateUI(args.tab);
                  }
                  
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Navigated to ${args.tab}.` }
                       }]
                     });
                  });
                } else if (call.name === "startQuiz") {
                  const args = call.args as any;
                  if (args.source) {
                    this.onStartQuiz(args.source, args.lessonName);
                  }
                  
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Started quiz from ${args.source}.` }
                       }]
                     });
                  });
                } else if (call.name === "openLesson") {
                  const args = call.args as any;
                  if (args.lessonName) {
                    this.onOpenLesson(args.lessonName);
                  }
                  
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `Lesson '${args.lessonName}' opened successfully.` }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.stop();
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
      throw error;
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }

  sendVideo(base64Data: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          video: { data: base64Data, mimeType: "image/jpeg" }
        });
      }).catch(err => console.error("Error sending video frame to Live API", err));
    }
  }
}

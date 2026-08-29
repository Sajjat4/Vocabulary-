import re

with open('src/services/liveService.ts', 'r') as f:
    content = f.read()

# I will just replace the tools section
start_pattern = "tools: [{"
end_pattern = "callbacks: {"
start_idx = content.find(start_pattern)
end_idx = content.find(end_pattern)

tools_content = """tools: [{
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
              }
            ]
          }]
        },
        """

new_content = content[:start_idx] + tools_content + content[end_idx:]

with open('src/services/liveService.ts', 'w') as f:
    f.write(new_content)


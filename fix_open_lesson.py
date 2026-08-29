import re

with open('src/services/liveService.ts', 'r') as f:
    content = f.read()

replacement = """              {
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
              }"""

content = content.replace("""              {
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
              }""", replacement)

with open('src/services/liveService.ts', 'w') as f:
    f.write(content)


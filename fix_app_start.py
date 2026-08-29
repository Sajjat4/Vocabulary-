import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

replacement = """        const previousMessages = messagesRef.current.slice(-8);
        const previousContextText =
          previousMessages.length > 0
            ? previousMessages.map((m) => `${m.sender}: ${m.text}`).join("\\n")
            : undefined;

        const availableLessonsInfo = lessonsRef.current.length > 0 
            ? lessonsRef.current.map(l => `- ${l.name} (${l.vocab.length} words)`).join("\\n")
            : "No lessons saved yet.";

        await session.start(vocabInput, isScreenSharing, previousContextText, availableLessonsInfo);"""

content = content.replace("""        const previousMessages = messagesRef.current.slice(-8);
        const previousContextText =
          previousMessages.length > 0
            ? previousMessages.map((m) => `${m.sender}: ${m.text}`).join("\\n")
            : undefined;

        await session.start(vocabInput, isScreenSharing, previousContextText);""", replacement)

with open('src/App.tsx', 'w') as f:
    f.write(content)


import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

replacement = """        session.onSetQuizMode = (mode) => {
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
"""

content = content.replace("""        session.onSetQuizMode = (mode) => {
          setVocabQuizMode(mode);
        };""", replacement)

with open('src/App.tsx', 'w') as f:
    f.write(content)


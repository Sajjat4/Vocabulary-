import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

replacement = """        session.onStartQuiz = (source, quizLessonName) => {
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
        };"""

content = content.replace("""        session.onStartQuiz = (source, quizLessonName) => {
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
        };""", replacement)

with open('src/App.tsx', 'w') as f:
    f.write(content)


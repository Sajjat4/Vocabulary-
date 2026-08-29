import re

with open('src/services/liveService.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'public onStartQuiz: (source: "lesson" | "difficult" | "parsed", lessonName?: string) => void = () => {};',
    'public onStartQuiz: (source: "lesson" | "difficult" | "parsed", lessonName?: string) => void = () => {};\n  public onOpenLesson: (lessonName: string) => void = () => {};'
)

content = content.replace(
    """                if (call.name === "startQuiz") {
                  this.onStartQuiz(call.args.source as any, call.args.lessonName as any);
                }""",
    """                if (call.name === "startQuiz") {
                  this.onStartQuiz(call.args.source as any, call.args.lessonName as any);
                }
                if (call.name === "openLesson") {
                  this.onOpenLesson(call.args.lessonName as string);
                }"""
)

with open('src/services/liveService.ts', 'w') as f:
    f.write(content)


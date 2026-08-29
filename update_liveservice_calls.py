import re

with open('src/services/liveService.ts', 'r') as f:
    content = f.read()

replacement = """
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
                }
"""

content = content.replace("""
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
                }
""", replacement)

with open('src/services/liveService.ts', 'w') as f:
    f.write(content)


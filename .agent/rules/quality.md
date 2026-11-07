# Code Quality & Import Integrity Rules

- Every component, hook, icon, and utility used in a file MUST be imported in that same file. Never assume a global.
- Before adding any new JSX element, verify its import exists at the top of the file.
- After EVERY change, run `npm run check`. If it fails, fix it before finishing. Never say a task is done while the build has errors.
- Before finishing, re-read every file you edited and confirm no undefined variables, components, or missing imports remain.
- When creating a new page, wrap it so a single component error can't crash it silently, and log the real error to the console.
- Don't rewrite or remove working code unless asked.

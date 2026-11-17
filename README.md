# QuizFlow

## Local library

Each saved quiz in **Continue studying** has a **⋯** menu with Download quiz JSON, Edit title, and Delete saved quiz. Editing a title updates its linked sessions and history. Deleting asks for confirmation and removes that quiz's JSON, sessions, results and activity; saved flashcard decks and planned quizzes are retained.

<<<<<<< HEAD
- Make it easy to load a quiz from JSON or a file and begin studying.
- Support different question formats, hints, explanations, images, and mathematical notation.
- Provide both timed assessment and answer-revealing practice workflows.
- Help learners track study activity, plan CBQs, set goals, and resume saved sessions.
- Keep quiz data durable and portable with IndexedDB storage and JSON backups.
=======
When the app opens, a dismissible **Study suggestions** panel shows your saved exam date/countdown and up to two useful next steps. It uses the same pending reviews as Plan, and prioritizes due flashcards, quiz mistakes/marked questions, overdue tasks, planned quizzes and important dates. Suggestions open the relevant review or page directly. All suggestions are computed locally from your saved library; no API is used. The panel closes when you dismiss it, change pages or receive a normal action notification.
>>>>>>> feature-member1

Quizzes, results, sessions, prompt slots, planner data and flashcards now use IndexedDB as the primary store. A memory cache keeps the existing interface responsive; growing libraries no longer need to fit in localStorage. The first launch migrates legacy browser data and eligible recovery snapshots, committing the new database before removing old cache entries. Existing backup snapshots are retained for recovery but are no longer rewritten on every answer.

Settings → Local data shows library size, quiz/flashcard counts, browser usage and capacity, and saving status. Protect browser storage requests persistent storage; browsers decide whether to grant it. Retry saving retries pending writes. If a save fails, the app keeps the latest data in memory and shows an error: keep the tab open and export JSON before freeing space. JSON imports commit their included collections in one transaction. Exports include prompt slots and planner metadata as well as the existing portable quiz/deck fields, and never include API keys.

IndexedDB remains tied to the browser profile and site address. Clearing site data can delete the library. Keep regular JSON backups, particularly before changing browsers or URLs. Delete redundant sessions or decks through their existing controls when needed; the app never automatically discards study content. This storage change improves capacity and durability but does not add cloud synchronization.

The primary adapter is js/library-storage.js, with CSS in css/library-storage.css.

<<<<<<< HEAD
- **Quiz loading:** paste JSON, paste from the clipboard, or select a `.json` file.
- **Question formats:** multiple choice, true/false, fill in the blank, matching, drag-and-drop matching, ordering, and image-based questions.
- **Exam mode:** timed quizzes, answer tracking, marking questions for review, and submission with a saved result.
- **Practice mode:** check answers, reveal correct answers, and review explanations.
- **Question tools:** section-aware question navigation, expandable hints, copy or remove a question, and keyboard shortcuts.
- **Progress and recovery:** save and resume quiz sessions in the browser.
- **Results:** review scores, section performance, question-level answers, and study advice.
- **Study planning:** organize planned CBQs, calendar dates, a final-exam countdown, and study tasks.
- **Home dashboard:** continue saved work, search quiz history, view a study calendar, and get local study suggestions.
- **Advanced flashcards:** organize tagged decks, preview and merge JSON imports, browse/edit cards, and use Again/Hard/Good/Easy spaced-repetition ratings with undo.
- **Flashcard review:** save questions from Practice and Results, preview marked questions and mistakes, and review due cards or quiz questions from the Plan queue.
- **Flashcard library:** view decks and saved CBQ reviews by date, with calendar filtering and per-deck due/new counts.
- **Personalization:** choose appearance, color theme, font, question text size, exam width, sounds, and default quiz duration.
- **Local library:** store quiz and flashcard data in IndexedDB, migrate legacy browser data, and export/import supported collections transactionally.
- **Local data controls:** export, import, reset, protect browser storage, and retry pending saves.
- **Math and text rendering:** display LaTeX with [KaTeX](https://katex.org/).
- **Scope:** Pomodoro timers are not part of this app.
=======
Quiz progress and results save automatically in the browser; the Quiz page has no manual Save button. Continue studying offers **Download quiz JSON** in each quiz's **⋯** menu. This downloads reusable quiz questions, correct answers and explanations, without the user's attempt answers, marks for review or timer state. Load it through the quiz importer to start a new attempt. The full library backup remains in Settings → Local data. Previously exported session files can still be restored with the quiz importer or Settings → Import JSON without replacing other sessions.
>>>>>>> feature-member1

Settings → Local data → **Download JSON** exports the full library and includes the latest active session and results. It creates an ordinary `quizflow-data.json` file for offline backup or sharing; the recipient can use Settings → **Import JSON** to load it. Export reads the in-memory library, including pending writes, and does not require an IndexedDB save or internet connection. IndexedDB remains the browser save location; API keys are excluded from files. Imported sessions are validated before writing, and replacing sessions with a full backup stops stale active autosaves until you reopen a session. Browser protection, retry and reset controls are under the Local data panel's **⋯** menu.

<<<<<<< HEAD
| Technology | Use |
|---|---|
| HTML5 | Page structure and accessible controls |
| CSS3 | Layout, responsive styling, and themes |
| JavaScript (vanilla) | Quiz, results, planning, settings, and spaced-repetition workflows |
| IndexedDB | Primary local library for quizzes, flashcards, sessions, results, and planner data |
| Local Storage | One-time migration source and fallback when IndexedDB is unavailable |
| KaTeX | Rendering mathematical expressions |

The app has no build step or package installation requirement. KaTeX and the selected web fonts are loaded from external CDNs, so an internet connection is needed for those resources. Quiz data remains in the current browser profile; IndexedDB does not synchronize across devices.
=======
## Local experimental features

The API-key Generate page and its Gemini/OpenAI/Claude routes are removed from the app. Their sources and integration snapshots are kept locally in `.experimental/generate/`, excluded by Git and Vercel ignore rules. They are not included in builds or served by the active local server. Copy CBQ/flashcard prompts, the question-to-ChatGPT action, and Prompt Lab remain available. The Notes redirect and its navigation shortcut have also been removed.
>>>>>>> feature-member1

On Mac, use **Option+1–5** for page navigation, **Option+I** to import a quiz, **Option+M** for the mobile menu, **Option+X** to export, and **Option+S** to save the current session. **Cmd+Enter** loads pasted quizzes/decks or saves flashcard edits; **Cmd+Z** undoes a flashcard rating. Option shortcuts use physical key codes so macOS symbols do not break navigation. Shortcut help displays Mac labels automatically. Windows/Linux retain Alt navigation and Ctrl actions; standard browser shortcuts remain available.

<<<<<<< HEAD
```text
.
├── index.html                 # Home, Exam, Results, Plan, Flashcards, and Settings views
├── app.js                     # Quiz, results, planning, and study workflows
├── styles.css                 # Main application layout and components
├── css/
│   ├── flashcards.css         # Advanced deck, study, and library views
│   ├── cbq-review-preview.css # Quiz mistake/marked-question preview
│   ├── library-storage.css    # IndexedDB status and local-data controls
│   └── nonflashcard-features.css
├── js/
│   ├── flashcards-core.js     # Deck validation and spaced-repetition scheduler
│   ├── flashcard-library.js   # Date-indexed deck and review collections
│   ├── flashcards.js          # Flashcard UI, imports, study, and quiz integration
│   ├── cbq-review-preview.js  # Read-only review of marked questions and mistakes
│   ├── plan-review-queue.js   # Due-card and quiz-review queue
│   ├── library-storage.js     # IndexedDB library, migration, and transactions
│   └── keyboard-shortcuts.js  # Platform-aware shortcut labels
├── flashcard-seed-prompt.txt  # Prompt for generating importable flashcard decks
├── prompt-lab.js              # Prompt editing and import/export
└── README.md                  # Project overview and usage instructions
```
=======
Continue studying includes a keyword search across saved quiz titles and question content. Choose Title & content, Title only, or Content only. Multiple keywords must all match; matching titles come first. Searching without a calendar date includes prior loaded quizzes and completed results, preferring a resumable session for each quiz. A selected date limits the search to that day's history. Questions, options, matching prompts, sections and hints are searchable; explanations are searchable for Practice/completed work. Unsubmitted Exam explanations and correct answers stay hidden. Clear the search to return to in-progress sessions. **Option+F** on Mac / **Alt+F** elsewhere opens this search.
>>>>>>> feature-member1

The study app works on a static HTTP server. Run `npm run dev` for local project prompt-file saving.

## Editing the interface

Edit `views/index.html`, `views/settings.html`, and the HTML partials in `views/partials/`.
Run `npm run build` to regenerate `index.html` and the deployable `public/` folder. The template build uses Node's
built-in modules and requires no dependencies. Keep the generated file checked in.

The prompt library has its own scoped stylesheet at `css/prompt-library.css`.
Its markup deliberately avoids the compact settings-row and global sidebar classes.
Theme colors and gradients are defined in `css/themes.css`.
Interface sizing is in `css/interface.css`; the home study calendar and cards use
`js/study-dashboard.js` and `css/study-dashboard.css`. Study activity is backed up
alongside sessions and results, and included in data exports.
Button hierarchy and icon accents are maintained in `css/controls.css`.
Prompt Lab has three **Originals**: CBQ prompt (the hero copy action), Flashcard prompt (hero and Flashcards copy actions), and Question payload (Quiz → ChatGPT). Editing and saving these changes their respective actions. **Restore original** restores the selected slot from `original-prompts.json`. Selecting or creating an **Experimental** slot only changes the editor; it does not replace a hero or payload prompt. The initial experimental seeds live in `seed-prompts.json`.

Prompt Lab exposes only Save and Copy beside the editor. Unsaved changes are retained in browser drafts; Copy copies the editor text, while hero actions use saved original text. With `npm run dev`, saving, restoring, importing or deleting a prompt writes the saved collection to `prompt-library.json` in the project folder through the local-only `/api/prompts` route. The write uses an atomic temporary-file rename; shipped originals stay in their separate JSON file for restoration. The local file loads on startup and contains prompts only. On Vercel/static hosting, edits save to IndexedDB; the small **⋯** menu offers Export JSON / Import JSON for a portable `prompt-library.json` file. Browser data resets do not delete a project prompt file.

## Flashcards

Plan now includes a **Review queue** for due flashcards and the latest quiz attempt's mistakes and marked questions. Exam answers become available after submission. Quiz reviews open as flashcard previews; reveal the answer and choose **Reviewed** to clear a card from the queue without creating a deck or changing quiz answers. Review completion is saved in IndexedDB and included in library JSON backups. Due flashcard reviews use the existing rating schedule.

The Plan page keeps reviews and planned quizzes in its main column, with the calendar and tasks alongside it. **Plan quiz** opens the JSON editor in a dialog; Ctrl/Cmd+Enter opens it from Plan and schedules the pasted quiz from inside it. Selecting a calendar day opens Date details. The layout stacks on small screens. Edit this page in `views/planner.html`.

On the Quiz page, **⋯ → Delete question** removes an irrelevant question from the current quiz and saved session, keeping the remaining answers and review marks aligned. Deleting the last question removes that session. Completed results remain historical snapshots. Planned quizzes use equal-height rows and fixed Start buttons, with ten quizzes per side-by-side column; scroll horizontally when the columns exceed the available width.

Open **Flashcards → Add a deck** to paste JSON or import a file. Copy the generation prompt or try the sample deck from the importer. Edit the original Flashcard prompt in Settings → Prompt Lab; shipped defaults live in `original-prompts.json`.

The flashcard library groups decks by date, newest first. Its calendar marks dates with saved decks; select a day, jump to a date, or choose All dates. **Your decks** contains imported decks. **Saved CBQ reviews** separately contains flashcards saved from quiz questions, grouped by source quiz. Study and Browse use the same existing scheduling controls. New CBQ cards update the group's saved date; ratings do not move its date. The existing Saved quiz explanations deck appears in this area with its cards and schedules preserved. Deck category and source metadata are included in full library backups.

```json
{"name":"My topic","cards":[{"front":"Why does this work?","back":"A short answer and explanation.","tags":["reasoning"]}]}
```

<<<<<<< HEAD
After loading, the Exam page shows the question, answer choices, timer, section navigator, and **Show hint** control. In Practice mode, checking or revealing the answer displays feedback and the explanation. Submitting a quiz saves the result locally and opens its detailed Results view.
=======
Import previews validate every card before saving. Adding to a saved deck skips exact front/back duplicates and preserves review progress. Markdown and LaTeX are supported; escape LaTeX backslashes in JSON. Browse and practice-all preserve source order unless shuffled.
>>>>>>> feature-member1

Review due and new cards in small sessions. Flip between question and answer with Space, Enter, or the flip button, then rate Again, Hard, Good or Easy with keys 1–4. New cards return in 1 minute, 10 minutes, 1 day or 4 days respectively. Successful later reviews increase the interval; Again returns a card to learning. A card appears once per session, and overdue reviews come before new cards. Browse does not change scheduling. Editing a card's content resets its schedule. Reduced-motion preferences disable the flip animation.

<<<<<<< HEAD
| Shortcut | Action |
|---|---|
| `Alt+1`–`Alt+5` | Open Home, Exam, Plan, Settings, or Flashcards |
| `Alt+I` | Open the quiz importer |
| `Alt+S` | Save the current session |
| `F` | Save the checked Practice question or selected Results question as a flashcard |
| `Shift+S` | Submit the quiz |
| `Shift+E`, `Shift+P` | Switch to Exam or Practice mode |
| `1`–`4` | Select a multiple-choice answer |
| `←` / `→`, `B` / `N` | Previous or next question |
| `C` | Copy the current question |
| `V`, `R`, `P` | View answer, mark for review, or open question progress |
| `G` | Open the current question in ChatGPT |
| `Esc` | Close an open dialog or question palette |
=======
Deck session settings and management are under **Options**. Press **?** for shortcut help, **U** to undo a rating, **B** to return to decks, **N** to add a deck, and **C** to copy the schema from the library. In Browse, use the arrow keys to move and **E** to edit. Ctrl/Cmd+Enter opens the importer, pastes the latest clipboard JSON and loads the deck in one press, or saves card edits; text fields retain normal typing and undo behavior.
>>>>>>> feature-member1

Ratings save immediately; returning to the page or reloading resumes the active session. Undo reverses the most recent rating in the current visit. Quiz practice answers and completed result reviews have a **Save as flashcard** button for a shared explanations deck. Review activity appears in the home study calendar.

<<<<<<< HEAD
Quiz sessions, results, preferences, study activity, flashcard decks, review schedules, review receipts, and planner data are stored locally in IndexedDB when available. The first launch migrates existing localStorage data and eligible recovery snapshots before removing migrated cache entries; basic question/answer cards are converted into an advanced deck without dropping duplicate cards. JSON imports are validated and saved in one transaction, and exports include deck progress and quiz-review receipts. Use **Settings → Local data** to export a backup or import one into this browser. Clearing browser site data can remove locally stored information; keep a JSON export if you need a portable backup. The app does not require an account or provide automatic cross-device synchronization.
=======
Press **F** to save a revealed/verified practice question or the selected question in completed results. The shortcut does not interrupt text entry. Navigation follows page order: **Alt+1** Home, **Alt+2** Quiz, **Alt+3** Flashcards, **Alt+4** Plan, **Alt+5** Settings.
>>>>>>> feature-member1

Data is stored in this browser, included in persistent recovery and Settings data backups. Deck export contains portable content; the full app export also includes scheduling and activity. There is no account or automatic cross-device sync.

Continue studying offers **Flashcard preview** when a saved CBQ has marked questions or confirmed mistakes. Filter by All to review, Marked, or Mistakes; overlapping questions appear once in source order. Practice mistakes require a verified answer; unanswered questions are not mistakes. Completed results also offer previews through the study calendar. Unsubmitted Exam sessions keep answers hidden until submission. Flip with Space/Enter, browse with arrows, and close with Escape. This temporary preview creates no deck, saves no ratings or scheduling, and leaves quiz answers and review marks unchanged. Closing discards the preview position.

The page uses `views/flashcards.html`, `css/flashcards.css`, and `js/flashcards.js`. The pure data/scheduling module is `js/flashcards-core.js`. Run `npm test`; see `tests/README.md` for browser checks.

## Deploying

Vercel runs `npm run build` and serves `public/`, as configured in `vercel.json`.
The build copies the generated page, JavaScript, stylesheets, and prompt library into that folder. Experimental AI files are excluded.
Run `npm run dev` for the local study app and prompt-file saving. For a static preview, run `python -m http.server 8000 --directory public` after building.

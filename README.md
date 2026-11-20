# ExamFlow

**ExamFlow** is a lightweight, browser-based study and quiz app built around **Concept Breakdown Quizzes (CBQs)**. It turns a topic into a sequence of questions learners can work through in Exam or Practice mode, then keeps their progress and preferences in the browser.

- **Live app:** [Open ExamFlow on GitHub Pages](https://field-access.github.io/QuizManagement/)
- **Source repository:** [field-access/QuizManagement](https://github.com/field-access/QuizManagement)

## Objectives

- Make it easy to load a quiz from JSON or a file and begin studying.
- Support different question formats, hints, explanations, images, and mathematical notation.
- Provide both timed assessment and answer-revealing practice workflows.
- Help learners track study activity, plan CBQs, set goals, and resume saved sessions.
- Keep quiz data durable and portable with IndexedDB storage and JSON backups.

## Team and contributions

This project was developed for the SEC101: MCA group assignment, **Project Development Using Git, GitHub and Markdown**, in Advanced Tools and Applications.

| Team member | Contribution |
|---|---|
| Nishant Sagar (Roll No. 41) | Worked on the `feature-member1` branch. Visible commit messages include quiz-page Markdown features and prompt-lab settings, continuing previous quizzes with inline LaTeX integration, and a README update. |
| Tenzin Yangdon (Roll No. 76) | Worked on member 2 / flashcard changes. The repository history includes the `feature-member2` branch and a merge commit for member 2 flashcard changes. |

The repository history also records merge commits for pull requests 1 and 2. Branch and commit evidence is summarized from the project team's submitted screenshots; those screenshots do not show individual PR review pages.

==
| `Nishant sagar ` | `[implemented json based quiz system, storage and settings page]` |
| `Tenzin yangdon ` | `[impleneted flashcard system, helped in conflict resolution]` |

## Features

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

## Technologies

| Technology | Use |
|---|---|
| HTML5 | Page structure and accessible controls |
| CSS3 | Layout, responsive styling, and themes |
| JavaScript (vanilla) | Quiz, results, planning, settings, and spaced-repetition workflows |
| IndexedDB | Primary local library for quizzes, flashcards, sessions, results, and planner data |
| Local Storage | One-time migration source and fallback when IndexedDB is unavailable |
| KaTeX | Rendering mathematical expressions |

The app has no build step or package installation requirement. KaTeX and the selected web fonts are loaded from external CDNs, so an internet connection is needed for those resources. Quiz data remains in the current browser profile; IndexedDB does not synchronize across devices.

## Project structure

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

## Installation and execution

### Requirements

- A modern browser (such as Chrome, Firefox, Edge, or Safari).
- Python 3 for the optional local web server. No third-party Python or Node packages are required.

### Run locally

1. Download or clone the repository.
2. Open a terminal in the project directory.
3. Start a local static server:

   **Windows PowerShell**

   ```powershell
   py -m http.server 8000
   ```

   If `py` is unavailable, use `python -m http.server 8000`. On macOS or Linux, use the same `python3 -m http.server 8000` command if Python is installed as `python3`.

4. Open [http://localhost:8000](http://localhost:8000) in your browser.
5. On **Home**, paste a CBQ JSON document or choose a JSON file, then select **Load & Start**.

## Git and GitHub collaboration

The project was developed collaboratively using Git branches and GitHub. The submitted terminal history shows the `feature-member1` and `feature-member2` branches, remote feature branches, merge commits for pull requests #1 and #2, and merges of feature work into `main`. A commit graph was captured with `git log --oneline --graph --all`.

The team also captured a merge-conflict episode involving project files, followed by use of the VS Code merge editor for `styles.css`. The available screenshots include both in-progress conflict output and the merge editor; they do not independently verify the final conflict-resolution commit or show the PR review pages. Add those GitHub screenshots if they are required as separate submission evidence.

See the accompanying `CONTRIBUTING.md` for the team's branch, pull-request, and review workflow.

To stop the server, focus its terminal and press **Ctrl+C**.

## Sample quiz and output

Paste this small example into the Home page to try a quiz with a section, hint, and explanation:

```json
{
  "name": "Force Basics",
  "durationMinutes": 5,
  "sections": [
    {
      "name": "Physics",
      "questions": [
        {
          "type": "mcq",
          "question": "Which unit measures force?",
          "options": ["Watt", "Newton", "Joule"],
          "answer": "B",
          "hint": "It is named after Isaac Newton.",
          "explanation": "Force is measured in newtons (N)."
        }
      ]
    }
  ]
}
```

After loading, the Exam page shows the question, answer choices, timer, section navigator, and **Show hint** control. In Practice mode, checking or revealing the answer displays feedback and the explanation. Submitting a quiz saves the result locally and opens its detailed Results view.

## Keyboard shortcuts

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

## Data and privacy

Quiz sessions, results, preferences, study activity, flashcard decks, review schedules, review receipts, and planner data are stored locally in IndexedDB when available. The first launch migrates existing localStorage data and eligible recovery snapshots before removing migrated cache entries; basic question/answer cards are converted into an advanced deck without dropping duplicate cards. JSON imports are validated and saved in one transaction, and exports include deck progress and quiz-review receipts. Use **Settings → Local data** to export a backup or import one into this browser. Clearing browser site data can remove locally stored information; keep a JSON export if you need a portable backup. The app does not require an account or provide automatic cross-device synchronization.

## Contributing

1. Make a focused change to the relevant HTML, CSS, or JavaScript file.
2. Check JavaScript syntax with `node --check app.js`.
3. Load the app in a browser and verify the affected flow, including a narrow/mobile viewport when relevant.
4. Keep documentation and this README in sync with user-visible changes.

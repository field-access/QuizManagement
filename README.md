# ExamFlow

**ExamFlow** is a lightweight, browser-based study and quiz app built around **Concept Breakdown Quizzes (CBQs)**. It turns a topic into a sequence of questions learners can work through in Exam or Practice mode, then keeps their progress and preferences in the browser.

## Objectives

- Make it easy to load a quiz from JSON or a file and begin studying.
- Support different question formats, hints, explanations, images, and mathematical notation.
- Provide both timed assessment and answer-revealing practice workflows.
- Help learners navigate questions, track progress, and resume saved sessions.
- Keep the app focused on its core **Home**, **Exam**, and **Settings** pages.

## Team and contributions

Team member names were not included in the repository. Replace the placeholders below with the project team's actual names and contributions before submitting or publishing this README.

| Team member | Contribution |
|---|---|
| `[Member name]` | `[Describe their design, implementation, testing, or documentation work]` |
| `[Member name]` | `[Describe their design, implementation, testing, or documentation work]` |

## Features

- **Quiz loading:** paste JSON, paste from the clipboard, or select a `.json` file.
- **Question formats:** multiple choice, true/false, fill in the blank, matching, drag-and-drop matching, ordering, and image-based questions.
- **Exam mode:** timed quizzes, answer tracking, marking questions for review, and submission with a saved result.
- **Practice mode:** check answers, reveal correct answers, and review explanations.
- **Question tools:** section-aware question navigation, expandable hints, copy or remove a question, and keyboard shortcuts.
- **Progress and recovery:** save and resume quiz sessions in the browser.
- **Personalization:** choose appearance, color theme, font, question text size, exam width, sounds, and default quiz duration.
- **Local data controls:** export, import, reset, and protect browser data.
- **Math and text rendering:** display LaTeX with [KaTeX](https://katex.org/).

## Technologies

| Technology | Use |
|---|---|
| HTML5 | Page structure and accessible controls |
| CSS3 | Layout, responsive styling, and themes |
| JavaScript (vanilla) | Quiz behavior, settings, and local persistence |
| Local Storage | Fast storage of app settings and quiz data |
| IndexedDB | Persistent local backup and recovery |
| KaTeX | Rendering mathematical expressions |

The app has no build step or package installation requirement. KaTeX and the selected web fonts are loaded from external CDNs, so an internet connection is needed for those resources.

## Project structure

```text
.
├── index.html    # Home, Exam, and Settings markup
├── app.js        # Quiz logic, navigation, persistence, and settings
├── styles.css    # Application layout, components, and responsive themes
└── README.md     # Project overview and usage instructions
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

After loading, the Exam page shows the question, answer choices, timer, section navigator, and **Show hint** control. In Practice mode, checking or revealing the answer displays feedback and the explanation. Submitting a quiz saves the result locally.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+1`, `Alt+2`, `Alt+3` | Open Home, Exam, or Settings |
| `Alt+I` | Open the quiz importer |
| `Alt+S` | Save the current session |
| `Shift+S` | Submit the quiz |
| `Shift+E`, `Shift+P` | Switch to Exam or Practice mode |
| `1`–`4` | Select a multiple-choice answer |
| `←` / `→`, `B` / `N` | Previous or next question |
| `C` | Copy the current question |
| `V`, `R`, `P` | View answer, mark for review, or open question progress |
| `G` | Open the current question in ChatGPT |
| `Esc` | Close an open dialog or question palette |

## Data and privacy

Quiz sessions, results, and preferences are stored locally in the browser. Use **Settings → Local data** to export a backup or import one into this browser. Clearing browser site data can remove locally stored information; keep a JSON export if you need a portable backup. The app does not require an account or provide automatic cross-device synchronization.

## Contributing

1. Make a focused change to the relevant HTML, CSS, or JavaScript file.
2. Check JavaScript syntax with `node --check app.js`.
3. Load the app in a browser and verify the affected flow, including a narrow/mobile viewport when relevant.
4. Keep documentation and this README in sync with user-visible changes.

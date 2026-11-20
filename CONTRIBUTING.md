# Contributing to ExamFlow

ExamFlow was developed collaboratively for the SEC101: MCA assignment, **Project Development Using Git, GitHub and Markdown**.

## Team contributions

| Contributor | Roll number | Branch and documented work |
|---|---:|---|
| Nishant Sagar | 41 | Worked on `feature-member1`.  a quiz-page upgrade with Markdown features and Prompt Lab in Settings, continuing previous quizzes with inline LaTeX integration, and a README update. |
| Tenzin Yangdon | 76 | Worked on `feature-member2` / flashcard changes. save to flashcard from quiz questions. | Worked on prompt settings| backup and json download options| contributing.md updates|

These descriptions reflect the branch names and commit messages visible in the team's submitted Git screenshots. They should not be read as an exhaustive allocation of every code change.

## Branching workflow

1. Start from an up-to-date `main` branch.
2. Create a focused branch for your work. The assignment branches used were `feature-member1` and `feature-member2`.
3. Keep changes focused and commit them with messages that describe the work.
4. Push the branch to GitHub and open a pull request targeting `main`.
5. Ask the other team member to review the pull request. Address feedback before merging.
6. Merge the approved change into `main` and update your local branch.

The captured commit graph includes merge commits for pull requests #1 and #2. Screenshots also show merge activity for both member feature branches.

## Pull request reviews

Pull requests should explain the change, list the relevant features, and include steps used to check the app. Reviewers should check the affected quiz or flashcard flow, look for unintended changes, and leave actionable comments. The submitted screenshots show PR merge commits but do not show the review pages or review comments.

## Merge conflicts

When Git reports conflicts, inspect each affected file and compare both versions in the editor. Keep the intended changes from both branches where they are compatible, remove conflict markers, then stage and commit the resolved files. The submitted evidence shows conflicts during pulls/merges and the VS Code merge editor for `styles.css`; the screenshots do not conclusively show the final conflict-resolution commit.

## Local checks

- Open the app in a modern browser, preferably through a local static server.
- Exercise the changed workflow, including a narrow viewport where relevant.
- Check JavaScript syntax for changed files with `node --check <file.js>`.
- Update `README.md` when user-facing behavior, setup, or project structure changes.

## Repository links

- [Live ExamFlow application](https://field-access.github.io/QuizManagement/)
- [GitHub repository](https://github.com/field-access/QuizManagement)

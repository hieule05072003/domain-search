# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

- **Name:** {{PROJECT_NAME}}
- **Stack:** {{STACK}} (e.g., Next.js 16, React 19, TypeScript, Tailwind CSS 4)
- **Hosting:** {{HOSTING}} (e.g., Cloudflare Pages, Vercel, AWS)
- **Static export:** Update `next.config.ts` if using static export

## Build & Deploy

```bash
npm run dev      # Local dev server
npm run build    # Production build
npm run lint     # ESLint
```

- Environment variables: see `.env.example`

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read `./docs/project-overview-pdr.md` and `./docs/codebase-summary.md` first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
└── system-architecture.md
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*

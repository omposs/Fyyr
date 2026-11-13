# Fyyr

A hackathon project: a personalised search and opportunity service that Blue Science Park hosts and offers to its member companies and others interested in the park's areas.

## The idea

Companies need to follow their markets and technology areas and find relevant events, testbeds, funding and partners. Today that information is spread across many websites and channels. Fyyr collects it through APIs and scrapers, then shows each user what is relevant to them, explains why, and links to the source.

**Users:** Blue Science Park's 40+ member companies, outside companies interested in the park's fields, and park staff. Staff use it to spot shared interests and support collaboration.

## Core features

- **Profiling agent.** Builds a baseline profile of each member from public sources: products, technologies, markets, geography and priorities. Every item has a source and a date. Stated facts are kept separate from inferred interests, and companies can edit their own profile.
- **Monitoring modules.** Events, funding, testbeds, and trends or news, each ranked by relevance with a short "why this matters to you" explanation.
- **Collaboration suggestions.** Matches companies that may want to work together and explains the basis for each match.
- **Chat assistant.** Answers follow-ups and explains recommendations, with guardrails for scope, prompt injection and data access.

## Stack

- **Backend:** Python with FastAPI (agents, data sources, matching, guardrails)
- **AI:** Claude API (profiling, relevance judgement, summaries, chat)
- **Storage:** SQLite to start
- **Frontend:** JavaScript web app (React and Vite) that talks only to the backend

```
Fyyr/
├── backend/    # Python API, agents, sources, matching, guardrails
├── frontend/   # JavaScript web interface
└── data/       # e.g. members.csv
```

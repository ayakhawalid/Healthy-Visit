# Healthy Visit

Healthy Visit is a web app that collects lifestyle and health-behaviour information from patients through a friendly chatbot instead of a long paper form. Patients answer a few short questions per day over a three-week study period, see their progress on a personal dashboard, and researchers can review the collected data.

The questions come from an official Hebrew health-behaviours questionnaire (see the `questionnaire/` folder). The app works in Hebrew and English.

## Tech stack

| Part | Technology |
|------|------------|
| Frontend | React 17, TypeScript, Material UI, Redux, React Router, Axios |
| Backend | Python, FastAPI, SQLAlchemy, Uvicorn |
| Database | SQLite (a local file, `backend/SQLite.db`, created on first run) |
| Authentication | JWT tokens (python-jose), bcrypt password hashing |
| Chatbot | OpenAI `gpt-4o-mini` through LangChain |

## User roles

- **Patient**: signs up, completes the onboarding chat, then answers the daily questions and adds daily metrics (sleep, nutrition, stress, and so on). The patient dashboard shows a check-in calendar, weekly metric circles, and a lifestyle radar chart of their answers.
- **Researcher**: has a read-only dashboard listing study patients, with each patient's daily metrics and lifestyle scores across the 21-day study window. Researcher accounts are created by an admin.
- **Admin**: manages user accounts, creates researcher accounts, and can grant or remove admin and researcher rights. The first admin is created from environment variables (see "How to run").

## How the chatbot works

The chatbot runs in two stages:

1. **Onboarding** (right after signup). The bot greets the patient, asks for height and weight, then asks a short set of background questions from the questionnaire. Height and weight are saved to the patient profile and the answers are saved as questionnaire answers.
2. **Daily questions** (during the three-week study). Each day the patient gets up to 5 questions from the questionnaire. A question that is skipped or left unanswered comes back after a few days, so the patient is never pushed to answer everything at once. The patient can also choose "not today" to stop for the day.

For each question, the language model rewrites the formal questionnaire item as a natural, conversational question, then reads the patient's free-text reply and converts it into a structured answer (for example a number, a yes/no, or one of the multiple-choice options). Simple values such as "170 cm and 70 kg" are parsed directly with rules, without relying on the model.

The model never decides what is asked or how answers are scored: the question list, order, and scoring come from the questionnaire catalog in `backend/official_q/`. If no OpenAI key is configured or the API is unreachable, the bot falls back to scripted wording, so the app still works without AI.

## How to run

You need Python 3.9 or newer and Node.js 18 or newer.

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill in:

- `JWT_SECRET_KEY`: required. Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`.
- `OPENAI_API_KEY`: optional. Without it the chatbot uses scripted questions.
- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: the first admin account, created on startup only if no admin exists yet.

Then start the server from the `backend` folder:

```bash
python server.py
```

The API runs at http://localhost:9999 and the interactive API docs are at http://localhost:9999/api/docs.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm start
```

The app opens at http://localhost:3000. Sign in with the admin account from your `.env`, or sign up as a new patient.

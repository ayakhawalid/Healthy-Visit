## FANTASTIC Health Bot

This project turns the **FANTASTIC lifestyle questionnaire** into a conversational chatbot that collects answers naturally, scores them, and provides personalized lifestyle advice.

### Features

- **Phase 1**: Questionnaire structure in JSON with English and Hebrew support
- **Phase 2**: Python/FastAPI backend with accurate scoring logic
- **Phase 3**: OpenAI integration for personalized lifestyle advice
- **Phase 4**: Conversational interface that collects answers naturally (not like a form)
- **Phase 5**: LangChain integration for conversation memory
- **Phase 6**: Web-based chat UI

### Project Status

The chatbot conducts a natural conversation with patients, collecting FANTASTIC questionnaire answers without feeling like a questionnaire. After all questions are answered, it provides scoring, interpretation, and personalized lifestyle coaching.

### Tech stack

- **Language**: Python
- **Web framework**: FastAPI
- **Runtime server**: Uvicorn

### Setup

1. **Clone the repository** (if you haven't already):
```bash
git clone <your-repo-url>
cd fantastic-health-bot
```

2. **Create and activate a virtual environment**:
```bash
python -m venv .venv
source .venv/Scripts/activate  # on Windows Git Bash
# or: .venv\Scripts\activate   # on Windows cmd/PowerShell
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Set up environment variables**:
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

5. **Run the FastAPI app**:
```bash
uvicorn app.main:app --reload
```

6. **Access the application**:
- Chat UI: `http://127.0.0.1:8000/`
- API Docs: `http://127.0.0.1:8000/docs`
- Debug endpoint: `http://127.0.0.1:8000/debug-session/{session_id}`

### Questionnaire data model

The questionnaire is stored in `app/fantastic_questions.json` with a structure like:

```json
{
  "questions": [
    {
      "question_id": "F1",
      "domain": "Family & Friends",
      "english_text": "I feel close to my family.",
      "hebrew_text": "אני מרגיש/ה קרבה למשפחה שלי.",
      "options": [
        "Almost never",
        "Rarely",
        "Sometimes",
        "Often",
        "Almost always"
      ],
      "scores": [0, 1, 2, 3, 4]
    }
  ]
}
```

You will need to fill in all official FANTASTIC questions, domains, and options based on the PDFs you have, keeping **exactly 5 options and 5 scores per question**.

### API Endpoints

- `GET /questionnaire` - Get the full questionnaire structure
- `POST /score` - Score answers and get results
- `POST /score-and-advice` - Score answers and get AI-generated advice
- `POST /chat` - Conversational endpoint (main chat interface)
- `GET /debug-session/{session_id}` - Debug endpoint to see stored answers

### Safety notes

- The backend and any AI advice **must not diagnose** medical conditions.
- Advice should stay **generic** (e.g., "consider talking to your doctor about exercise") and avoid emergencies or specific treatment instructions.
- All prompts include explicit safety instructions to prevent medical diagnosis.

### License

This project is for educational/healthcare purposes. The FANTASTIC Lifestyle Assessment is © 1985 Dr. Douglas Wilson, Department of Family Medicine, McMaster University.


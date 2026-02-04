from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv
from langchain.memory import ConversationBufferMemory
try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

from .models import Question
from .scoring import QUESTIONNAIRE, interpret_score, score_answers
from .advice import ADVICE_SYSTEM_PROMPT


load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


@dataclass
class SessionState:
    session_id: str
    current_index: int = 0
    answers: Dict[str, int] = field(default_factory=dict)
    language: str = "en"  # "en" or "he"
    mode: str = "collecting"  # or "post_results_chat"
    last_score_summary: Optional[Dict] = None
    conversation_memory: Optional[ConversationBufferMemory] = None
    llm: Optional[ChatOpenAI] = None
    started: bool = False  # whether we've already sent the first domain intro


SESSIONS: Dict[str, SessionState] = {}
QUESTIONS_BY_ID: Dict[str, Question] = {
    q.question_id: q for q in QUESTIONNAIRE.questions
}


def _get_or_create_session(session_id: Optional[str], language: str = "en") -> SessionState:
    if session_id and session_id in SESSIONS:
        return SESSIONS[session_id]

    new_id = session_id or str(uuid.uuid4())
    
    # Initialize LangChain components
    memory = ConversationBufferMemory(
        return_messages=True,
        memory_key="chat_history"
    )
    
    llm = None
    if OPENAI_API_KEY and ChatOpenAI:
        try:
            # Set environment variable for LangChain to pick up
            os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
            llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.7,
            )
        except Exception:
            # Fallback: will use direct API calls
            llm = None
    
    state = SessionState(
        session_id=new_id,
        language=language,
        conversation_memory=memory,
        llm=llm,
    )
    SESSIONS[new_id] = state
    return state


def _next_question(state: SessionState) -> Optional[Question]:
    if state.current_index >= len(QUESTIONNAIRE.questions):
        return None
    return QUESTIONNAIRE.questions[state.current_index]


def _domain_has_answer(state: SessionState, domain: str) -> bool:
    for qid in state.answers.keys():
        q = QUESTIONS_BY_ID.get(qid)
        if q and q.domain == domain:
            return True
    return False


def _get_conversational_agent_prompt(question: Question, language: str, state: SessionState) -> str:
    """Create a system prompt that guides the agent to have a natural conversation."""
    domain = question.domain
    first_in_domain = not _domain_has_answer(state, domain)
    
    question_text = question.english_text if language == "en" else question.hebrew_text
    
    if first_in_domain:
        # First question in a domain - broad intro
        if language == "he":
            base_prompt = (
                "את/ה מאמן/ת אורח חיים חם ומקצועי. "
                "את/ה מתחיל/ה שיחה על תחום חיים חדש. "
                "התחום הוא: {domain}. "
                "התחל/י בשיחה טבעית ופתוחה על התחום הזה, בלי להזכיר 'שאלון' או 'פריט'. "
                "שאל/י שאלה אחת פתוחה ומזמינה שמתחילה את השיחה על התחום הזה."
            )
        else:
            base_prompt = (
                "You are a warm, professional lifestyle coach. "
                "You are starting a conversation about a new life area. "
                "The area is: {domain}. "
                "Begin with a natural, open conversation about this area, without mentioning 'questionnaire' or 'item'. "
                "Ask ONE inviting, open-ended question that starts the conversation about this area."
            )
        return base_prompt.format(domain=domain)
    else:
        # Follow-up in same domain
        if language == "he":
            return (
                "את/ה ממשיך/ה את השיחה על התחום: {domain}. "
                "עכשיו את/ה רוצה לחקור היבט ספציפי יותר: \"{aspect}\". "
                "המשך/י בשיחה טבעית, שאל/י שאלה אחת קצרה ומזמינה על ההיבט הזה, "
                "בלי לחזור על הטקסט המילולי של ההיבט."
            ).format(domain=domain, aspect=question_text)
        else:
            return (
                "You are continuing the conversation about: {domain}. "
                "Now you want to explore a more specific aspect: \"{aspect}\". "
                "Continue naturally, ask ONE short, inviting question about this aspect, "
                "without repeating the literal wording of the aspect."
            ).format(domain=domain, aspect=question_text)


def _normalize_answer_to_option(
    question: Question, user_message: str, language: str, conversation_history: List[str]
) -> int:
    """
    Use LangChain to map free text to one of the question's options by index.
    Uses conversation history for better context understanding.
    """
    if not OPENAI_API_KEY:
        return max(0, (len(question.options) - 1) // 2)

    options = question.options
    options_text = "\n".join(f"{i}: {opt}" for i, opt in enumerate(options))
    question_text = question.english_text if language == "en" else question.hebrew_text

    # Build context from recent conversation
    context = ""
    if conversation_history:
        context = "Recent conversation context:\n" + "\n".join(conversation_history[-3:]) + "\n\n"

    if language == "he":
        system_prompt = (
            "את/ה עוזר/ת שממפה תשובה חופשית לאחת מהאפשרויות המוגדרות מראש. "
            "ענה/י רק במספר שלם: האינדקס של האפשרות הכי מתאימה (0-{max_idx}). "
            "אל תכלול/י מילים אחרות."
        ).format(max_idx=len(options) - 1)
        
        user_content = (
            f"{context}"
            f"שאלה: {question_text}\n"
            f"אפשרויות זמינות (אינדקס: טקסט):\n{options_text}\n\n"
            f"תשובת המשתמש בטקסט חופשי:\n{user_message}\n\n"
            "ענה/י עם האינדקס (0-{max_idx}) של האפשרות שהכי מתאימה."
        ).format(max_idx=len(options) - 1)
    else:
        # Determine if this is a "reverse" question (where higher index = better)
        # Most questions: index 0 = worst, index max = best
        # But we need to be explicit about what "best" means for each question type
        is_negative_question = any(word in question_text.lower() for word in [
            "excess", "overuse", "smoke", "drugs", "drive after drinking",
            "tense", "sad", "depressed", "angry", "hostile", "hurry"
        ])
        
        guidance = ""
        if is_negative_question:
            guidance = (
                "IMPORTANT: This question asks about something NEGATIVE (like smoking, excess, problems). "
                "For negative questions: index 0 = worst (most of the problem), index {max_idx} = best (least/none of the problem). "
                "If the user says they DON'T do this or have NONE of this, choose index {max_idx} (the highest index)."
            ).format(max_idx=len(options) - 1)
        else:
            guidance = (
                "IMPORTANT: This question asks about something POSITIVE (like healthy habits, good things). "
                "For positive questions: index 0 = worst (almost never/least), index {max_idx} = best (almost always/most). "
                "If the user says they DO this often or have a lot of this, choose index {max_idx} (the highest index)."
            ).format(max_idx=len(options) - 1)
        
        system_prompt = (
            "You are a helper that maps a free-text answer to one of the predefined options. "
            "{guidance}\n\n"
            "Only respond with a single integer: the index of the best matching option (0-{max_idx}). "
            "Do not include any other words."
        ).format(guidance=guidance, max_idx=len(options) - 1)
        
        user_content = (
            f"{context}"
            f"Question: {question_text}\n"
            f"Available options (index: text):\n{options_text}\n\n"
            f"User's free-text answer:\n{user_message}\n\n"
            "{guidance}\n\n"
            "Respond with the index (0-{max_idx}) of the option that best matches."
        ).format(guidance=guidance, max_idx=len(options) - 1)

    try:
        # Use direct API call to avoid LangChain version conflicts
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.3,
        }
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        index_str = data["choices"][0]["message"]["content"].strip()
        idx = int(index_str)
        if idx < 0 or idx >= len(options):
            raise ValueError("index out of range")
        return idx
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            # Rate limited - return middle option as fallback
            return max(0, (len(options) - 1) // 2)
        raise
    except Exception:
        return max(0, (len(options) - 1) // 2)


def handle_chat_message(
    session_id: Optional[str], user_message: str, language: str = "en"
) -> Tuple[str, SessionState]:
    """
    Core conversational state machine with LangChain memory:
    - If collecting: have a natural conversation, acknowledge what user said,
      then gently guide to cover the current FANTASTIC item, store answer, advance.
    - If post_results_chat: use LangChain with memory to answer questions about results.
    """
    state = _get_or_create_session(session_id, language)
    
    if not OPENAI_API_KEY:
        return (
            "AI service is not configured. Please set OPENAI_API_KEY in your .env file.",
            state,
        )

    # Post-results chat mode
    if state.mode == "post_results_chat" and state.last_score_summary:
        summary = state.last_score_summary
        
        # Build context about their scores
        score_context = (
            f"Overall score: {summary['percentage']:.1f}% ({summary['grade_label']})\n"
            f"Domain breakdown:\n"
        )
        for domain, domain_data in summary.get("domains", {}).items():
            pct = 0.0 if domain_data["max_score"] == 0 else (domain_data["raw_score"] / domain_data["max_score"]) * 100.0
            score_context += f"- {domain}: {pct:.1f}%\n"
        
        # Use direct API call with memory for post-results conversation
        try:
            # Get conversation history
            history = []
            if state.conversation_memory:
                history = state.conversation_memory.chat_memory.messages
            
            # Build messages for LLM
            messages = [
                {"role": "system", "content": ADVICE_SYSTEM_PROMPT + "\n\n" + score_context}
            ]
            
            # Add history (convert LangChain messages to dict format)
            for msg in history:
                if hasattr(msg, 'type'):
                    if msg.type == "human":
                        messages.append({"role": "user", "content": msg.content})
                    elif msg.type == "ai":
                        messages.append({"role": "assistant", "content": msg.content})
            
            # Add current user message
            messages.append({"role": "user", "content": user_message})
            
            # Call OpenAI API directly
            payload = {
                "model": "gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
            }
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
            
            # Save to memory
            if state.conversation_memory:
                state.conversation_memory.chat_memory.add_user_message(user_message)
                state.conversation_memory.chat_memory.add_ai_message(reply)
            
            return reply, state
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return (
                    "I'm getting a lot of requests right now. Please wait a moment and try again. "
                    "This usually resolves in a few seconds.",
                    state,
                )
            return (
                f"There was a problem: {str(e)}. You can still discuss these results with your healthcare provider.",
                state,
            )
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            return (
                f"There was a problem: {str(e)}. You can still discuss these results with your healthcare provider.",
                state,
            )

    # Collecting mode: natural conversation that covers FANTASTIC items
    current_q = _next_question(state)
    
    if current_q is None:
        # All questions answered - compute scores
        if state.last_score_summary is None:
            total, max_score, pct, domains = score_answers(state.answers)
            label = interpret_score(pct)
            state.last_score_summary = {
                "total_score": total,
                "max_score": max_score,
                "percentage": pct,
                "grade_label": label,
                "domains": domains,
            }
            state.mode = "post_results_chat"
            
            # Generate initial advice
            from .advice import generate_advice
            from .models import ScoreResponse, DomainScore
            
            domain_scores_dict = {}
            for domain, domain_data in domains.items():
                domain_scores_dict[domain] = DomainScore(
                    domain=domain,
                    raw_score=domain_data["raw_score"],
                    max_score=domain_data["max_score"],
                )
            
            score_response = ScoreResponse(
                total_score=total,
                max_score=max_score,
                percentage=pct,
                grade_label=label,
                domain_scores=domain_scores_dict,
            )
            
            advice_text = generate_advice(score_response)
            
            completion_message = (
                f"Thanks for sharing all of that with me. "
                f"Based on our conversation, your overall lifestyle score is about "
                f"{pct:.1f} out of 100, which falls in the '{label}' range.\n\n"
                f"{advice_text}\n\n"
                f"I'm here if you'd like to discuss any of this further or have questions."
            )
            
            # Save to memory
            if state.conversation_memory:
                state.conversation_memory.chat_memory.add_ai_message(completion_message)
            
            return completion_message, state
        
        # Already computed, switch to post-results
        state.mode = "post_results_chat"
        return handle_chat_message(state.session_id, user_message, language)

    # Build a conversational prompt that guides the agent
    agent_prompt = _get_conversational_agent_prompt(current_q, language, state)
    
    # Get conversation history for context
    history = state.conversation_memory.chat_memory.messages if state.conversation_memory else []
    
    # Create a prompt that makes the agent respond naturally AND cover the current item
    if language == "he":
        system_message = (
            "את/ה מאמן/ת אורח חיים חם ומקצועי. "
            "את/ה מנהל/ת שיחה טבעית עם מישהו על אורח החיים שלו. "
            "כל תשובה שלך צריכה:\n"
            "1. להכיר ולהבין את מה שהמשתמש אמר\n"
            "2. להגיב באופן טבעי וחם\n"
            "3. לכסות בעדינות את ההיבט הנוכחי שאת/ה צריך לחקור\n\n"
            "הוראה ספציפית: {agent_prompt}"
        )
    else:
        system_message = (
            "You are a warm, professional lifestyle coach. "
            "You are having a natural conversation with someone about their lifestyle. "
            "Each of your responses should:\n"
            "1. Acknowledge and understand what the user just said\n"
            "2. Respond naturally and warmly\n"
            "3. Gently cover the current aspect you need to explore\n\n"
            "Specific instruction: {agent_prompt}"
        )
    
    # First turn: start the conversation
    if not state.started and state.current_index == 0 and not state.answers:
        try:
            # Build messages for first greeting
            messages = [
                {"role": "system", "content": system_message.format(agent_prompt=agent_prompt)},
                {"role": "user", "content": user_message}
            ]
            
            # Call OpenAI API directly
            payload = {
                "model": "gpt-4o-mini",
                "messages": messages,
                "temperature": 0.7,
            }
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
            
            # Save to memory
            if state.conversation_memory:
                state.conversation_memory.chat_memory.add_user_message(user_message)
                state.conversation_memory.chat_memory.add_ai_message(reply)
            state.started = True
            
            return reply, state
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return (
                    "I'm getting a lot of requests right now. Please wait a moment and try again. "
                    "This usually resolves in a few seconds.",
                    state,
                )
            return f"Error starting conversation: {str(e)}", state
        except Exception as e:
            import traceback
            return f"Error starting conversation: {str(e)}", state
    
    # Subsequent turns: user is answering, we need to:
    # 1. Acknowledge their answer naturally
    # 2. Map it to an option
    # 3. Move to next question
    
    # First, map their answer to an option
    conversation_history = []
    if state.conversation_memory:
        for msg in state.conversation_memory.chat_memory.messages[-6:]:  # Last 3 exchanges
            if hasattr(msg, 'content'):
                conversation_history.append(msg.content)
    
    selected_index = _normalize_answer_to_option(
        current_q, user_message, language, conversation_history
    )
    state.answers[current_q.question_id] = selected_index
    state.current_index += 1
    
    # Save user message to memory
    state.conversation_memory.chat_memory.add_user_message(user_message)
    
    # Check if we're done
    next_q = _next_question(state)
    if next_q is None:
        # All done - will be handled in next call
        return handle_chat_message(state.session_id, "", language)
    
    # Generate natural response that acknowledges and moves forward
    next_agent_prompt = _get_conversational_agent_prompt(next_q, language, state)
    
    if language == "he":
        acknowledgment_prompt = (
            "המשתמש אמר: \"{user_msg}\"\n\n"
            "הכר/י בתשובה שלו/ה באופן טבעי וקצר (1-2 משפטים), "
            "ואז המשך/י בעדינות לשאול על ההיבט הבא שאת/ה צריך לחקור.\n\n"
            "הוראה ספציפית: {next_prompt}"
        )
    else:
        acknowledgment_prompt = (
            "The user said: \"{user_msg}\"\n\n"
            "Acknowledge their answer naturally and briefly (1-2 sentences), "
            "then gently move on to ask about the next aspect you need to explore.\n\n"
            "Specific instruction: {next_prompt}"
        )
    
    try:
        # Build messages with history
        messages = [
            {"role": "system", "content": system_message.format(agent_prompt=next_agent_prompt)}
        ]
        
        # Add conversation history
        if state.conversation_memory:
            for msg in state.conversation_memory.chat_memory.messages:
                if hasattr(msg, 'type'):
                    if msg.type == "human":
                        messages.append({"role": "user", "content": msg.content})
                    elif msg.type == "ai":
                        messages.append({"role": "assistant", "content": msg.content})
        
        # Add the acknowledgment prompt as user message
        messages.append({
            "role": "user",
            "content": acknowledgment_prompt.format(user_msg=user_message, next_prompt=next_agent_prompt)
        })
        
        # Call OpenAI API directly
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.7,
        }
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        reply = data["choices"][0]["message"]["content"]
        
        # Save AI response to memory
        if state.conversation_memory:
            state.conversation_memory.chat_memory.add_ai_message(reply)
        
        return reply, state
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            return (
                "I'm getting a lot of requests right now. Please wait a moment and try again. "
                "This usually resolves in a few seconds.",
                state,
            )
        return f"Error in conversation: {str(e)}", state
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        return f"Error in conversation: {str(e)}", state

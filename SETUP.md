# Healthy Visit – Setup (React + FastAPI + SQLite)

No Docker, no PostgreSQL. Just Python, Node, and a SQLite file.

All commands below are run from the project root (the folder that contains this file).

---

## 1. Configure the backend

Copy `backend/.env.example` to `backend/.env` and fill in `JWT_SECRET_KEY`, `ADMIN_PASSWORD`, and (optionally) `OPENAI_API_KEY`. The comments in the example file explain each value.

## 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
python server.py
```

Backend runs at **http://localhost:9999**  
API docs: **http://localhost:9999/api/docs**

---

## 3. Start the frontend

**New terminal:**

```bash
cd frontend
npm install
npm start
```

Frontend runs at **http://localhost:3000**

---

## 4. Log in

- **URL:** http://localhost:3000  
- Sign in with the admin account you set in `backend/.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

You can also **Register** a new user and use that to log in.

---

## Summary

| What        | URL / Command              |
|------------|----------------------------|
| Frontend   | http://localhost:3000      |
| Backend API | http://localhost:9999   |
| Swagger UI | http://localhost:9999/api/docs |
| Database   | SQLite file: `backend/SQLite.db` (created on first run) |

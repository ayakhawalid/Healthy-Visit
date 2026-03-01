# Healthy Visit – Setup (React + FastAPI + SQLite)

No Docker, no PostgreSQL. Just Python, Node, and a SQLite file.

---

## 1. Start the backend

```bash
cd C:\Users\USER\Desktop\healthy-visit\healthy-visit-fullstack\backend
pip install -r requirements.txt
python server.py
```

Backend runs at **http://localhost:9999**  
API docs: **http://localhost:9999/api/docs**

---

## 2. Start the frontend

**New terminal:**

```bash
cd C:\Users\USER\Desktop\healthy-visit\healthy-visit-fullstack\frontend
npm install
npm start
```

Frontend runs at **http://localhost:3000**

---

## 3. Log in

- **URL:** http://localhost:3000  
- **Username:** `admin`  
- **Password:** `asd123`  

You can also **Register** a new user and use that to log in.

---

## Summary

| What        | URL / Command              |
|------------|----------------------------|
| Frontend   | http://localhost:3000      |
| Backend API | http://localhost:9999   |
| Swagger UI | http://localhost:9999/api/docs |
| Database   | SQLite file: `backend/SQLite.db` (created on first run) |

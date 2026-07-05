# 🌍 CivicLens

AI-powered global health & population data explorer. Ask natural language questions, get SQL + charts + tables — powered by **Gemini AI** and **Google BigQuery**.

## Tech Stack

- **Backend:** FastAPI, Google Gemini 2.5 Flash, BigQuery
- **Frontend:** React (Vite), Recharts
- **Data:** World Bank Health Nutrition & Population dataset

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
# Add your keys to .env
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `backend/.env`:
```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS=path_to_service_account.json
```

## Features

- Natural language → SQL generation via Gemini AI
- Live BigQuery execution on World Bank public data
- Smart chart selection (multi-line, area, bar)
- Responsive dark-mode UI with glassmorphism design

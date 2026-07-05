from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from google.cloud import bigquery
import os
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()


def safe_value(v):
    """Convert BigQuery types (Decimal, int64, etc.) to JSON-safe Python types."""
    if v is None:
        return None
    if isinstance(v, Decimal):
        # Preserve as int if whole number, otherwise float
        return int(v) if v == int(v) else float(v)
    if isinstance(v, float):
        return int(v) if v == int(v) and abs(v) < 2**53 else v
    return v


def safe_row(row):
    """Convert a BigQuery Row to a dict with JSON-safe values."""
    return {k: safe_value(v) for k, v in row.items()}


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")
bq_client = bigquery.Client()

SCHEMA_CONTEXT = """
Table: `bigquery-public-data.world_bank_health_population.health_nutrition_population`
Columns:
- country_name (STRING): full country name e.g. 'India', 'China'
- country_code (STRING): 3-letter code e.g. 'IND', 'CHN'
- indicator_name (STRING): what is being measured e.g. 'Population, total'
- indicator_code (STRING): World Bank code e.g. 'SP.POP.TOTL'
- value (FLOAT64): the numeric value
- year (INT64): year of measurement

Common indicator codes:
- SP.POP.TOTL = Population total
- SH.DYN.MORT = Child mortality rate
- SH.XPD.CHEX.PC.CD = Health expenditure per capita
- SE.ADT.LITR.ZS = Adult literacy rate
- SH.HIV.INCD = HIV incidence
- SP.DYN.LE00.IN = Life expectancy at birth
- SH.STA.MMRT = Maternal mortality ratio
"""

class QueryRequest(BaseModel):
    question: str

@app.post("/query")
async def query(req: QueryRequest):
    # Step 1: Gemini generates SQL
    prompt = f"""
You are a BigQuery SQL expert. Given this schema:
{SCHEMA_CONTEXT}

Convert this question to a valid BigQuery SQL query.
Return ONLY the SQL query, nothing else. No explanation, no markdown, no backticks.

Question: {req.question}
"""
    sql_response = model.generate_content(prompt)
    sql = sql_response.text.strip()

    # Step 2: Run on BigQuery
    try:
        query_job = bq_client.query(sql)
        rows = query_job.result()
        results = [safe_row(row) for row in rows]
        return {"sql": sql, "results": results, "error": None}
    except Exception as e:
        return {"sql": sql, "results": [], "error": str(e)}

@app.get("/")
def root():
    return {"status": "CivicLens API running"}

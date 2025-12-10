import os
import shutil
import git
import uuid
import requests
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scanner import scan_code 
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Configuration
MAX_FILE_SIZE = 1 * 1024 * 1024  # 1 MB limit

# --- NEW: Setup Groq Client ---
# For now, we look for the key in environment variables.
# You will set this in your terminal in the next step.
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepoRequest(BaseModel):
    url: str

# --- NEW: Request Model for AI ---
class AIRequest(BaseModel):
    code: str
    issue: str

@app.get("/")
def read_root():
    return {"message": "FastAPI is working!"}

def calculate_trust_score(repo_url):
    try:
        parts = repo_url.rstrip("/").split("/")
        if len(parts) < 2: return None
        owner, repo_name = parts[-2], parts[-1]
        
        api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
        
        # --- AUTHENTICATION LOGIC ---
        headers = {}
        github_token = os.environ.get("GITHUB_TOKEN")
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"
        
        # --- API CALL ---
        resp = requests.get(api_url, headers=headers) 

        if resp.status_code != 200:
            # CHANGE THIS LINE to show the actual error code:
            return {"score": 0, "grade": "Unknown", "details": f"GitHub Error {resp.status_code}: {resp.reason}"}
        
        data = resp.json()
        
        # --- SCORING LOGIC ---
        created_at = datetime.strptime(data["created_at"], "%Y-%m-%dT%H:%M:%SZ")
        age_years = (datetime.now() - created_at).days / 365
        age_score = min(30, age_years * 10)

        stars = data.get("stargazers_count", 0)
        forks = data.get("forks_count", 0)
        pop_score = min(40, (stars * 0.5) + (forks * 1))

        activity_score = 0
        if data.get("has_issues"): activity_score += 15
        if data.get("has_pages"): activity_score += 15

        total_score = int(age_score + pop_score + activity_score)
        
        if total_score >= 80: grade = "A (Trusted)"
        elif total_score >= 60: grade = "B (Reliable)"
        elif total_score >= 40: grade = "C (Caution)"
        else: grade = "D (High Risk)"

        return {
            "score": total_score,
            "grade": grade,
            "details": f"Repo is {round(age_years, 1)} years old with {stars} stars."
        }
        
    except Exception as e:
        print(f"Trust Score Error: {e}")
        return {"score": 0, "grade": "Unknown", "details": "Error calculating score"}

@app.post("/analyze_file")
async def analyze_file(file: UploadFile = File(...)):
    file.file.seek(0, 2)
    file_size = file.file.tell()
    await file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 1MB.")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return {"issues": [{"filename": file.filename, "line": 0, "issue": "File is not valid text", "severity": "Error", "code": ""}]}

    scan_results = scan_code(text, file.filename)
    return {"issues": scan_results}

@app.post("/analyze_repo")
async def analyze_repo(request: RepoRequest):
    repo_url = request.url
    print(f"Received Repo URL: {repo_url}")
    
    if not repo_url.startswith("https://github.com/"):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with 'https://github.com/'")

    trust_data = calculate_trust_score(repo_url)

    unique_id = str(uuid.uuid4())
    repo_path = f"./temp_repo_{unique_id}"
    scan_results = []

    try:
        git.Repo.clone_from(repo_url, repo_path)
        
        for root, _, files in os.walk(repo_path):
            for file in files:
                if file.endswith(".py"):
                    full_path = os.path.join(root, file)
                    try:
                        with open(full_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        relative_filename = os.path.relpath(full_path, repo_path)
                        issues = scan_code(content, relative_filename)
                        scan_results.extend(issues)
                    except: pass
    except Exception as e:
        return {"issues": [], "trust": trust_data, "error": str(e)}
    finally:
        if os.path.exists(repo_path):
            try:
                def on_rm_error(func, path, exc_info):
                    os.chmod(path, 0o777)
                    func(path)
                shutil.rmtree(repo_path, onerror=on_rm_error)
            except: pass

    return {
        "issues": scan_results, 
        "trust": trust_data 
    }

# --- NEW: AI Explain Endpoint ---
@app.post("/explain")
async def explain_issue(request: AIRequest):
    try:
        prompt = f"""
        You are a senior security engineer. Analyze this python code snippet.
        The automated scanner flagged it as: "{request.issue}".
        
        Code:
        {request.code}
        
        Task:
        1. Is this a FALSE POSITIVE or a REAL RISK? 
        2. Explain why in 1 sentence.
        3. If real, suggest a 1-line fix.
        
        Format output as:
        Risk: [Real/False Positive]
        Reason: [Explanation]
        Fix: [Fix code or 'N/A']
        """
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama-3.3-70b-versatile",
        )
        
        return {"explanation": chat_completion.choices[0].message.content}
    except Exception as e:
        print(f"AI Error: {e}")
        # Fail gracefully if API key is missing or quota exceeded
        return {"explanation": "AI Analysis unavailable (Check API Key)."}
        


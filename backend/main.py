from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd

app = FastAPI()

# Allow React to talk to Python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE CONNECTION ---
def get_db_client():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = ServiceAccountCredentials.from_json_keyfile_name("credentials.json", scope)
    client = gspread.authorize(creds)
    return client.open("Pratibimba-web")

# --- API ENDPOINTS ---

@app.get("/")
def home():
    return {"message": "Pratibimba Backend is Live! 🚀"}

@app.get("/api/enriched-audits")
def get_enriched_audits():
    try:
        client = get_db_client()
        
        # 1. Fetch data using YOUR EXACT TAB NAMES from the screenshot
        audit_data = client.worksheet("audit_plan").get_all_records()
        loc_data = client.worksheet("master_prakalpas").get_all_records() # <--- Updated
        user_data = client.worksheet("users").get_all_records()           # <--- Updated

        # 2. Convert to Pandas Tables
        df_audits = pd.DataFrame(audit_data)
        df_locs = pd.DataFrame(loc_data)
        df_users = pd.DataFrame(user_data)

        # 3. Merge Data (The "Enrichment" Step)
        
        # Merge Location Name (Mapping 'location_id' to 'prakalpa_name')
        # Note: I am assuming your master_prakalpas tab has 'location_id' and 'prakalpa_name' columns.
        if not df_audits.empty and not df_locs.empty:
            if 'location_id' in df_locs.columns and 'prakalpa_name' in df_locs.columns:
                loc_map = pd.Series(df_locs.prakalpa_name.values, index=df_locs.location_id).to_dict()
                df_audits['prakalpa_name'] = df_audits['location_id'].map(loc_map).fillna(df_audits['location_id'])

        # Merge Coordinator Name (Mapping 'coordinator_email' to 'user_name')
        # Note: I am assuming your users tab has 'user_email' and 'user_name' columns.
        if not df_audits.empty and not df_users.empty:
            # We check if columns exist to prevent crashes
            if 'user_email' in df_users.columns and 'user_name' in df_users.columns:
                user_map = pd.Series(df_users.user_name.values, index=df_users.user_email).to_dict()
                df_audits['coordinator_name'] = df_audits['coordinator_email'].map(user_map).fillna(df_audits['coordinator_email'])

        # 4. Return Final JSON
        final_data = df_audits.fillna("").to_dict(orient="records")
        return {"status": "success", "data": final_data}

    except Exception as e:
        print(f"Error: {e}")
        return {"status": "error", "message": str(e)}
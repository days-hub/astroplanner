import os
from dotenv import load_dotenv

load_dotenv()

# In production, set these in environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "change_me_in_prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

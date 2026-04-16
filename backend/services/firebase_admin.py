import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials

from config import FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_PATH


def _ensure_firebase_initialized() -> None:
    if firebase_admin._apps:
        return
    cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    """
    Verifies the Firebase ID token.
    Returns the decoded token dict on success.
    Raises HTTPException 401 on failure.
    """
    try:
        _ensure_firebase_initialized()
        decoded = fb_auth.verify_id_token(id_token)

        # Optional extra validation for audience/project id.
        if FIREBASE_PROJECT_ID:
            aud = decoded.get("aud")
            if aud and aud != FIREBASE_PROJECT_ID:
                from fastapi import HTTPException

                raise HTTPException(
                    status_code=401, detail="Invalid or expired Firebase token"
                )

        return decoded
    except Exception:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=401, detail="Invalid or expired Firebase token"
        )


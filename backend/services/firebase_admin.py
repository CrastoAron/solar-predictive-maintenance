import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials

from config import FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_PATH
def infer_role_from_token_payload(payload: dict, admin_emails: list[str] | None = None) -> str:
    firebase_claims = payload.get("firebase") or {}
    if isinstance(firebase_claims, dict):
        provider = firebase_claims.get("sign_in_provider")
        if provider == "password":
            return "admin"
        if provider == "google.com":
            return "customer"

    role = payload.get("role") or payload.get("customRole")
    if isinstance(role, str) and role:
        return role.lower()

    custom_claims = payload.get("custom_claims") or {}
    if isinstance(custom_claims, dict):
        custom_role = custom_claims.get("role")
        if isinstance(custom_role, str) and custom_role:
            return custom_role.lower()

    return "customer"


def _ensure_firebase_initialized() -> None:
    if firebase_admin._apps:
        return
    cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str, force_role: str | None = None) -> dict:
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

        if force_role:
            decoded["role"] = force_role.lower()
        else:
            decoded["role"] = infer_role_from_token_payload(decoded)

        return decoded
    except Exception:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=401, detail="Invalid or expired Firebase token"
        )

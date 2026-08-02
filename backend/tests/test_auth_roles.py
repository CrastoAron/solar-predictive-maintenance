import importlib

from services.firebase_admin import infer_role_from_token_payload


def test_admin_email_falls_back_to_admin_role():
    payload = {
        "email": "admin@example.com",
        "firebase": {"sign_in_provider": "password"},
    }

    assert infer_role_from_token_payload(payload, admin_emails=[]) == "admin"


def test_custom_claim_role_is_honored():
    payload = {
        "email": "user@example.com",
        "role": "admin",
    }

    assert infer_role_from_token_payload(payload, admin_emails=[]) == "admin"


def test_admin_email_from_environment_is_honored(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "admin@company.com")
    import services.firebase_admin as firebase_admin

    importlib.reload(firebase_admin)

    payload = {
        "email": "admin@company.com",
        "firebase": {"sign_in_provider": "password"},
    }

    assert firebase_admin.infer_role_from_token_payload(payload) == "customer"

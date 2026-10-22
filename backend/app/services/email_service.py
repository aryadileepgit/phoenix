"""
Email service for Phoenix.

Supports SMTP (production) and console logging (dev).
Configure via environment variables:
  EMAIL_ENABLED=true|false          (default: false -> console only)
  SMTP_HOST=smtp.example.com
  SMTP_PORT=587
  SMTP_USERNAME=user
  SMTP_PASSWORD=pass
  SMTP_USE_TLS=true|false           (default: true)
  EMAIL_FROM="Phoenix <noreply@phoenix.ai>"
  EMAIL_BASE_URL=http://localhost:5174
"""

import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional


def _smtp_config() -> dict:
    return {
        "enabled": os.getenv("EMAIL_ENABLED", "false").lower() == "true",
        "host": os.getenv("SMTP_HOST", ""),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "username": os.getenv("SMTP_USERNAME", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        "from_addr": os.getenv("EMAIL_FROM", "Phoenix <noreply@phoenix.ai>"),
        "base_url": os.getenv("EMAIL_BASE_URL", "http://localhost:5174"),
    }


def _build_reset_email(to_email: str, token: str, cfg: dict) -> EmailMessage:
    reset_link = f"{cfg['base_url'].rstrip('/')}/reset-password?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Phoenix – Password Reset Request"
    msg["From"] = cfg["from_addr"]
    msg["To"] = to_email

    text = (
        "You requested a password reset for your Phoenix account.\n\n"
        f"Click the link below to set a new password (expires in 60 minutes):\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email.\n"
        "\n— Phoenix Security Team"
    )
    html = f"""\
    <!DOCTYPE html>
    <html>
      <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#111">
        <div style="max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#f97316">Phoenix – Password Reset</h2>
          <p>You requested a password reset for your Phoenix account.</p>
          <p>
            <a href="{reset_link}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
              Reset your password
            </a>
          </p>
          <p style="color:#666;font-size:0.9em">This link expires in 60 minutes.</p>
          <p style="color:#666;font-size:0.9em">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#999;font-size:0.8em">— Phoenix Security Team</p>
        </div>
      </body>
    </html>
    """
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


def send_reset_email(to_email: str, token: str) -> bool:
    """
    Send a password-reset email. Returns True on success.
    If email is disabled or misconfigured, logs to console and returns False.
    """
    cfg = _smtp_config()

    if not cfg["enabled"]:
        # Dev mode: log token to console
        reset_link = f"{cfg['base_url'].rstrip('/')}/reset-password?token={token}"
        print(f"[DEV] Password reset for {to_email}: {reset_link}")
        return False

    # Validate required config
    if not (cfg["host"] and cfg["username"] and cfg["password"]):
        print("[WARN] EMAIL_ENABLED=true but SMTP config incomplete; falling back to console")
        reset_link = f"{cfg['base_url'].rstrip('/')}/reset-password?token={token}"
        print(f"[DEV] Password reset for {to_email}: {reset_link}")
        return False

    try:
        msg = _build_reset_email(to_email, token, cfg)
        context = ssl.create_default_context()
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=10) as server:
            if cfg["use_tls"]:
                server.starttls(context=context)
            server.login(cfg["username"], cfg["password"])
            server.send_message(msg)
        return True
    except Exception as exc:
        print(f"[ERROR] Failed to send reset email to {to_email}: {exc}")
        # Still log the link so dev isn't blocked
        reset_link = f"{cfg['base_url'].rstrip('/')}/reset-password?token={token}"
        print(f"[FALLBACK] Password reset for {to_email}: {reset_link}")
        return False
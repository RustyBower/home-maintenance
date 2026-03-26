import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

logger = logging.getLogger(__name__)


def send_email(config: dict, subject: str, body_html: str, body_text: str) -> None:
    """Send an email notification via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config.get("smtp_user", "homemaint@localhost")
    msg["To"] = config["to"]

    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    host = config.get("smtp_host", "smtp.gmail.com")
    port = config.get("smtp_port", 587)
    use_tls = config.get("use_tls", True)

    with smtplib.SMTP(host, port) as server:
        if use_tls:
            server.starttls()
        user = config.get("smtp_user")
        password = config.get("smtp_pass")
        if user and password:
            server.login(user, password)
        server.send_message(msg)
    logger.info("Email sent to %s", config["to"])


def send_webhook(config: dict, payload: dict) -> None:
    """Send a webhook notification (POST/PUT JSON)."""
    url = config["url"]
    method = config.get("method", "POST").upper()
    headers = config.get("headers", {})
    headers.setdefault("Content-Type", "application/json")

    with httpx.Client(timeout=15) as client:
        resp = client.request(method, url, json=payload, headers=headers)
        resp.raise_for_status()
    logger.info("Webhook sent to %s (%s %d)", url, method, resp.status_code)


def send_ntfy(config: dict, title: str, message: str, priority: str = "default") -> None:
    """Send a notification via ntfy."""
    server = config.get("server", "https://ntfy.sh")
    topic = config["topic"]
    url = f"{server.rstrip('/')}/{topic}"

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            url,
            content=message,
            headers={
                "Title": title,
                "Priority": priority,
            },
        )
        resp.raise_for_status()
    logger.info("ntfy sent to %s/%s", server, topic)


def format_digest_email(overdue: list, due_today: list, upcoming: list) -> tuple[str, str]:
    """Return (html, text) for a digest email."""

    def task_row_html(task) -> str:
        due = task.next_due.isoformat() if task.next_due else "no date"
        return f"<li><strong>{task.name}</strong> — {task.category.value} ({task.priority.value}) — due {due}</li>"

    def task_row_text(task) -> str:
        due = task.next_due.isoformat() if task.next_due else "no date"
        return f"  - {task.name} ({task.category.value}, {task.priority.value}) — due {due}"

    sections_html = []
    sections_text = []

    if overdue:
        sections_html.append(f"<h2 style='color:#ef4444;'>Overdue ({len(overdue)})</h2><ul>{''.join(task_row_html(t) for t in overdue)}</ul>")
        sections_text.append(f"OVERDUE ({len(overdue)})")
        sections_text.extend(task_row_text(t) for t in overdue)

    if due_today:
        sections_html.append(f"<h2 style='color:#f59e0b;'>Due Today ({len(due_today)})</h2><ul>{''.join(task_row_html(t) for t in due_today)}</ul>")
        sections_text.append(f"\nDUE TODAY ({len(due_today)})")
        sections_text.extend(task_row_text(t) for t in due_today)

    if upcoming:
        sections_html.append(f"<h2 style='color:#3b82f6;'>Upcoming ({len(upcoming)})</h2><ul>{''.join(task_row_html(t) for t in upcoming)}</ul>")
        sections_text.append(f"\nUPCOMING ({len(upcoming)})")
        sections_text.extend(task_row_text(t) for t in upcoming)

    html = f"""<html><body style="font-family:sans-serif;background:#1a1d27;color:#e4e4e7;padding:20px;">
<h1 style="color:#e4e4e7;">Home Maintenance Digest</h1>
{''.join(sections_html)}
</body></html>"""

    text = "Home Maintenance Digest\n" + "=" * 30 + "\n" + "\n".join(sections_text)

    return html, text


def format_digest_ntfy(overdue: list, due_today: list, upcoming: list) -> tuple[str, str, str]:
    """Return (title, message, priority) for ntfy."""
    parts = []
    if overdue:
        parts.append(f"\U0001f534 {len(overdue)} overdue")
    if due_today:
        parts.append(f"\U0001f7e1 {len(due_today)} due today")
    if upcoming:
        parts.append(f"\U0001f535 {len(upcoming)} upcoming this week")

    message = ", ".join(parts) if parts else "No tasks due"
    priority = "high" if overdue else ("default" if due_today else "low")
    title = "Home Maintenance Digest"
    return title, message, priority


def format_digest_webhook(overdue: list, due_today: list, upcoming: list) -> dict:
    """Return the webhook JSON payload."""

    def task_dict(task) -> dict:
        return {
            "id": task.id,
            "name": task.name,
            "category": task.category.value,
            "priority": task.priority.value,
            "next_due": task.next_due.isoformat() if task.next_due else None,
        }

    return {
        "overdue": [task_dict(t) for t in overdue],
        "due_today": [task_dict(t) for t in due_today],
        "upcoming": [task_dict(t) for t in upcoming],
        "total_overdue": len(overdue),
        "total_due_today": len(due_today),
        "total_upcoming": len(upcoming),
    }

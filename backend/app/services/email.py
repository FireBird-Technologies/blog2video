"""
Email service abstraction for Blog2Video transactional emails.
Supports multiple providers via a clean interface — swap by setting EMAIL_PROVIDER in .env.

Current provider: Resend (resend Python SDK)

Notifications:
  - send_preview_ready_email()      → scenes generated, user can preview (GENERATED)
  - send_download_ready_email()     → MP4 render complete, user can download (DONE)
  - schedule_followup_email()      → optional follow-up e.g. 23.5h after project updated_at (scheduled via Resend)
  - send_enterprise_contact_email() → enterprise contact form submission
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─── Exception ────────────────────────────────────────────────


class EmailServiceError(Exception):
    """Raised when an email cannot be sent."""
    pass


# ─── Provider abstraction ──────────────────────────────────────


class BaseEmailProvider(ABC):
    """Abstract base — every concrete provider must implement send_email()."""

    @abstractmethod
    def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> None:
        """
        Send a transactional email (immediately or at a scheduled time).

        Args:
            to:           Recipient email address.
            subject:      Email subject line.
            html_content: HTML body.
            text_content: Plain-text fallback (optional but recommended).
            from_email:   Override the default sender address.
            scheduled_at: If set, schedule send at this time (UTC); provider must support it.

        Raises:
            EmailServiceError: If the send fails for any reason.
        """


class ResendEmailProvider(BaseEmailProvider):
    """Sends email via the resend Python SDK."""

    def __init__(self, api_key: str, from_email: str):
        self.api_key = api_key
        self.from_email = from_email
        if not self.api_key:
            logger.warning("[EMAIL] RESEND_API_KEY not set — email sending is disabled")

    def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> None:
        if not self.api_key:
            raise EmailServiceError("Cannot send email: RESEND_API_KEY is not configured")

        import resend  # lazy import — app starts even if package is missing

        resend.api_key = self.api_key

        params: dict = {
            "from": from_email or self.from_email,
            "to": [to],
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            params["text"] = text_content
        if scheduled_at is not None:
            # Resend expects ISO 8601 UTC; assume naive datetimes are UTC
            dt = scheduled_at
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            params["scheduled_at"] = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        try:
            result = resend.Emails.send(params)
            if scheduled_at is not None:
                logger.info(f"[EMAIL] Scheduled '{subject}' → {to} at {params.get('scheduled_at')} (id: {getattr(result, 'id', result)})")
            else:
                logger.info(f"[EMAIL] Sent '{subject}' → {to} (id: {getattr(result, 'id', result)})")
        except Exception as exc:
            msg = f"Resend error sending to {to}: {exc}"
            logger.error(f"[EMAIL] {msg}", exc_info=True)
            raise EmailServiceError(msg)


# ─── Service ──────────────────────────────────────────────────


class EmailService:
    """
    Orchestration layer — provider-agnostic interface for all Blog2Video emails.
    Each notification type is a dedicated method with clear, typed arguments.
    """

    def __init__(self, provider: Optional[BaseEmailProvider] = None):
        self.provider = provider or self._create_provider()

    # ── Provider factory ──────────────────────────────────────

    def _create_provider(self) -> BaseEmailProvider:
        name = getattr(settings, "EMAIL_PROVIDER", "resend").lower()
        if name == "resend":
            return ResendEmailProvider(
                api_key=getattr(settings, "RESEND_API_KEY", ""),
                from_email=getattr(settings, "FROM_EMAIL", "sales@blog2video.app"),
            )
        # Add more providers here:
        # elif name == "sendgrid":
        #     return SendGridEmailProvider(api_key=settings.SENDGRID_API_KEY, ...)
        raise ValueError(f"Unknown EMAIL_PROVIDER: '{name}'. Supported: resend")

    # ── Shared HTML builder ───────────────────────────────────

    @staticmethod
    def _build_html(headline: str, body_paragraph: str, cta_label: str, cta_url: str) -> str:
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{headline}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#9333EA;padding:32px 40px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Blog<span style="color:#c4b5fd;">2</span>Video
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;">{headline}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.65;">{body_paragraph}</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#9333EA;border-radius:6px;">
                    <a href="{cta_url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">{cta_label}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                If the button doesn't work, copy and paste this link:<br/>
                <a href="{cta_url}" style="color:#9333EA;word-break:break-all;">{cta_url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this because you have an account at Blog2Video.<br/>
                &copy; 2025 Blog2Video &middot; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    # ── Notification methods ──────────────────────────────────

    def send_preview_ready_email(
        self,
        user_email: str,
        user_name: str,
        project_name: str,
        project_url: str,
    ) -> None:
        """
        Notify the user that their video scenes are ready to preview in the browser.
        Triggered when the pipeline reaches ProjectStatus.GENERATED.
        """
        first_name = user_name.split()[0] if user_name else "there"
        subject = f"Your video '{project_name}' is ready to preview!"
        html = self._build_html(
            headline=f"Hi {first_name}, your video is ready to preview!",
            body_paragraph=(
                f"Your Blog2Video project <strong style=\"color:#111827;\">\"{project_name}\"</strong> "
                f"has been generated. Preview all scenes in your browser and use the AI chat editor "
                f"to fine-tune anything before exporting the final MP4."
            ),
            cta_label="Preview Your Video",
            cta_url=project_url,
        )
        text = (
            f"Hi {first_name},\n\n"
            f"Your Blog2Video project '{project_name}' is ready to preview.\n\n"
            f"View it here: {project_url}\n\n"
            f"You can also use the AI chat editor to refine scenes before exporting.\n\n"
            f"— The Blog2Video Team\n"
        )
        self.provider.send_email(
            to=user_email, subject=subject, html_content=html, text_content=text,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
        )

    def send_download_ready_email(
        self,
        user_email: str,
        user_name: str,
        project_name: str,
        video_url: str,
    ) -> None:
        """
        Notify the user that their MP4 render is complete and ready to download.
        Triggered when the pipeline reaches ProjectStatus.DONE.
        """
        first_name = user_name.split()[0] if user_name else "there"
        subject = f"Your video '{project_name}' is ready to download!"
        html = self._build_html(
            headline=f"Hi {first_name}, your video is ready to download!",
            body_paragraph=(
                f"Your Blog2Video project <strong style=\"color:#111827;\">\"{project_name}\"</strong> "
                f"has finished rendering and is ready for download."
            ),
            cta_label="Download Video",
            cta_url=video_url,
        )
        text = (
            f"Hi {first_name},\n\n"
            f"Your Blog2Video project '{project_name}' has finished rendering!\n\n"
            f"Download it here: {video_url}\n\n"
            f"— The Blog2Video Team\n"
        )
        self.provider.send_email(
            to=user_email, subject=subject, html_content=html, text_content=text,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
        )

    def schedule_followup_email(
        self,
        user_email: str,
        user_name: str,
        project_name: str,
        project_url: str,
        scheduled_at: Optional[datetime] = None,
    ) -> None:
        """
        Schedule a follow-up email (e.g. 23.5 hours after project.updated_at).
        Uses Resend scheduled send. If scheduled_at is None, sends immediately.
        """
        first_name = user_name.split()[0] if user_name else "there"
        subject = f"Reminder: download your video '{project_name}' before it's deleted"
        html = self._build_html(
          headline=f"Hi {first_name}, download your video before it's deleted",
          body_paragraph=(
            f"Your Blog2Video project <strong style=\"color:#111827;\">\"{project_name}\"</strong> "
            f"will be deleted in about 30 minutes. Download it before it's removed."
          ),
          cta_label="Download Before It's Deleted",
          cta_url=project_url,
        )
        text = (
          f"Hi {first_name},\n\n"
          f"Your Blog2Video project '{project_name}' will be deleted in about 30 minutes. "
          f"Download it before it's removed:\n\n"
          f"{project_url}\n\n"
          f"— The Blog2Video Team\n"
        )
        self.provider.send_email(
            to=user_email,
            subject=subject,
            html_content=html,
            text_content=text,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
            scheduled_at=scheduled_at,
        )

    def send_enterprise_contact_email(
        self,
        name: str,
        company: str,
        contact_details: str,
        message: str,
        to: str = "arslan@firebird-technologies.com",
    ) -> None:
        """
        Forward an enterprise contact form submission to the internal team.
        Triggered by POST /api/contact/enterprise.
        """
        subject = f"[Enterprise] Contact from {name} ({company})"
        text = (
            f"New enterprise contact request:\n\n"
            f"Name: {name}\n"
            f"Company: {company}\n"
            f"Contact details: {contact_details}\n\n"
            f"Message:\n{message}\n"
        )
        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;padding:40px 0;margin:0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#9333EA;padding:24px 40px;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;">Blog<span style="color:#c4b5fd;">2</span>Video — Enterprise Contact</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                <tr><td style="font-weight:600;color:#374151;width:140px;border-bottom:1px solid #f3f4f6;">Name</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{name}</td></tr>
                <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Company</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{company}</td></tr>
                <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Contact</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{contact_details}</td></tr>
              </table>
              <p style="margin:24px 0 8px;font-weight:600;color:#374151;">Message</p>
              <p style="margin:0;padding:16px;background:#f9fafb;border-radius:6px;color:#111827;white-space:pre-wrap;">{message}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
        self.provider.send_email(to=to, subject=subject, html_content=html, text_content=text)


# ─── Singleton ────────────────────────────────────────────────

# Import this at every call site:
#   from app.services.email import email_service, EmailServiceError
email_service = EmailService()

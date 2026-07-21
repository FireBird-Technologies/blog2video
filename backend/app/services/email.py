"""
Email service abstraction for Blog2Video transactional emails.
Supports multiple providers via a clean interface — swap by setting EMAIL_PROVIDER in .env.

Current provider: Resend (resend Python SDK)

Notifications:
  - send_preview_ready_email()      → scenes generated, user can preview (GENERATED)
  - send_download_ready_email()     → MP4 render complete, user can download (DONE)
  - schedule_followup_email()      → optional follow-up e.g. 23.5h after project updated_at (scheduled via Resend)
  - send_enterprise_contact_email() → enterprise contact form submission
  - send_free_tier_video_limit_announcement() → campaign: free plan included-video limit raised
  - send_low_rating_alert_email()   → low review (rating < 2) on a project, CC'd to the user
"""

import hashlib
import hmac
import html
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ─── Exception ────────────────────────────────────────────────


class EmailServiceError(Exception):
    """Raised when an email cannot be sent."""
    pass


def _resend_response_id(result) -> Optional[str]:
    """Normalize Resend SDK response (dict or object) to a message id string."""
    if result is None:
        return None
    if isinstance(result, dict):
        rid = result.get("id")
        return str(rid) if rid is not None else None
    rid = getattr(result, "id", None)
    return str(rid) if rid is not None else None


_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Appended only to the copy of a contact/request email sent back to the
# requester — never to the internal team copy.
_CONFIRMATION_NOTE = (
    "Please check your spam folder in case you don't hear back within "
    f"1–2 business days, or contact {settings.INTERNAL_ALERT_EMAIL}"
)

# CC'd on every requester confirmation email for internal visibility.
_CONFIRMATION_CC = [settings.INTERNAL_ALERT_EMAIL]


def _extract_email(text: Optional[str]) -> Optional[str]:
    """Return the first email-looking address in `text`, or None if there is none."""
    if not text:
        return None
    match = _EMAIL_RE.search(text)
    return match.group(0) if match else None


# ─── Provider abstraction ──────────────────────────────────────


class BaseEmailProvider(ABC):
    """Abstract base — every concrete provider must implement send_email()."""

    @abstractmethod
    def send_email(
        self,
        to: str,
        subject: str,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        cc: Optional[list[str]] = None,
    ) -> None:
        """
        Send a transactional email (immediately or at a scheduled time).

        Args:
            to:           Recipient email address.
            subject:      Email subject line.
            html_content: HTML body (optional if text_content is set).
            text_content: Plain-text body (optional if html_content is set).
            from_email:   Override the default sender address.
            scheduled_at: If set, schedule send at this time (UTC); provider must support it.
            cc:           Optional list of addresses to copy on the email.

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
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        cc: Optional[list[str]] = None,
    ) -> None:
        if not self.api_key:
            raise EmailServiceError("Cannot send email: RESEND_API_KEY is not configured")
        if not (html_content or text_content):
            raise EmailServiceError("Cannot send email: html_content or text_content is required")

        import resend  # lazy import — app starts even if package is missing

        resend.api_key = self.api_key

        params: dict = {
            "from": from_email or self.from_email,
            "to": [to],
            "subject": subject,
        }
        if cc:
            params["cc"] = cc
        if html_content:
            params["html"] = html_content
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
            rid = _resend_response_id(result)
            if scheduled_at is not None:
                logger.info(
                    f"[EMAIL] Scheduled '{subject}' → {to} at {params.get('scheduled_at')} "
                    f"(resend_id={rid!r})"
                )
            else:
                logger.info(f"[EMAIL] Sent '{subject}' → {to} (resend_id={rid!r})")
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
    def _build_html(headline: str, body_paragraph: str, cta_label: str, cta_url: str, unsubscribe_url: str = "", center: bool = False) -> str:
        body_align = "center" if center else "left"
        cta_align = "center" if center else "left"
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
              <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111827;text-align:{body_align};">{headline}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.65;text-align:{body_align};">{body_paragraph}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="{cta_align}">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:#9333EA;border-radius:6px;">
                          <a href="{cta_url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">{cta_label}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this because you have an account at Blog2Video.<br/>
                &copy; 2026 Blog2Video &middot; All rights reserved.
                {f'<br/><a href="{unsubscribe_url}" style="color:#9ca3af;">Unsubscribe</a>' if unsubscribe_url else ""}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    # ── Requester confirmation ────────────────────────────────

    @staticmethod
    def _build_confirmation_html(first_name: str) -> str:
        """
        Build the HTML body of the confirmation sent back to the requester.
        A short acknowledgement plus the spam-folder note in italics (with the
        contact email bolded). It does not echo the submitted request.
        """
        note_html = html.escape(_CONFIRMATION_NOTE, quote=False)
        note_email = _extract_email(_CONFIRMATION_NOTE)
        if note_email:
            esc_email = html.escape(note_email, quote=False)
            note_html = note_html.replace(esc_email, f"<strong>{esc_email}</strong>")
        return f"""<!DOCTYPE html>
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
                      <span style="font-size:20px;font-weight:700;color:#ffffff;">Blog<span style="color:#c4b5fd;">2</span>Video</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px;">
                      <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">Thanks {html.escape(first_name, quote=False)}, we&apos;ve received your request</p>
                      <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.65;">Our team will review it and get back to you soon.</p>
                      <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;font-style:italic;">{note_html}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>"""

    def _send_request_confirmation(self, to: str, first_name: str) -> None:
        """
        Send the requester a short confirmation that their submission was received.

        Best-effort: this runs after the internal team email has already been
        sent, so any failure here is logged and swallowed — it must never turn
        a successful submission into an error for the user.
        """
        subject = "We've received your request — Blog2Video"
        text = (
            f"Hi {first_name},\n\n"
            f"We've received your request and our team will review it and get "
            f"back to you soon.\n\n"
            f"{_CONFIRMATION_NOTE}\n\n"
            f"— The Blog2Video Team\n"
        )
        html_body = self._build_confirmation_html(first_name=first_name)
        try:
            self.provider.send_email(
                to=to,
                subject=subject,
                html_content=html_body,
                text_content=text,
                from_email="sales@blog2video.app",
                cc=_CONFIRMATION_CC,
            )
        except Exception as exc:
            logger.warning(f"[EMAIL] Failed to send request confirmation to {to}: {exc}")

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


    def _send_coupon_email(
        self,
        *,
        user_email: str,
        subject: str,
        intro_text: str,
        coupon_code: str,
        valid_hours: int,
        recovery_url: Optional[str] = None,
    ) -> None:
        """
        Shared sender for the two win-back coupon emails (abandoned / per-video).
        Plain, left-aligned email — no card, coloured header, code chip or bold
        styling — just a clickable CTA link and an Unsubscribe link.

        If `recovery_url` is given (Stripe abandoned-cart recovery link), the CTA
        resumes the original checkout; otherwise it falls back to the pricing page.
        """
        pricing_url = f"{getattr(settings, 'FRONTEND_URL', 'https://blog2video.app').rstrip('/')}/pricing"
        cta_url = recovery_url or pricing_url
        cta_label = "Complete your checkout" if recovery_url else "Choose a plan"
        # Promo codes are case-insensitive in Stripe; show them upper-cased so the
        # code reads clearly in the email regardless of how it's configured.
        coupon_code = coupon_code.upper()
        unsubscribe_url = self._make_unsubscribe_url(user_email)
        text = (
            f"{intro_text}\n\n"
            f"Apply this code at checkout (enter it in ALL CAPITAL LETTERS):\n\n"
            f"    {coupon_code}\n\n"
            f"Hurry — this code is only valid for the next {valid_hours} hours.\n\n"
            f"{cta_label}: {cta_url}\n\n"
            f"— The Blog2Video Team\n\n"
            f"---\n"
            f"To unsubscribe from these emails, visit: {unsubscribe_url}\n"
        )
        blocks = intro_text.split("\n\n") + [
            "Apply this code at checkout (enter it in ALL CAPITAL LETTERS):",
            coupon_code,
            f"Hurry — this code is only valid for the next {valid_hours} hours.",
            f'<a href="{cta_url}" style="color:#9333EA;">{cta_label}</a>',
            "— The Blog2Video Team",
        ]
        body_html = "".join(
            f'<p style="margin:0 0 14px;">{block}</p>' for block in blocks
        )
        html = (
            '<!DOCTYPE html><html><head><meta charset="UTF-8" />'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>'
            '<body style="margin:0;padding:24px;background:#ffffff;text-align:left;'
            "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;"
            'font-size:15px;line-height:1.6;color:#111827;">'
            f"{body_html}"
            f'<p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">'
            f'<a href="{unsubscribe_url}" style="color:#9ca3af;">Unsubscribe</a></p>'
            "</body></html>"
        )
        self.provider.send_email(
            to=user_email, subject=subject, html_content=html, text_content=text,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
        )

    def send_abandoned_checkout_coupon_email(
        self,
        user_email: str,
        user_name: str,
        coupon_code: str = "",
        discount_percent: int = 25,
        valid_hours: int = 48,
        recovery_url: Optional[str] = None,
    ) -> None:
        """
        Win-back email for a user who reached checkout but bought nothing.
        Triggered by Stripe's checkout.session.expired webhook; `recovery_url` is
        the Stripe abandoned-cart recovery link that resumes the original checkout.
        """
        first_name = user_name.split()[0] if user_name else "there"
        self._send_coupon_email(
            user_email=user_email,
            subject=f"Still thinking it over? Here's {discount_percent}% off",
            intro_text=(
                f"Hi {first_name},\n\n"
                f"You were one step away from checking out on Blog2Video. To help "
                f"you finish up, here's {discount_percent}% off — just pick up right "
                f"where you left off."
            ),
            coupon_code=coupon_code,
            valid_hours=valid_hours,
            recovery_url=recovery_url,
        )

    def send_per_video_upsell_coupon_email(
        self,
        user_email: str,
        user_name: str,
        coupon_code: str = "",
        discount_percent: int = 25,
        valid_hours: int = 48,
    ) -> None:
        """
        Win-back email for a user who bought a single video. Nudges them toward a
        subscription with a limited-time discount. Sent on a completed per-video
        purchase (checkout.session.completed).
        """
        first_name = user_name.split()[0] if user_name else "there"
        self._send_coupon_email(
            user_email=user_email,
            subject=f"Thanks for your video — here's {discount_percent}% off a plan",
            intro_text=(
                f"Hi {first_name},\n\n"
                f"We hope you love the video you just made. If you're planning to make "
                f"more, a subscription unlocks extra features like custom video templates "
                f"and premium voiceover with voice cloning — and works out far cheaper "
                f"than buying one video at a time. As a thank-you, here's "
                f"{discount_percent}% off any plan."
            ),
            coupon_code=coupon_code,
            valid_hours=valid_hours,
        )



    def send_subscription_thank_you_email(
        self,
        user_email: str,
        user_name: str,
        plan_label: str = "",
    ) -> None:
        """
        Thank a user for subscribing, right after a successful subscription (or
        lifetime) checkout. Points them at the internal contact for any issues
        and mentions the paid designer-template offering for on-brand videos.
        Triggered from _handle_checkout_completed in routers/billing.py.

        Plain text only, no HTML, so it reads like a personal note rather than a
        template.
        """
        first_name = user_name.split()[0] if user_name else "there"
        support_email = settings.INTERNAL_ALERT_EMAIL
        plan_bit = f" to {plan_label}" if plan_label else ""
        subject = "Thanks for subscribing to Blog2Video"

        text = (
            f"Hi {first_name},\n\n"
            f"Thank you for becoming a paid subscriber to Blog2Video. I am the "
            f"owner of the project, if you ever need any support or have any "
            f"feedback for us feel free to share.\n\n"
            f"This is my personal email CC'ed, feel free to send over anything "
            f"you need help with.\n\n"
            f"Also, if you need a designer made premium template for your "
            f"business, we are offering a discount to our paid users to get one.\n\n"
            f"It will showcase your brand/company in every video — while being "
            f"infinitely reusable.\n\n"
            f"Thank you once again for subscribing!\n"
        )
        self.provider.send_email(
            to=user_email,
            subject=subject,
            text_content=text,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
            cc=[support_email],
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
        is_designer_request: bool = False,
        to: str = settings.INTERNAL_ALERT_EMAIL,
    ) -> None:
        """
        Forward an enterprise contact form submission to the internal team.
        Triggered by POST /api/contact/enterprise.

        When ``is_designer_request`` is set (the logged-out "Your Own Brand"
        CTA on the landing page), the email is styled as a Designer Template
        request rather than a generic enterprise contact.
        """
        kind_label = "Designer Template Request" if is_designer_request else "Enterprise Contact"
        if is_designer_request:
            subject = f"[Designer Template Request] from {name} ({company})"
        else:
            subject = f"[Enterprise] Contact from {name} ({company})"
        text = (
            f"New {kind_label.lower()}:\n\n"
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
                      <span style="font-size:20px;font-weight:700;color:#ffffff;">Blog<span style="color:#c4b5fd;">2</span>Video — {kind_label}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px;">
                      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                        <tr><td style="font-weight:600;color:#374151;width:140px;border-bottom:1px solid #f3f4f6;">Name</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{name}</td></tr>
                        <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Company</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{company}</td></tr>
                        <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Contact</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{contact_details}</td></tr>
                      </table>
                      <p style="margin:24px 0 8px;font-weight:600;color:#374151;">{"Theme / Description" if is_designer_request else "Message"}</p>
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

        # Send the requester a confirmation with the spam-folder note, if they gave an email.
        sender_email = _extract_email(contact_details)
        if sender_email:
            self._send_request_confirmation(
                to=sender_email,
                first_name=name.split()[0] if name.strip() else "there",
            )



    def send_low_rating_alert_email(
        self,
        user_name: str,
        user_email: str,
        project_id: int,
        project_name: str,
        rating: int,
        suggestion: Optional[str],
        plan: str,
        to: str = settings.INTERNAL_ALERT_EMAIL,
    ) -> None:
        """
        Alert the internal team when a user leaves a low review (rating < 2) on a
        video, CC'ing the user so the team can reply directly to diagnose the issue.
        Triggered by POST /projects/{project_id}/review.

        Written as a warm, first-person note addressed to the user (since they're
        CC'd and will read it) rather than an internal data dump, so a reply-all
        from the team reaches the user directly. Plain text only, no HTML, so it
        reads like a real person wrote it rather than a template.
        """
        first_name = user_name.split()[0] if user_name.strip() else "there"

        text = (
            f"Hi {first_name},\n\n"
            f"We saw that your recent video, \"{project_name}\", didn't meet your expectations "
            f"({rating}/5). We're sorry about that, that's not the experience we want you to have.\n\n"
        )
        if suggestion:
            text += f"Here's what you shared with us: {suggestion}\n\n"
        text += (
            "We'd love to help make this right. Just reply to this email and let us know "
            "what went wrong, we're reading every reply personally.\n\n"
            "Best regards,\n"
            "Support Team, Blog2Video"
        )

        self.provider.send_email(
            to=to,
            subject="We noticed your experience wasn't great, how can we help?",
            text_content=text,
            from_email="support@blog2video.app",
            cc=[user_email],
        )



    def send_render_failure_alert_email(
        self,
        project_id: int,
        error_summary: str | None = None,
        to: str = settings.INTERNAL_ALERT_EMAIL,
    ) -> None:
        """
        Alert the internal team when a render has failed after exhausting all
        retry attempts. Triggered from the final-failure branch in
        services/remotion.py's render subprocess handler. Internal-only —
        intentionally does NOT cc the project owner.
        """
        text = f"A render failed after 3 attempts and needs attention.\n\nProject id: {project_id}\n"
        if error_summary:
            text += f"\nLast error:\n{error_summary}\n"

        self.provider.send_email(
            to=to,
            subject=f"[Render Failed] Project {project_id}",
            text_content=text,
            from_email="support@blog2video.app",
        )



    def send_elevenlabs_failover_alert_email(
        self,
        reason: str,
        to: str = settings.INTERNAL_ALERT_EMAIL,
        cc: list[str] | None = None,
    ) -> None:
        """
        Alert the internal team when TTS synthesis switches between the main
        (pro) and backup (creator) ElevenLabs keys. Triggered from
        app/services/elevenlabs_keys.py on any active-key transition: main key
        low on quota, main key recovered, or the backup key erroring out.
        Internal-only. CC's settings.INTERNAL_ALERT_EMAIL_2 by default alongside
        settings.INTERNAL_ALERT_EMAIL.
        """
        text = f"ElevenLabs TTS key failover event.\n\n{reason}\n"

        self.provider.send_email(
            to=to,
            subject="[ElevenLabs Failover] TTS key switched",
            text_content=text,
            from_email="support@blog2video.app",
            cc=cc if cc is not None else [settings.INTERNAL_ALERT_EMAIL_2],
        )

    def send_custom_template_request_email(
        self,
        user_name: str,
        user_email: str,
        user_plan: str,
        description: str,
        alternate_contact: str | None = None,
        company_information: str | None = None,
        to: str = settings.INTERNAL_ALERT_EMAIL,
    ) -> None:
        """
        Forward a custom template request from a logged-in user to the internal team.
        Triggered by POST /api/contact/custom-template-request.
        """
        subject = f"[Custom Template Request] from {user_name}"
        alt_line = f"Alternate contact: {alternate_contact}" if alternate_contact else "Alternate contact: —"
        company_line = (
            f"Company information:\n{company_information}\n"
            if company_information
            else "Company information: —"
        )
        text = (
            f"New custom template request:\n\n"
            f"Name: {user_name}\n"
            f"Account email: {user_email}\n"
            f"Plan: {user_plan}\n"
            f"{alt_line}\n"
            f"{company_line}\n"
            f"Description:\n{description}\n"
        )
        alt_cell = f"<td style='color:#111827;border-bottom:1px solid #f3f4f6;'>{alternate_contact}</td>" if alternate_contact else "<td style='color:#9ca3af;border-bottom:1px solid #f3f4f6;'>—</td>"
        company_safe = html.escape(company_information, quote=False) if company_information else ""
        company_block = (
            f'<p style="margin:16px 0 8px;font-weight:600;color:#374151;">Company information</p>'
            f'<p style="margin:0;padding:16px;background:#f9fafb;border-radius:6px;color:#111827;white-space:pre-wrap;">{company_safe}</p>'
            if company_information
            else ""
        )
        html_body = f"""<!DOCTYPE html>
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
                      <span style="font-size:20px;font-weight:700;color:#ffffff;">Blog<span style="color:#c4b5fd;">2</span>Video — Custom Template Request</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px 40px;">
                      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                        <tr><td style="font-weight:600;color:#374151;width:160px;border-bottom:1px solid #f3f4f6;">Name</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{user_name}</td></tr>
                        <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Account email</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{user_email}</td></tr>
                        <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Plan</td><td style="color:#111827;border-bottom:1px solid #f3f4f6;">{user_plan}</td></tr>
                        <tr><td style="font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">Alternate contact</td>{alt_cell}</tr>
                      </table>
                      {company_block}
                      <p style="margin:24px 0 8px;font-weight:600;color:#374151;">Theme / Description</p>
                      <p style="margin:0;padding:16px;background:#f9fafb;border-radius:6px;color:#111827;white-space:pre-wrap;">{description}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>"""
        self.provider.send_email(to=to, subject=subject, html_content=html_body, text_content=text, from_email="sales@blog2video.app")

        # Send the requester a confirmation with the spam-folder note (account email always present).
        self._send_request_confirmation(
            to=user_email,
            first_name=user_name.split()[0] if user_name.strip() else "there",
        )



    @staticmethod
    def _blast_paragraph_inner(text: str) -> str:
        """Escape HTML and turn each newline into <br /> so single line breaks render in email clients."""
        lines = text.split("\n")
        return "<br />\n".join(html.escape(line) for line in lines)

    @staticmethod
    def _build_blast_html(subject: str, body_text: str, unsubscribe_url: str = "") -> str:
        # Split on blank lines → separate <p> blocks; single newlines inside a block → <br />
        paragraphs = "".join(
            f'<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.65;">'
            f"{EmailService._blast_paragraph_inner(p.strip())}</p>"
            for p in body_text.split("\n\n") if p.strip()
        )
        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(subject)}</title>
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
              {paragraphs}
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You received this because you have an account at Blog2Video.<br/>
                &copy; 2026 Blog2Video &middot; All rights reserved.
              </p>
              {f'<p style="margin:8px 0 0;font-size:12px;"><a href="{unsubscribe_url}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>' if unsubscribe_url else ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def send_referral_invite_email(self, to_email: str, referrer_name: str, referral_link: str) -> None:
        from app.models.referral import REFERRAL_BONUS_VIDEOS
        from app.models.user import FREE_TIER_INCLUDED_VIDEOS

        first_name = (referrer_name or "").split()[0] if referrer_name else "A friend"
        bonus = REFERRAL_BONUS_VIDEOS
        total = FREE_TIER_INCLUDED_VIDEOS + REFERRAL_BONUS_VIDEOS
        subject = f"{first_name} invited you to Blog2Video — get {bonus} free extra videos"

        text_content = (
            f"{first_name} invited you to Blog2Video!\n\n"
            f"Blog2Video is an AI tool that turns blog posts into polished videos in minutes.\n\n"
            f"Sign up through their invite link and get {bonus} bonus videos on top of your free plan "
            f"({total} total, no credit card required).\n\n"
            f"Get started: {referral_link}\n\n"
            f"Team Blog2Video\n"
        )
        html_content = (
            f"<pre style='font-family:inherit;font-size:15px;white-space:pre-wrap;margin:0;'>"
            f"{html.escape(first_name)} invited you to Blog2Video!\n\n"
            f"Blog2Video is an AI tool that turns blog posts into polished videos in minutes.\n\n"
            f"Sign up through their invite link and get {bonus} bonus videos on top of your free plan "
            f"({total} total, no credit card required).\n\n"
            f"Get started: {referral_link}\n\n"
            f"Team Blog2Video"
            f"</pre>"
        )
        self.provider.send_email(
            to=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
        )

    def send_collab_invite_email(
        self, to_email: str, inviter_name: str, project_name: str, accept_link: str
    ) -> None:
        """Invite a collaborator to co-edit a specific video/project."""
        first_name = (inviter_name or "").split()[0] if inviter_name else "Someone"
        proj = project_name or "a video"
        subject = f"{first_name} invited you to collaborate on “{proj}” on Blog2Video"

        text_content = (
            f"{first_name} invited you to collaborate on the video “{proj}” on Blog2Video.\n\n"
            f"You'll be able to edit the video together. Open the invite to accept "
            f"(sign in with this email address, {to_email}):\n\n"
            f"{accept_link}\n\n"
            f"Team Blog2Video\n"
        )
        html_content = self._build_html(
            headline=f"{html.escape(first_name)} invited you to collaborate",
            body_paragraph=(
                f"You've been invited to co-edit the video "
                f"<strong style=\"color:#111827;\">“{html.escape(proj)}”</strong> on Blog2Video. "
                f"You'll be able to edit the video together. "
                f"Accept the invite by signing in with this email address "
                f"(<strong style=\"color:#111827;\">{html.escape(to_email)}</strong>)."
            ),
            cta_label="Accept invite",
            cta_url=accept_link,
        )
        self.provider.send_email(
            to=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email=getattr(settings, "NOREPLY_EMAIL", "noreply@blog2video.app"),
        )

    def send_blast_email(self, user_email: str, user_name: str, subject: str, body: str) -> None:
        first_name = (user_name or "").split()[0] if user_name else "there"
        unsubscribe_url = self._make_unsubscribe_url(user_email)

        text_content = (
            f"Hi {first_name},\n\n"
            f"{body}\n\n"
            f"---\n"
            f"To unsubscribe from these emails, visit: {unsubscribe_url}\n"
        )

        html_content = (
            f"<pre style='font-family:inherit;font-size:15px;white-space:pre-wrap;margin:0;'>"
            f"Hi {html.escape(first_name)},\n\n"
            f"{html.escape(body)}"
            f"</pre>"
            f"<hr style='border:none;border-top:1px solid #e5e7eb;margin:24px 0;'/>"
            f"<p style='font-size:12px;color:#9ca3af;margin:0 0 6px;'>"
            f"Visit us at <a href='https://blog2video.app' style='color:#9ca3af;text-decoration:underline;text-decoration-color:#9ca3af;'>blog2video.app</a>"
            f"</p>"
            f"<p style='font-size:12px;color:#9ca3af;margin:0;'>"
            f"To unsubscribe from these emails, "
            f"<a href='{unsubscribe_url}' style='color:#9ca3af;text-decoration:underline;text-decoration-color:#9ca3af;'>click here</a>."
            f"</p>"
        )

        self.provider.send_email(
            to=user_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email="Arslan Shahid <arslan@blog2video.app>",
        )

        # Unosend (blast only — transactional mail uses Resend via self.provider):
        # from unosend import Unosend
        # client = Unosend(api_key=getattr(settings, "UNOSEND_API_KEY", ""))
        # response = client.emails.send(
        #     from_address="Arslan Shahid <arslan@blog2video.app>",
        #     to=user_email,
        #     subject=subject,
        #     html=html_content,
        #     text=text_content,
        # )
        # if response.error:
        #     raise EmailServiceError(f"Unosend error sending to {user_email}: {response.error.message}")

    def _make_unsubscribe_url(self, email: str) -> str:
        token = hmac.new(
            settings.JWT_SECRET.encode(),
            email.strip().lower().encode(),
            hashlib.sha256,
        ).hexdigest()
        api_base = getattr(settings, "BACKEND_URL", "http://localhost:8000").rstrip("/")
        import urllib.parse
        return f"{api_base}/unsubscribe?email={urllib.parse.quote(email.strip().lower())}&token={token}"


    def send_weekly_updates(
        self,
        user_email: str,
        user_name: str,
        dashboard_url: Optional[str] = None,
    ) -> None:
        """Product update email: plain text body with unsubscribe link in footer."""
        base = "https://blog2video.app"
        cta_url = dashboard_url or base
        display = (user_name or "").strip() or "there"
        subject = "WE JUST SHIPPED 🚀🚀🚀"
        unsubscribe_url = self._make_unsubscribe_url(user_email)

        text = (
            f"Hi {display},\n\n"
            "We've been busy shipping improvements to Blog2Video. Here's what's new:\n\n"
            "• Two new templates: Mosaic & Black Swan — add more visual variety to your videos.\n"
            "• Adjustable playback speed — fine-tune pacing during preview and render.\n"
            "• Smarter voiceovers — numbers, dates, and stats now sound natural every time.\n"
            "• Expert-crafted templates — professionally designed, ready to use out of the box.\n"
            "• Enhanced data visualization in Newscaster — richer charts for stats and trends.\n\n"
            f"Log in to try the new features: {cta_url}\n\n"
            "We'd love to hear what you think.\n\n"
            "Team Blog2Video\n\n"
            "---\n"
            f"To unsubscribe from these emails, click here: {unsubscribe_url}\n"
        )

        # Minimal HTML — plain text visually, clickable unsubscribe link in footer
        html_body = (
            f"<pre style='font-family:inherit;font-size:15px;white-space:pre-wrap;margin:0;'>"
            f"Hi {html.escape(display)},\n\n"
            "We've been busy shipping improvements to Blog2Video. Here's what's new:\n\n"
            "• Two new templates: Mosaic &amp; Black Swan — add more visual variety to your videos.\n"
            "• Adjustable playback speed — fine-tune pacing during preview and render.\n"
            "• Smarter voiceovers — numbers, dates, and stats now sound natural every time.\n"
            "• Expert-crafted templates — professionally designed, ready to use out of the box.\n"
            "• Enhanced data visualization in Newscaster — richer charts for stats and trends.\n\n"
            f"Log in to try the new features: {cta_url}\n\n"
            "We'd love to hear what you think.\n\n"
            "Arslan"
            f"</pre>"
            f"<hr style='border:none;border-top:1px solid #e5e7eb;margin:24px 0;'/>"
            f"<p style='font-size:12px;color:#9ca3af;margin:0;'>"
            f"To unsubscribe from these emails, "
            f"<a href='{unsubscribe_url}' style='color:#9ca3af;'>Unsubscribe</a>."
            f"</p>"
        )

        self.provider.send_email(
            to=user_email,
            subject=subject,
            html_content=html_body,
            text_content=text,
            from_email="Arslan Shahid <arslan@blog2video.app>",
        )


# ─── Singleton ────────────────────────────────────────────────

# Import this at every call site:
#   from app.services.email import email_service, EmailServiceError
email_service = EmailService()

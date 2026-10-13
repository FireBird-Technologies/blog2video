"""HTML for the MCP OAuth sign-in bridge (sign in / create account / verify email).

One shared shell so every step looks the same: brand header, a clear step title,
inline status banners, and buttons that disable themselves on submit (a double
submit used to burn the verification code and bounce people back with an error).
Pure functions returning strings — no DB or request access — so they are easy to
reason about and to test.
"""
from __future__ import annotations

from html import escape

from app.services.email_verification import CODE_TTL_SECONDS, RESEND_COOLDOWN_SECONDS

SESSION_MINUTES = 10  # mirrors mcp_provider.AUTH_CODE_TTL_SECONDS

_CSS = """
:root{color-scheme:light;--brand:#9333ea;--brand-d:#7e22ce;--brand-soft:#faf5ff;--brand-line:#e9d5ff;
--text:#111827;--muted:#6b7280;--soft:#f9fafb;--line:#e5e7eb;--card:#fff;
--err-bg:#fff1f2;--err:#be123c;--err-line:#fecdd3;--ok-bg:#ecfdf5;--ok:#047857;--ok-line:#a7f3d0}
*{box-sizing:border-box}
html{min-width:320px;background:#fff}
body{margin:0;min-height:100vh;color:var(--text);font:15px/1.5 "Plus Jakarta Sans","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
background:linear-gradient(180deg,#faf7ff 0,#fff 42%,#fff 100%);-webkit-font-smoothing:antialiased}
.page{position:relative;isolation:isolate;min-height:100vh;display:flex;flex-direction:column;overflow:hidden}
.page:before,.page:after{content:"";position:absolute;z-index:-1;border-radius:999px;pointer-events:none;filter:blur(2px)}
.page:before{width:540px;height:540px;left:-270px;top:-250px;background:radial-gradient(circle,rgba(147,51,234,.12),rgba(147,51,234,0) 70%)}
.page:after{width:480px;height:480px;right:-260px;bottom:-260px;background:radial-gradient(circle,rgba(192,132,252,.10),rgba(192,132,252,0) 70%)}
.topbar{height:68px;display:flex;align-items:center;border-bottom:1px solid rgba(229,231,235,.78);background:rgba(255,255,255,.76);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.topbar-inner{width:100%;max-width:1152px;margin:auto;padding:0 24px}
.brand{width:max-content;display:flex;align-items:center;gap:11px;color:var(--text);text-decoration:none}
.logo{width:38px;height:38px;border-radius:10px;background:var(--brand);color:#fff;display:grid;place-items:center;
font-weight:800;font-size:13px;letter-spacing:-.35px;box-shadow:0 7px 18px rgba(147,51,234,.22)}
.brand-name{font-size:19px;font-weight:700;letter-spacing:-.45px}
.content{width:100%;flex:1;display:grid;place-items:center;padding:48px 20px 56px}
.stack{width:100%;max-width:440px}
.connection{display:flex;align-items:center;justify-content:center;gap:7px;margin:0 0 14px;color:var(--brand-d);font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.connection svg{width:15px;height:15px}
.card{position:relative;width:100%;background:rgba(255,255,255,.96);border:1px solid rgba(233,213,255,.86);border-radius:22px;
padding:34px 36px;box-shadow:0 24px 70px rgba(88,28,135,.10),0 2px 10px rgba(17,24,39,.04)}
.card:before{content:"";position:absolute;left:28px;right:28px;top:-1px;height:2px;border-radius:0 0 999px 999px;background:linear-gradient(90deg,transparent,#c084fc,transparent);opacity:.9}
h1{font-size:24px;line-height:1.25;margin:0 0 8px;text-align:center;letter-spacing:-.55px;font-weight:700}
.sub{color:var(--muted);margin:0 0 22px;text-align:center;font-size:13.5px;line-height:1.65}
.tabs{display:grid;grid-template-columns:1fr 1fr;background:#f7f3fb;border:1px solid #eee7f5;border-radius:12px;padding:4px;margin-bottom:22px}
.tabs a{text-align:center;padding:8px 10px;border-radius:9px;font-size:13px;font-weight:650;color:var(--muted);text-decoration:none;transition:color .15s,background .15s,box-shadow .15s}
.tabs a:hover{color:var(--brand-d)}
.tabs a.on{background:#fff;color:var(--brand-d);box-shadow:0 1px 4px rgba(88,28,135,.10)}
.banner{border:1px solid transparent;border-radius:11px;padding:11px 13px;font-size:13px;line-height:1.45;margin:0 0 17px;display:flex;gap:9px;align-items:flex-start}
.banner.err{background:var(--err-bg);border-color:var(--err-line);color:var(--err)}
.banner.ok{background:var(--ok-bg);border-color:var(--ok-line);color:var(--ok)}
.banner.info{background:var(--brand-soft);border-color:var(--brand-line);color:#6b21a8}
.banner svg{flex:none;margin-top:1px}
label{display:block;font-size:12.5px;font-weight:650;margin:0 0 6px;color:#374151}
.field{margin-bottom:15px}
input[type=text],input[type=email],input[type=password]{width:100%;min-height:45px;padding:11px 13px;border:1px solid #d1d5db;
border-radius:10px;font:inherit;font-size:14px;background:#fff;color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
input::placeholder{color:#9ca3af}input:hover{border-color:#b8bdc7}
input:focus{border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,.13)}
.pw{position:relative}.pw input{padding-right:58px}.pw button{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:none;border:0;
color:var(--brand-d);font:inherit;font-size:12px;font-weight:650;cursor:pointer;padding:7px 7px;border-radius:6px}.pw button:hover{background:var(--brand-soft)}
.hint{font-size:11.5px;line-height:1.5;color:var(--muted);margin:6px 0 0}
.btn{width:100%;min-height:45px;display:flex;align-items:center;justify-content:center;gap:10px;padding:11px 16px;border-radius:10px;
font:inherit;font-size:13.5px;font-weight:650;cursor:pointer;text-decoration:none;border:1px solid #d1d5db;background:#fff;color:#374151;transition:transform .15s,background .15s,border-color .15s,box-shadow .15s,opacity .15s}
.btn:hover{background:var(--soft);border-color:#b8bdc7}.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 8px 20px rgba(147,51,234,.20)}
.btn.primary:hover{background:var(--brand-d);border-color:var(--brand-d);box-shadow:0 10px 24px rgba(126,34,206,.25)}
.btn[disabled]{opacity:.58;cursor:not-allowed;box-shadow:none;transform:none}
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:s .7s linear infinite;display:none}
.btn.loading .spin{display:inline-block}@keyframes s{to{transform:rotate(360deg)}}
.or{display:flex;align-items:center;gap:12px;color:#9ca3af;font-size:10.5px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;margin:19px 0}
.or:before,.or:after{content:"";flex:1;height:1px;background:var(--line)}
.code{font:700 27px/1 ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:.42em;text-align:center;padding:15px 7px 15px 18px!important}
.row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:15px;font-size:12.5px;color:var(--muted)}
.linkbtn{background:none;border:0;color:var(--brand-d);font:inherit;font-weight:650;cursor:pointer;padding:0}
.linkbtn:hover,a:hover{color:#6b21a8}.linkbtn[disabled]{color:#9ca3af;cursor:not-allowed;font-weight:500}
a{color:var(--brand-d)}
.foot{margin:19px 8px 0;text-align:center;font-size:10.5px;line-height:1.6;color:#9ca3af}
.secure{display:flex;align-items:center;justify-content:center;gap:7px;margin:16px 0 0;color:#9ca3af;font-size:11px}
.secure svg{width:13px;height:13px}
.big{width:58px;height:58px;display:grid;place-items:center;margin:0 auto 14px;border:1px solid var(--brand-line);border-radius:17px;background:var(--brand-soft);font-size:29px;text-align:center}
@media(max-width:520px){.topbar{height:62px}.topbar-inner{padding:0 18px}.logo{width:34px;height:34px;border-radius:9px}.brand-name{font-size:17px}
.content{place-items:start center;padding:34px 16px 42px}.card{padding:29px 22px;border-radius:18px}h1{font-size:22px}.row{align-items:flex-start;flex-direction:column;gap:10px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
"""

_JS = """
document.querySelectorAll('form[data-once]').forEach(function(f){
  f.addEventListener('submit',function(){
    if(f.dataset.sent){return false}
    f.dataset.sent='1';
    f.querySelectorAll('button[type=submit]').forEach(function(b){b.disabled=true;b.classList.add('loading');
      var l=b.querySelector('.lbl');if(l&&b.dataset.busy){l.textContent=b.dataset.busy}});
  });
});
document.querySelectorAll('[data-toggle-pw]').forEach(function(b){
  b.addEventListener('click',function(){
    var i=document.getElementById(b.dataset.togglePw);
    var show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';
  });
});
var cd=document.getElementById('resend-btn');
if(cd){
  var left=parseInt(cd.dataset.wait||'0',10),lbl=document.getElementById('resend-lbl');
  (function tick(){
    if(left>0){cd.disabled=true;lbl.textContent='Resend in '+left+'s';left--;setTimeout(tick,1000)}
    else{cd.disabled=false;lbl.textContent='Resend code'}
  })();
}
var otp=document.getElementById('otp');
if(otp){otp.addEventListener('input',function(){otp.value=otp.value.replace(/\\D/g,'').slice(0,6)});otp.focus()}
"""

_ICON_ERR = ('<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V6h2v3z"/></svg>')
_ICON_OK = ('<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm-1.2 11.4L5.6 10.2l1.4-1.4 1.8 1.8 4.2-4.2 1.4 1.4-5.6 5.6z"/></svg>')
_GOOGLE = ('<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.84v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.51 10.53A4.8 4.8 0 0 1 4.26 9c0-.53.09-1.04.25-1.53V5.4H1.84A8 8 0 0 0 .98 9c0 1.29.31 2.51.86 3.6l2.67-2.07z"/><path fill="#EA4335" d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1a8 8 0 0 0-7.14 4.4l2.67 2.07c.63-1.89 2.39-3.29 4.47-3.29z"/></svg>')


def _shell(title: str, inner: str, site_url: str = "") -> str:
    legal = ""
    home = "#"
    favicon = ""
    if site_url:
        s = escape(site_url.rstrip("/"))
        home = s
        favicon = f'<link rel="icon" href="{s}/favicon.ico">'
        legal = (f'<p class="foot">By continuing you agree to the <a href="{s}/terms" target="_blank" rel="noopener">Terms</a> '
                 f'and <a href="{s}/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>')
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>{escape(title)} · Blog2Video</title>'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">{favicon}'
            f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            f'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">'
            f'<style>{_CSS}</style></head><body><div class="page"><header class="topbar"><div class="topbar-inner">'
            f'<a class="brand" href="{home}"><span class="logo">B2V</span><span class="brand-name">Blog2Video</span></a>'
            f'</div></header><main class="content"><div class="stack"><div class="connection">'
            f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
            f'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>'
            f'<span>MCP connection</span></div><section class="card">{inner}</section>{legal}'
            f'<p class="secure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
            f'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
            f'<span>Secure authorization powered by Blog2Video</span></p></div></main></div><script>{_JS}</script></body></html>')


def _banners(error: str | None, info: str | None) -> str:
    out = ""
    if error:
        out += f'<div class="banner err" role="alert">{_ICON_ERR}<span>{escape(error)}</span></div>'
    if info:
        out += f'<div class="banner ok" role="status">{_ICON_OK}<span>{escape(info)}</span></div>'
    return out


def _tabs(active: str, backend: str, code: str) -> str:
    c = escape(code)
    return (f'<nav class="tabs"><a class="{"on" if active == "login" else ""}" href="{backend}/mcp/google-start?code={c}">Sign in</a>'
            f'<a class="{"on" if active == "signup" else ""}" href="{backend}/mcp/signup?code={c}">Create account</a></nav>')


def _hidden(code: str, email: str = "") -> str:
    h = f'<input type="hidden" name="code" value="{escape(code)}">'
    if email:
        h += f'<input type="hidden" name="email" value="{escape(email)}">'
    return h


def _submit(label: str, busy: str) -> str:
    return (f'<button class="btn primary" type="submit" data-busy="{escape(busy)}"><span class="spin"></span>'
            f'<span class="lbl">{escape(label)}</span></button>')


def login_page(*, code: str, backend: str, google_url: str, site_url: str,
               error: str | None = None, email: str = "") -> str:
    inner = f"""
<h1>Connect your account</h1>
<p class="sub">Sign in to let your AI assistant create and manage videos in Blog2Video.</p>
{_tabs("login", backend, code)}{_banners(error, None)}
<a class="btn" href="{escape(google_url)}">{_GOOGLE}<span>Continue with Google</span></a>
<div class="or">or use email</div>
<form method="post" action="{backend}/mcp/email-login" data-once>{_hidden(code)}
  <div class="field"><label for="email">Email</label>
    <input id="email" type="email" name="email" value="{escape(email)}" required autocomplete="email" placeholder="you@example.com"></div>
  <div class="field"><label for="password">Password</label>
    <div class="pw"><input id="password" type="password" name="password" required autocomplete="current-password" placeholder="Your password">
    <button type="button" data-toggle-pw="password">Show</button></div></div>
  {_submit("Sign in", "Signing in…")}
</form>
<p class="foot" style="margin-top:14px">This sign-in link expires in {SESSION_MINUTES} minutes.</p>"""
    return _shell("Sign in", inner, site_url)


def signup_page(*, code: str, backend: str, google_url: str, site_url: str,
                error: str | None = None, email: str = "", name: str = "") -> str:
    inner = f"""
<h1>Create your account</h1>
<p class="sub">Free to start. We'll email you a 6-digit code to confirm your address.</p>
{_tabs("signup", backend, code)}{_banners(error, None)}
<a class="btn" href="{escape(google_url)}">{_GOOGLE}<span>Sign up with Google</span></a>
<div class="or">or use email</div>
<form method="post" action="{backend}/mcp/signup-start" data-once>{_hidden(code)}
  <div class="field"><label for="name">Name <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
    <input id="name" type="text" name="name" value="{escape(name)}" autocomplete="name" placeholder="Your name"></div>
  <div class="field"><label for="email">Email</label>
    <input id="email" type="email" name="email" value="{escape(email)}" required autocomplete="email" placeholder="you@example.com"></div>
  <div class="field"><label for="password">Password</label>
    <div class="pw"><input id="password" type="password" name="password" required autocomplete="new-password" placeholder="Create a password">
    <button type="button" data-toggle-pw="password">Show</button></div>
    <p class="hint">At least 8 characters, with an uppercase letter and a special character.</p></div>
  {_submit("Send verification code", "Sending code…")}
</form>"""
    return _shell("Create account", inner, site_url)


def verify_page(*, code: str, backend: str, site_url: str, email: str,
                error: str | None = None, info: str | None = None, wait: int = 0) -> str:
    inner = f"""
<div class="big">📬</div>
<h1 style="text-align:center">Check your email</h1>
<p class="sub" style="text-align:center">We sent a 6-digit code to<br><b style="color:var(--text)">{escape(email)}</b></p>
{_banners(error, info)}
<form method="post" action="{backend}/mcp/signup-verify" data-once>{_hidden(code, email)}
  <div class="field"><label for="otp">Verification code</label>
    <input id="otp" class="code" type="text" name="otp" inputmode="numeric" pattern="[0-9]{{6}}" maxlength="6"
      autocomplete="one-time-code" placeholder="••••••" required>
    <p class="hint">The code is valid for {CODE_TTL_SECONDS // 60} minutes. Check your spam folder if you don't see it.</p></div>
  {_submit("Verify & connect", "Verifying…")}
</form>
<div class="row">
  <form method="post" action="{backend}/mcp/signup-resend" data-once style="margin:0">{_hidden(code, email)}
    <button id="resend-btn" class="linkbtn" type="submit" data-wait="{wait}"><span id="resend-lbl">Resend code</span></button></form>
  <a href="{backend}/mcp/signup?code={escape(code)}&email={escape(email)}">Wrong email?</a>
</div>"""
    return _shell("Verify email", inner, site_url)


def expired_page(*, site_url: str = "") -> str:
    inner = """
<div class="big">⏱️</div>
<h1 style="text-align:center">This sign-in link has expired</h1>
<p class="sub" style="text-align:center">For your security, each sign-in link only works for a few minutes
and once. Go back to your AI assistant and choose <b>Connect</b> again to get a fresh one.</p>"""
    return _shell("Link expired", inner, site_url)


def resend_wait_default() -> int:
    return RESEND_COOLDOWN_SECONDS

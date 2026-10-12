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
:root{--bg:#f6f5fb;--card:#fff;--text:#14141a;--muted:#5d5d6b;--line:#e3e1ee;--brand:#9333ea;--brand-d:#7e22ce;
--err-bg:#fdecee;--err:#b4232f;--ok-bg:#e9f7ef;--ok:#17653a;--info-bg:#f1ebfd;--info:#5b21b6}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f14;--card:#181820;--text:#f2f2f6;--muted:#a2a2b2;--line:#2c2c38;
--err-bg:#3a1a1f;--err:#ff9aa4;--ok-bg:#16301f;--ok:#8fe3b0;--info-bg:#251a3d;--info:#d3b8ff}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);border-radius:16px;
padding:32px 28px;box-shadow:0 8px 40px rgba(20,20,40,.07)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.logo{width:36px;height:36px;border-radius:10px;background:var(--brand);color:#fff;display:grid;place-items:center;
font-weight:700;font-size:13px;letter-spacing:-.3px}
.brand b{font-size:16px}
h1{font-size:21px;line-height:1.25;margin:0 0 6px;letter-spacing:-.2px}
.sub{color:var(--muted);margin:0 0 20px;font-size:14px}
.tabs{display:grid;grid-template-columns:1fr 1fr;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:3px;margin-bottom:20px}
.tabs a{text-align:center;padding:8px;border-radius:8px;font-size:14px;font-weight:600;color:var(--muted);text-decoration:none}
.tabs a.on{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.banner{border-radius:10px;padding:11px 13px;font-size:13.5px;margin:0 0 16px;display:flex;gap:9px;align-items:flex-start}
.banner.err{background:var(--err-bg);color:var(--err)}.banner.ok{background:var(--ok-bg);color:var(--ok)}
.banner.info{background:var(--info-bg);color:var(--info)}
.banner svg{flex:none;margin-top:2px}
label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}
.field{margin-bottom:14px}
input[type=text],input[type=email],input[type=password]{width:100%;padding:12px 13px;border:1px solid var(--line);
border-radius:10px;font:inherit;background:var(--card);color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(147,51,234,.18)}
.pw{position:relative}.pw button{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;
color:var(--muted);font-size:12.5px;font-weight:600;cursor:pointer;padding:6px 8px}
.hint{font-size:12.5px;color:var(--muted);margin:6px 0 0}
.btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 16px;border-radius:10px;
font:inherit;font-weight:600;cursor:pointer;text-decoration:none;border:1px solid var(--line);background:var(--card);color:var(--text);transition:background .15s,opacity .15s}
.btn:hover{background:var(--bg)}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn.primary:hover{background:var(--brand-d)}
.btn[disabled]{opacity:.6;cursor:not-allowed}
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:s .7s linear infinite;display:none}
.btn.loading .spin{display:inline-block}@keyframes s{to{transform:rotate(360deg)}}
.or{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:12.5px;margin:18px 0}
.or:before,.or:after{content:"";flex:1;height:1px;background:var(--line)}
.code{font:600 28px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.5em;text-align:center;padding:16px 8px 16px 20px!important}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:13.5px;color:var(--muted)}
.linkbtn{background:none;border:0;color:var(--brand);font:inherit;font-weight:600;cursor:pointer;padding:0}
.linkbtn[disabled]{color:var(--muted);cursor:not-allowed;font-weight:500}
a{color:var(--brand)}
.foot{margin-top:22px;text-align:center;font-size:12px;color:var(--muted)}
.big{font-size:44px;text-align:center;margin:0 0 6px}
@media(max-width:420px){.card{padding:26px 20px}}
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
    if site_url:
        s = escape(site_url.rstrip("/"))
        legal = (f'<p class="foot">By continuing you agree to the <a href="{s}/terms" target="_blank" rel="noopener">Terms</a> '
                 f'and <a href="{s}/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>')
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>{escape(title)} · Blog2Video</title>'
            f'<meta name="viewport" content="width=device-width, initial-scale=1"><style>{_CSS}</style></head>'
            f'<body><main class="card"><div class="brand"><span class="logo">B2V</span><b>Blog2Video</b></div>'
            f'{inner}{legal}</main><script>{_JS}</script></body></html>')


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

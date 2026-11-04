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

_CSS = """
:root{color-scheme:light;--brand:#9333ea;--brand-d:#7e22ce;--brand-soft:#faf5ff;--brand-line:#e9d5ff;
--text:#111827;--muted:#4b5563;--soft:#f9fafb;--line:#e5e7eb;--card:#fff;
--err-bg:#fff1f2;--err:#be123c;--err-line:#fecdd3;--ok-bg:#ecfdf5;--ok:#047857;--ok-line:#a7f3d0}
*{box-sizing:border-box}
html{min-width:320px;min-height:100%;background:#fff}
body{margin:0;min-height:100vh;color:var(--text);font:16px/1.5 "Plus Jakarta Sans","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;background:#fff}
.page{min-height:100vh;display:flex;flex-direction:column;background:#fff}
.topbar{position:sticky;top:0;z-index:50;border-bottom:1px solid rgba(229,231,235,.6);background:rgba(255,255,255,.7);
backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.topbar-inner{width:100%;max-width:1152px;margin:auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.brand{width:max-content;display:flex;align-items:center;gap:12px;color:var(--text);text-decoration:none}
.logo{width:36px;height:36px;border-radius:8px;background:#9333ea;color:#fff;display:grid;place-items:center;
font-weight:700;font-size:14px;line-height:20px;letter-spacing:normal}
.brand-name{font-size:20px;line-height:28px;font-weight:600;letter-spacing:normal}
.navlinks{display:flex;align-items:center;gap:16px}
.navlinks a{color:#6b7280;text-decoration:none;font-size:14px;line-height:20px;font-weight:400;white-space:nowrap}
.navlinks a:hover{color:#111827}.navlinks .contact{padding:8px 16px;border-radius:8px;background:#9333ea;color:#fff;font-weight:500}
.navlinks .contact:hover{background:#7e22ce;color:#fff}.chev{display:inline-block;width:12px;margin-left:2px;vertical-align:-2px}
.menu-toggle{display:none;width:40px;height:40px;padding:8px;border:0;border-radius:8px;background:transparent;color:#4b5563;cursor:pointer}
.menu-toggle:hover{background:#f3f4f6;color:#111827}.menu-toggle svg{display:block;width:24px;height:24px}
.mobile-nav{display:none;border-top:1px solid rgba(229,231,235,.6);background:rgba(255,255,255,.96);padding:8px 24px 16px}
.mobile-nav.open{display:grid}.mobile-nav a{padding:9px 0;color:#6b7280;text-decoration:none;font-size:14px}.mobile-nav .contact{color:#7e22ce;font-weight:600}
.content{width:100%;min-height:calc(100vh - 64px);display:flex;align-items:center;justify-content:center;padding:48px 16px}
.stack{width:100%;max-width:512px;border-radius:16px;background:#fff;padding:32px 40px}
.card{width:100%;background:#fff;padding:0}
h1{font-size:24px;line-height:32px;margin:0;text-align:center;letter-spacing:normal;font-weight:600;color:#111827}
.sub{color:#4b5563;margin:4px 0 0;text-align:center;font-size:14px;line-height:20px}
.auth-body{width:100%;margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:16px}
.column{width:340px;max-width:100%}
.banner{width:340px;max-width:100%;border:1px solid transparent;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.45;margin:0;display:flex;gap:9px;align-items:flex-start}
.banner.err{background:var(--err-bg);border-color:var(--err-line);color:var(--err)}
.banner.ok{background:var(--ok-bg);border-color:var(--ok-line);color:var(--ok)}
.banner.info{background:var(--brand-soft);border-color:var(--brand-line);color:#6b21a8}
.banner svg{flex:none;margin-top:1px}
label{display:block;font-size:12px;font-weight:600;margin:0 0 6px;color:#374151}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.field{margin-bottom:12px}
input[type=text],input[type=email],input[type=password]{width:100%;min-height:40px;padding:8px 12px;border:1px solid #d1d5db;
border-radius:8px;font:inherit;font-size:14px;line-height:20px;background:#fff;color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s,background .15s}
input::placeholder{color:#9ca3af}input:hover{border-color:#b8bdc7}
input:focus{border-color:#a855f7;box-shadow:0 0 0 3px rgba(168,85,247,.13)}
.pw{position:relative}.pw input{padding-right:58px}.pw button{position:absolute;right:7px;top:50%;transform:translateY(-50%);background:none;border:0;
color:var(--brand-d);font:inherit;font-size:12px;font-weight:650;cursor:pointer;padding:7px 7px;border-radius:6px}.pw button:hover{background:var(--brand-soft)}
.hint{font-size:11.5px;line-height:1.5;color:var(--muted);margin:6px 0 0}
.btn{width:340px;max-width:100%;min-height:40px;display:flex;align-items:center;justify-content:center;gap:10px;padding:8px 16px;border-radius:8px;
font:inherit;font-size:14px;line-height:20px;font-weight:500;cursor:pointer;text-decoration:none;border:1px solid #d1d5db;background:#fff;color:#374151;transition:transform .15s,background .15s,border-color .15s,box-shadow .15s,opacity .15s}
.btn:hover{background:var(--soft);border-color:#b8bdc7}.btn:active{transform:translateY(1px)}
.btn.google{position:relative;width:300px;min-height:44px;justify-content:center;border-radius:9999px;color:#3c4043;
font-family:"Roboto",Arial,sans-serif;font-size:14px;line-height:20px;font-weight:400}.btn.google svg{position:absolute;left:12px}
.btn.primary{min-height:40px;padding:10px 16px;border:0;background:#9333ea;color:#fff}
.btn.primary:hover{background:#7e22ce}
.btn[disabled]{opacity:.5;cursor:not-allowed;box-shadow:none;transform:none}
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:s .7s linear infinite;display:none}
.btn.loading .spin{display:inline-block}@keyframes s{to{transform:rotate(360deg)}}
.or{width:340px;max-width:100%;display:flex;align-items:center;gap:12px;color:#9ca3af;font-size:12px;line-height:16px;font-weight:400;letter-spacing:.025em;text-transform:uppercase;padding:4px 0;margin:0}
.or:before,.or:after{content:"";flex:1;height:1px;background:var(--line)}
.code{font:700 27px/1 ui-monospace,SFMono-Regular,Menlo,monospace!important;letter-spacing:.42em;text-align:center;padding:15px 7px 15px 18px!important}
.row{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:15px;font-size:12.5px;color:var(--muted)}
.mode-switch{margin:0;text-align:center;font-size:14px;line-height:20px;color:#6b7280}
.mode-switch a{font-weight:500;color:#9333ea;text-decoration:underline}
.linkbtn{background:none;border:0;color:var(--brand-d);font:inherit;font-weight:650;cursor:pointer;padding:0}
.linkbtn:hover,.row a:hover{color:#6b21a8}.linkbtn[disabled]{color:#9ca3af;cursor:not-allowed;font-weight:500}
a{color:var(--brand-d)}
.foot{margin:24px 8px 0;text-align:center;font-size:12px;line-height:19.5px;font-weight:400;color:#9ca3af}
.foot a{color:inherit;text-decoration:underline}.foot a:hover{color:#4b5563}
.big{width:58px;height:58px;display:grid;place-items:center;margin:0 auto 14px;border:1px solid var(--brand-line);border-radius:17px;background:var(--brand-soft);font-size:29px;text-align:center}
@media(max-width:767px){.navlinks{display:none}.menu-toggle{display:block}}
@media(max-width:520px){.topbar-inner{padding:12px 18px}.logo{width:34px;height:34px}.brand-name{font-size:18px}
.content{align-items:flex-start;padding:64px 16px 40px}.stack{padding:24px 8px}h1{font-size:22px;line-height:30px}.row{align-items:flex-start;flex-direction:column;gap:10px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
"""

_JS = """
document.querySelectorAll('form[data-email-stage]').forEach(function(f){
  var email=f.querySelector('input[type=email]'),submit=f.querySelector('button[type=submit]');
  if(!email||!submit){return}
  function sync(){submit.disabled=!email.value.trim()||!email.checkValidity()}
  email.addEventListener('input',sync);sync();
});
document.querySelectorAll('form[data-once]').forEach(function(f){
  f.addEventListener('submit',function(e){
    var details=f.querySelector('[data-auth-details]');
    if(details&&details.hidden){
      e.preventDefault();details.hidden=false;
      details.querySelectorAll('[disabled]').forEach(function(i){i.disabled=false});
      var next=f.querySelector('[data-next-label]'),lbl=f.querySelector('.lbl');
      if(next&&lbl){lbl.textContent=next.dataset.nextLabel||lbl.textContent}
      var focus=details.querySelector('input');if(focus){focus.focus()}
      return false;
    }
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
var menu=document.getElementById('menu-toggle'),mobile=document.getElementById('mobile-nav');
if(menu&&mobile){menu.addEventListener('click',function(){
  var open=mobile.classList.toggle('open');menu.setAttribute('aria-expanded',open?'true':'false');
})}
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
        legal = (f'<p class="foot">By continuing you agree to our <a href="{s}/terms" target="_blank" rel="noopener">Terms</a> '
                 f'and <a href="{s}/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p>')
    def link(path: str) -> str:
        return f"{escape(site_url.rstrip('/'))}{path}" if site_url else "#"

    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>{escape(title)} · Blog2Video</title>'
            f'<meta name="viewport" content="width=device-width, initial-scale=1">{favicon}'
            f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            f'<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto:wght@400;500&display=swap" rel="stylesheet">'
            f'<style>{_CSS}</style></head><body><div class="page"><header class="topbar"><div class="topbar-inner">'
            f'<a class="brand" href="{home}"><span class="logo">B2V</span><span class="brand-name">Blog2Video</span></a>'
            f'<nav class="navlinks" aria-label="Main navigation">'
            f'<a href="{link("/blog-to-video")}">Blog to Video</a>'
            f'<a href="{link("/for-technical-bloggers")}">Use Cases</a>'
            f'<a href="{link("/templates/nightfall")}">Templates</a>'
            f'<a href="{link("/tools")}">Tools <svg class="chev" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg></a>'
            f'<a href="{link("/help")}">Help</a><a href="{link("/blogs")}">Blog</a>'
            f'<a href="{link("/api-docs")}">API docs</a><a href="{link("/pricing")}">Pricing</a>'
            f'<a class="contact" href="{link("/contact")}">Contact</a></nav>'
            f'<button id="menu-toggle" class="menu-toggle" type="button" aria-label="Open navigation" aria-controls="mobile-nav" aria-expanded="false">'
            f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg></button>'
            f'</div><nav id="mobile-nav" class="mobile-nav" aria-label="Mobile navigation">'
            f'<a href="{link("/blog-to-video")}">Blog to Video</a><a href="{link("/for-technical-bloggers")}">Use Cases</a>'
            f'<a href="{link("/templates/nightfall")}">Templates</a><a href="{link("/tools")}">Tools</a>'
            f'<a href="{link("/help")}">Help</a><a href="{link("/blogs")}">Blog</a><a href="{link("/api-docs")}">API docs</a>'
            f'<a href="{link("/pricing")}">Pricing</a><a class="contact" href="{link("/contact")}">Contact</a></nav>'
            f'</header><main class="content"><div class="stack"><section class="card">{inner}</section>{legal}'
            f'</div></main></div><script>{_JS}</script></body></html>')


def _banners(error: str | None, info: str | None) -> str:
    out = ""
    if error:
        out += f'<div class="banner err" role="alert">{_ICON_ERR}<span>{escape(error)}</span></div>'
    if info:
        out += f'<div class="banner ok" role="status">{_ICON_OK}<span>{escape(info)}</span></div>'
    return out


def _mode_switch(active: str, backend: str, code: str) -> str:
    c = escape(code)
    if active == "login":
        return (f'<p class="mode-switch">Don\'t have an account? '
                f'<a href="{backend}/mcp/signup?code={c}">Create account</a></p>')
    return (f'<p class="mode-switch">Already have an account? '
            f'<a href="{backend}/mcp/google-start?code={c}">Sign in</a></p>')


def _hidden(code: str, email: str = "") -> str:
    h = f'<input type="hidden" name="code" value="{escape(code)}">'
    if email:
        h += f'<input type="hidden" name="email" value="{escape(email)}">'
    return h


def _submit(label: str, busy: str, next_label: str = "") -> str:
    next_attr = f' data-next-label="{escape(next_label)}"' if next_label else ""
    return (f'<button class="btn primary" type="submit" data-busy="{escape(busy)}"{next_attr}><span class="spin"></span>'
            f'<span class="lbl">{escape(label)}</span></button>')


def login_page(*, code: str, backend: str, google_url: str, site_url: str,
               error: str | None = None, email: str = "") -> str:
    details_hidden = "" if error else " hidden"
    details_disabled = "" if error else " disabled"
    submit_label = "Sign in" if error else "Continue"
    inner = f"""
<h1>Sign in to Blog2Video</h1>
<p class="sub">Choose how you'd like to continue.</p>
<div class="auth-body">
{_banners(error, None)}
<a class="btn google" href="{escape(google_url)}"><span>Continue with Google</span>{_GOOGLE}</a>
<div class="or">OR</div>
<form class="column" method="post" action="{backend}/mcp/email-login" data-once data-email-stage>{_hidden(code)}
  <div class="field"><label class="sr-only" for="email">Email</label>
    <input id="email" type="email" name="email" value="{escape(email)}" required autocomplete="email" placeholder="you@example.com"></div>
  <div data-auth-details{details_hidden}><div class="field"><label class="sr-only" for="password">Password</label>
    <div class="pw"><input id="password" type="password" name="password" required{details_disabled} autocomplete="current-password" placeholder="Your password">
    <button type="button" data-toggle-pw="password">Show</button></div></div></div>
  {_submit(submit_label, "Signing in…", "Sign in")}
</form>
{_mode_switch("login", backend, code)}
</div>"""
    return _shell("Sign in", inner, site_url)


def signup_page(*, code: str, backend: str, google_url: str, site_url: str,
                error: str | None = None, email: str = "", name: str = "") -> str:
    details_hidden = "" if error else " hidden"
    details_disabled = "" if error else " disabled"
    submit_label = "Send verification code" if error else "Continue"
    inner = f"""
<h1>Create your Blog2Video account</h1>
<p class="sub">Choose how you'd like to get started.</p>
<div class="auth-body">
{_banners(error, None)}
<a class="btn google" href="{escape(google_url)}"><span>Continue with Google</span>{_GOOGLE}</a>
<div class="or">OR</div>
<form class="column" method="post" action="{backend}/mcp/signup-start" data-once data-email-stage>{_hidden(code)}
  <div class="field"><label class="sr-only" for="email">Email</label>
    <input id="email" type="email" name="email" value="{escape(email)}" required autocomplete="email" placeholder="you@example.com"></div>
  <div data-auth-details{details_hidden}>
  <div class="field"><label class="sr-only" for="name">Name (optional)</label>
    <input id="name" type="text" name="name" value="{escape(name)}"{details_disabled} autocomplete="name" placeholder="Your name (optional)"></div>
  <div class="field"><label class="sr-only" for="password">Password</label>
    <div class="pw"><input id="password" type="password" name="password" required{details_disabled} autocomplete="new-password" placeholder="Create a password">
    <button type="button" data-toggle-pw="password">Show</button></div>
    <p class="hint">At least 8 characters, with an uppercase letter and a special character.</p></div></div>
  {_submit(submit_label, "Sending code…", "Send verification code")}
</form>
{_mode_switch("signup", backend, code)}
</div>"""
    return _shell("Create account", inner, site_url)


def verify_page(*, code: str, backend: str, site_url: str, email: str,
                error: str | None = None, info: str | None = None, wait: int = 0) -> str:
    inner = f"""
<div class="big">📬</div>
<h1 style="text-align:center">Check your email</h1>
<p class="sub" style="text-align:center">We sent a 6-digit code to<br><b style="color:var(--text)">{escape(email)}</b></p>
<div class="auth-body">
{_banners(error, info)}
<form class="column" method="post" action="{backend}/mcp/signup-verify" data-once>{_hidden(code, email)}
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
</div></div>"""
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

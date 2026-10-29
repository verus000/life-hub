/* 前端认证：登录、注册、重发验证邮件与激活链接处理。仅在 API 模式下启用。 */
window.Auth = (function () {
  const TITLE = { login: '登录', register: '注册新账号', resend: '重发验证邮件' };
  let visible = false;

  function el(id) { return document.getElementById(id); }
  function val(id) { const x = el(id); return x ? String(x.value || '').trim() : ''; }

  function api(path, options) {
    return fetch('api/auth/' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options))
      .then(function (res) {
        return res.text().then(function (text) {
          let data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { /* 空响应 */ }
          return { ok: res.ok, status: res.status, data: data };
        });
      });
  }

  function toast(msg) {
    if (typeof UI !== 'undefined' && UI.toast) UI.toast(msg);
  }

  function setMsg(msg, isErr) {
    const box = el('authMsg');
    if (!box) return;
    box.textContent = msg || '';
    box.className = 'auth-msg' + (isErr ? ' auth-msg-err' : '');
  }

  function show(name) {
    const view = TITLE[name] ? name : 'login';
    ['login', 'register', 'resend'].forEach(v => {
      const node = el('authView' + v.charAt(0).toUpperCase() + v.slice(1));
      if (node) node.hidden = v !== view;
    });
    const title = el('authTitle');
    if (title) title.textContent = TITLE[view];
    setMsg('');
    const gate = el('authGate');
    if (gate) gate.hidden = false;
    visible = true;
    const first = gate && gate.querySelector('input:not([disabled])');
    if (first && first.focus) first.focus();
  }

  function hide() {
    const gate = el('authGate');
    if (gate) gate.hidden = true;
    visible = false;
  }

  function signedIn() {
    hide();
    toast('登录成功');
    if (typeof Auth.onSignedIn === 'function') Auth.onSignedIn();
  }

  function submitLogin(e) {
    e.preventDefault();
    setMsg('');
    const btn = el('loginSubmit');
    if (btn) btn.disabled = true;
    api('login', { method: 'POST', body: JSON.stringify({ email: val('loginEmail'), password: val('loginPassword') }) })
      .then(function (r) {
        if (r.ok) { signedIn(); return; }
        if (r.status === 403 && r.data && r.data.needVerify) {
          setMsg(r.data.error + '（可在下方“重发验证邮件”重新获取）', true);
        } else {
          setMsg((r.data && r.data.error) || '登录失败，请重试', true);
        }
      })
      .catch(function () { setMsg('无法连接服务，请稍后重试', true); })
      .then(function () { if (btn) btn.disabled = false; });
    return false;
  }

  function submitRegister(e) {
    e.preventDefault();
    setMsg('');
    const password = val('regPassword');
    if (password.length < 8) { setMsg('密码至少需要 8 位', true); return false; }
    if (password !== val('regPassword2')) { setMsg('两次输入的密码不一致', true); return false; }
    const btn = el('regSubmit');
    if (btn) btn.disabled = true;
    api('register', { method: 'POST', body: JSON.stringify({ email: val('regEmail'), password: password }) })
      .then(function (r) {
        if (r.ok) {
          setMsg((r.data && r.data.message) || '注册成功，请查收验证邮件完成激活', false);
          const f = el('authViewRegister');
          if (f) f.reset();
        } else {
          setMsg((r.data && r.data.error) || '注册失败，请重试', true);
        }
      })
      .catch(function () { setMsg('无法连接服务，请稍后重试', true); })
      .then(function () { if (btn) btn.disabled = false; });
    return false;
  }

  function submitResend(e) {
    e.preventDefault();
    setMsg('');
    const btn = el('resendSubmit');
    if (btn) btn.disabled = true;
    api('resend', { method: 'POST', body: JSON.stringify({ email: val('resendEmail') }) })
      .then(function (r) {
        setMsg((r.data && (r.data.message || r.data.error)) || (r.ok ? '已发送' : '发送失败，请稍后重试'), !r.ok);
      })
      .catch(function () { setMsg('无法连接服务，请稍后重试', true); })
      .then(function () { if (btn) btn.disabled = false; });
    return false;
  }

  function logout() {
    api('logout', { method: 'POST' })
      .catch(function () { /* 网络失败也继续跳转 */ })
      .then(function () { if (typeof location !== 'undefined') location.reload(); });
  }

  function boot() {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    return api('me')
      .then(function (r) { return r.ok && r.data ? r.data : null; })
      .catch(function () { return null; });
  }

  function handleVerify() {
    if (typeof location === 'undefined') return Promise.resolve(false);
    const m = /[?&]verify=([a-f0-9]{64})/.exec(location.search || '');
    if (!m) return Promise.resolve(false);
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* 忽略 */ }
    return api('verify?token=' + m[1])
      .then(function (r) {
        toast(r.ok ? '邮箱验证成功，已自动登录' : ((r.data && r.data.error) || '激活失败'));
        if (!r.ok) show('login');
        return r.ok;
      })
      .catch(function () { show('login'); return false; });
  }

  const Auth = {
    onSignedIn: null,
    boot: boot,
    show: show,
    hide: hide,
    logout: logout,
    handleVerify: handleVerify
  };

  /* 绑定界面事件（元素缺失时保持静默，便于无界面环境加载） */
  (function bind() {
    const gate = el('authGate');
    if (!gate) return;
    const loginForm = el('authViewLogin');
    const registerForm = el('authViewRegister');
    const resendForm = el('authViewResend');
    if (loginForm) loginForm.addEventListener('submit', submitLogin);
    if (registerForm) registerForm.addEventListener('submit', submitRegister);
    if (resendForm) resendForm.addEventListener('submit', submitResend);
    gate.addEventListener('click', function (e) {
      const t = e.target;
      const next = t && t.getAttribute && t.getAttribute('data-auth-view');
      if (next) show(next);
    });
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('lifehub:unauthorized', function () {
        if (!visible) {
          toast('登录已失效，请重新登录');
          show('login');
        }
      });
    }
  })();

  return Auth;
})();

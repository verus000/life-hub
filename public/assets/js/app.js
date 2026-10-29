/* 启动与事件绑定 */
(function () {
  function $(id) { return document.getElementById(id); }

  function boot() {
    bindEvents();

    UI.render();
    Store.init().then(function (st) {
      UI.renderStorage();
      if (st.memoryMode) UI.toast('注意：当前环境无法写入浏览器存储，数据仅保存在内存，刷新会丢失');
      if (st.mode !== 'api') return startApp();
      /* API 模式：先处理激活链接，再校验登录态 */
      Auth.handleVerify().then(function () {
        return Auth.boot();
      }).then(function (user) {
        if (!user) { Auth.show('login'); return; }
        Auth.hide();
        startApp();
      }).catch(function () {
        Auth.show('login');
      });
    }).catch(function (e) {
      UI.toast('暂时无法读取记录：' + (e && e.message ? e.message : e));
    });
  }

  function startApp() {
    Auth.onSignedIn = function () {
      $('btnLogout').hidden = false;
      UI.refresh().catch(function (e) {
        UI.toast('读取记录失败：' + (e && e.message ? e.message : e));
      });
    };
    $('btnLogout').hidden = false;
    return UI.refresh().catch(function (e) {
      UI.toast('暂时无法读取记录：' + (e && e.message ? e.message : e));
    });
  }

  function bindEvents() {
    $('btnAdd').addEventListener('click', function () { UI.openAdd(); });
    $('btnExport').addEventListener('click', function () { UI.exportCSV(); });
    $('btnBackup').addEventListener('click', function () { UI.exportBackup(); });
    $('btnCalendar').addEventListener('click', function () { UI.exportCalendar(); });
    $('btnImport').addEventListener('click', function () { $('fileInput').click(); });
    $('btnLogout').addEventListener('click', function () { Auth.logout(); });

    $('fileInput').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) { UI.toast('导入文件上限 2MB，请分批导入'); $('fileInput').value = ''; return; }
      const fr = new FileReader();
      fr.onload = function () {
        UI.previewImport(String(fr.result || ''), f.name);
        $('fileInput').value = '';
      };
      fr.onerror = function () { UI.toast('文件读取失败'); };
      fr.readAsText(f, 'utf-8');
    });

    $('btnSave').addEventListener('click', function () { UI.save(); });
    $('btnCancel').addEventListener('click', function () { UI.closeModal(); });
    $('btnClose').addEventListener('click', function () { UI.closeModal(); });
    $('mask').addEventListener('click', function (e) {
      if (e.target === $('mask')) UI.closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.closeModal();
      if (e.key === 'Tab' && $('mask').classList.contains('show')) {
        const controls = Array.from($('mask').querySelectorAll('button,input,select,textarea'))
          .filter(el => !el.disabled && el.offsetParent !== null);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    document.addEventListener('click', function (e) {
      const inMenu = e.target.closest ? e.target.closest('.utility-menu, .item-menu, .filter-menu') : null;
      document.querySelectorAll('.utility-menu[open], .item-menu[open], .filter-menu[open]').forEach(menu => {
        if (menu !== inMenu || (e.target.closest && e.target.closest('button'))) menu.open = false;
      });
      const inSuggest = e.target.closest ? e.target.closest('.suggest') : null;
      if (!inSuggest) {
        const boxes = document.querySelectorAll('.suggest-list');
        for (let i = 0; i < boxes.length; i++) boxes[i].style.display = 'none';
      }
    });

  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

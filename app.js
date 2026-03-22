// ===== Service Worker 登録 =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function () {});
}

// ===== 業務記録・点呼記録簿 アプリ =====

(function () {
  'use strict';

  // --- ストレージキー ---
  const STORAGE_KEY = 'mkt-check-records';
  const SETTINGS_KEY = 'mkt-check-settings';

  // --- 状態管理 ---
  let state = {
    year: 7,
    month: 4,
    day: 1,
    records: {},   // { "7-4-1": { ...record }, ... }
    settings: { name: '', vehicle: '', inspector: '' }
  };

  // --- 初期化 ---
  function init() {
    loadSettings();
    loadRecords();
    setDefaultDate();
    renderDayGrid();
    renderDayDisplay();
    loadDayForm();
    updateMonthlyList();
    updateDisplayInfo();
    bindEvents();
  }

  // --- 日付初期化（今日の日付をデフォルト） ---
  function setDefaultDate() {
    const now = new Date();
    const westernYear = now.getFullYear();
    state.year = westernYear - 2018; // 令和変換
    state.month = now.getMonth() + 1;
    state.day = now.getDate();

    document.getElementById('year').value = state.year;
    document.getElementById('month').value = state.month;
  }

  // --- 曜日名 ---
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  function getWeekday(year, month, day) {
    const westernYear = year + 2018;
    const d = new Date(westernYear, month - 1, day);
    return d.getDay();
  }

  function getDaysInMonth(year, month) {
    const westernYear = year + 2018;
    return new Date(westernYear, month, 0).getDate();
  }

  // --- レコードキー ---
  function recordKey(y, m, d) {
    return y + '-' + m + '-' + d;
  }

  // --- ストレージ ---
  function loadRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) state.records = JSON.parse(data);
    } catch (e) { /* ignore */ }
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  }

  function loadSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) state.settings = JSON.parse(data);
    } catch (e) { /* ignore */ }
    // フォームに反映
    document.getElementById('setting-name').value = state.settings.name || '';
    document.getElementById('setting-vehicle').value = state.settings.vehicle || '';
    document.getElementById('setting-inspector').value = state.settings.inspector || '';
  }

  function saveSettings() {
    state.settings.name = document.getElementById('setting-name').value.trim();
    state.settings.vehicle = document.getElementById('setting-vehicle').value.trim();
    state.settings.inspector = document.getElementById('setting-inspector').value.trim();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    updateDisplayInfo();
    showToast('設定を保存しました');
  }

  function updateDisplayInfo() {
    const nameEl = document.getElementById('display-name');
    const vehicleEl = document.getElementById('display-vehicle');
    nameEl.textContent = state.settings.name ? '名前: ' + state.settings.name : '';
    vehicleEl.textContent = state.settings.vehicle ? '車両No: ' + state.settings.vehicle : '';
  }

  // --- 日付グリッド描画 ---
  function renderDayGrid() {
    const grid = document.getElementById('day-grid');
    grid.innerHTML = '';
    const daysInMonth = getDaysInMonth(state.year, state.month);

    for (let d = 1; d <= daysInMonth; d++) {
      const btn = document.createElement('button');
      btn.className = 'day-cell';
      btn.textContent = d;

      const wd = getWeekday(state.year, state.month, d);
      if (wd === 0) btn.classList.add('sunday');
      if (wd === 6) btn.classList.add('saturday');

      if (d === state.day) btn.classList.add('selected');

      const key = recordKey(state.year, state.month, d);
      if (state.records[key]) btn.classList.add('has-data');

      btn.addEventListener('click', function () {
        state.day = d;
        renderDayGrid();
        renderDayDisplay();
        loadDayForm();
      });

      grid.appendChild(btn);
    }
  }

  // --- 日付表示 ---
  function renderDayDisplay() {
    const wd = getWeekday(state.year, state.month, state.day);
    document.getElementById('current-day').textContent =
      state.day + '日 (' + WEEKDAYS[wd] + ')';
  }

  // --- フォームからデータ取得 ---
  function getToggleValue(field) {
    var btns = document.querySelectorAll('[data-field="' + field + '"]');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].classList.contains('active')) return btns[i].dataset.value;
    }
    return '';
  }

  function setToggleValue(field, value) {
    var btns = document.querySelectorAll('[data-field="' + field + '"]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.value === value);
    }
  }

  function getFormData() {
    return {
      beforeTime: document.getElementById('before-time').value,
      beforeDistance: document.getElementById('before-distance').value,
      deliveryArea: document.getElementById('delivery-area').value,
      beforeAlcohol: getToggleValue('before-alcohol'),
      beforeDrinking: getToggleValue('before-drinking'),
      beforeHealth: getToggleValue('before-health'),
      beforeInspection: getToggleValue('before-inspection'),
      beforeInspector: document.getElementById('before-inspector').value,
      beforeNote: document.getElementById('before-note').value,
      afterTime: document.getElementById('after-time').value,
      afterDistance: document.getElementById('after-distance').value,
      afterAlcohol: getToggleValue('after-alcohol'),
      afterDrinking: getToggleValue('after-drinking'),
      afterHealth: getToggleValue('after-health'),
      afterVehicle: getToggleValue('after-vehicle'),
      afterInspector: document.getElementById('after-inspector').value,
      afterNote: document.getElementById('after-note').value
    };
  }

  // --- フォームにデータをロード ---
  function loadDayForm() {
    const key = recordKey(state.year, state.month, state.day);
    const rec = state.records[key];

    if (rec) {
      document.getElementById('before-time').value = rec.beforeTime || '';
      document.getElementById('before-distance').value = rec.beforeDistance || '';
      document.getElementById('delivery-area').value = rec.deliveryArea || '';
      setToggleValue('before-alcohol', rec.beforeAlcohol || '有');
      setToggleValue('before-drinking', rec.beforeDrinking || '無');
      setToggleValue('before-health', rec.beforeHealth || '良好');
      setToggleValue('before-inspection', rec.beforeInspection || '異常無');
      document.getElementById('before-inspector').value = rec.beforeInspector || '';
      document.getElementById('before-note').value = rec.beforeNote || '';
      document.getElementById('after-time').value = rec.afterTime || '';
      document.getElementById('after-distance').value = rec.afterDistance || '';
      setToggleValue('after-alcohol', rec.afterAlcohol || '有');
      setToggleValue('after-drinking', rec.afterDrinking || '無');
      setToggleValue('after-health', rec.afterHealth || '良好');
      setToggleValue('after-vehicle', rec.afterVehicle || '異常無');
      document.getElementById('after-inspector').value = rec.afterInspector || '';
      document.getElementById('after-note').value = rec.afterNote || '';
    } else {
      // 新規：デフォルト値をセット
      document.getElementById('before-time').value = '';
      document.getElementById('before-distance').value = '';
      document.getElementById('delivery-area').value = '';
      setToggleValue('before-alcohol', '有');
      setToggleValue('before-drinking', '無');
      setToggleValue('before-health', '良好');
      setToggleValue('before-inspection', '異常無');
      document.getElementById('before-inspector').value = state.settings.inspector || '';
      document.getElementById('before-note').value = '';
      document.getElementById('after-time').value = '';
      document.getElementById('after-distance').value = '';
      setToggleValue('after-alcohol', '有');
      setToggleValue('after-drinking', '無');
      setToggleValue('after-health', '良好');
      setToggleValue('after-vehicle', '異常無');
      document.getElementById('after-inspector').value = state.settings.inspector || '';
      document.getElementById('after-note').value = '';

      // 前日の修了走行距離を引き継ぎ
      autoFillPrevDistance();
    }
    updateDailyDistance();
  }

  // --- 前日の修了走行距離を自動引き継ぎ ---
  function autoFillPrevDistance() {
    // 当日より前で最も近い記録を探す
    for (let d = state.day - 1; d >= 1; d--) {
      const key = recordKey(state.year, state.month, d);
      const rec = state.records[key];
      if (rec && rec.afterDistance) {
        document.getElementById('before-distance').value = rec.afterDistance;
        return;
      }
    }
  }

  // --- 走行距離自動計算 ---
  function updateDailyDistance() {
    const before = parseInt(document.getElementById('before-distance').value) || 0;
    const after = parseInt(document.getElementById('after-distance').value) || 0;
    const el = document.getElementById('daily-distance');
    if (before > 0 && after > 0 && after >= before) {
      el.textContent = (after - before) + ' km';
    } else {
      el.textContent = '— km';
    }
  }

  // --- 保存 ---
  function saveDay() {
    const key = recordKey(state.year, state.month, state.day);
    const data = getFormData();

    // 最低限のバリデーション
    if (!data.beforeTime && !data.afterTime && !data.beforeDistance) {
      showToast('データが未入力です');
      return;
    }

    state.records[key] = data;
    saveRecords();
    renderDayGrid();
    updateMonthlyList();
    showToast(state.day + '日のデータを保存しました');
  }

  // --- 月次一覧 ---
  function updateMonthlyList() {
    const list = document.getElementById('monthly-list');
    list.innerHTML = '';
    const daysInMonth = getDaysInMonth(state.year, state.month);

    for (let d = 1; d <= daysInMonth; d++) {
      const key = recordKey(state.year, state.month, d);
      const rec = state.records[key];
      const wd = getWeekday(state.year, state.month, d);
      const row = document.createElement('div');
      row.className = 'monthly-row' + (rec ? '' : ' empty');

      const before = rec ? (parseInt(rec.beforeDistance) || 0) : 0;
      const after = rec ? (parseInt(rec.afterDistance) || 0) : 0;
      const dist = (before > 0 && after > 0) ? (after - before) + 'km' : '';

      row.innerHTML =
        '<span class="day-num">' + d + '</span>' +
        '<span style="font-size:0.75rem;color:' +
        (wd === 0 ? 'var(--danger)' : wd === 6 ? 'var(--primary)' : 'var(--text-secondary)') +
        '">' + WEEKDAYS[wd] + '</span>' +
        '<span class="area">' + (rec ? (rec.deliveryArea || '—') : '未入力') + '</span>' +
        '<span class="distance">' + dist + '</span>';

      row.addEventListener('click', function () {
        state.day = d;
        switchTab('daily');
        renderDayGrid();
        renderDayDisplay();
        loadDayForm();
      });

      list.appendChild(row);
    }
  }

  // --- PDF出力 ---
  function exportPDF() {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // 日本語フォントがないため、基本的なラテン文字+数字で構成
    // ヘッダー情報
    var title = 'Business Record / Roll Call Record (MKT)';
    var period = 'Reiwa ' + state.year + ' / ' + state.month;
    var name = state.settings.name || '---';
    var vehicle = state.settings.vehicle || '---';

    doc.setFontSize(14);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(period + '   Name: ' + name + '   Vehicle: ' + vehicle, 14, 22);

    // テーブルデータ
    var headers = [
      ['Day', 'Start\nTime', 'Start\nDist(km)', 'Area', 'Alc\nUse', 'Drunk', 'Health', 'Inspect', 'Inspector', 'Note',
        'End\nTime', 'End\nDist(km)', 'Daily\n(km)', 'Alc\nUse', 'Drunk', 'Health', 'Vehicle', 'Inspector', 'Note']
    ];

    var body = [];
    var daysInMonth = getDaysInMonth(state.year, state.month);

    for (var d = 1; d <= daysInMonth; d++) {
      var key = recordKey(state.year, state.month, d);
      var rec = state.records[key];
      var wd = WEEKDAYS[getWeekday(state.year, state.month, d)];

      if (rec) {
        var bDist = parseInt(rec.beforeDistance) || 0;
        var aDist = parseInt(rec.afterDistance) || 0;
        var daily = (bDist > 0 && aDist > 0) ? (aDist - bDist) : '';

        body.push([
          d + '(' + wd + ')',
          rec.beforeTime || '', rec.beforeDistance || '', rec.deliveryArea || '',
          rec.beforeAlcohol || '', rec.beforeDrinking || '',
          rec.beforeHealth || '', rec.beforeInspection || '',
          rec.beforeInspector || '', rec.beforeNote || '',
          rec.afterTime || '', rec.afterDistance || '', daily,
          rec.afterAlcohol || '', rec.afterDrinking || '',
          rec.afterHealth || '', rec.afterVehicle || '',
          rec.afterInspector || '', rec.afterNote || ''
        ]);
      } else {
        body.push([d + '(' + wd + ')', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      }
    }

    doc.autoTable({
      head: headers,
      body: body,
      startY: 26,
      styles: { fontSize: 6, cellPadding: 1.5, lineWidth: 0.1 },
      headStyles: { fillColor: [26, 115, 232], fontSize: 5.5, halign: 'center' },
      columnStyles: {
        0: { cellWidth: 14 },
        3: { cellWidth: 20 }
      },
      theme: 'grid',
      margin: { left: 5, right: 5 }
    });

    var fileName = 'record_R' + state.year + '_' + state.month + '.pdf';
    doc.save(fileName);
    showToast('PDFを出力しました');
  }

  // --- タブ切り替え ---
  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(function (el) {
      el.classList.toggle('active', el.id === 'tab-' + tabName);
    });
    if (tabName === 'monthly') {
      updateMonthlyList();
    }
  }

  // --- トースト通知 ---
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }

  // --- イベントバインド ---
  function bindEvents() {
    // タブ
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.dataset.tab);
      });
    });

    // 日付ナビ
    document.getElementById('prev-day').addEventListener('click', function () {
      if (state.day > 1) {
        state.day--;
        renderDayGrid();
        renderDayDisplay();
        loadDayForm();
      }
    });
    document.getElementById('next-day').addEventListener('click', function () {
      var max = getDaysInMonth(state.year, state.month);
      if (state.day < max) {
        state.day++;
        renderDayGrid();
        renderDayDisplay();
        loadDayForm();
      }
    });

    // 年月変更
    document.getElementById('year').addEventListener('change', function () {
      state.year = parseInt(this.value);
      state.day = 1;
      renderDayGrid();
      renderDayDisplay();
      loadDayForm();
      updateMonthlyList();
    });
    document.getElementById('month').addEventListener('change', function () {
      state.month = parseInt(this.value);
      state.day = 1;
      renderDayGrid();
      renderDayDisplay();
      loadDayForm();
      updateMonthlyList();
    });

    // トグルボタン
    document.querySelectorAll('.toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.dataset.field;
        document.querySelectorAll('[data-field="' + field + '"]').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
      });
    });

    // 走行距離の自動計算
    document.getElementById('before-distance').addEventListener('input', updateDailyDistance);
    document.getElementById('after-distance').addEventListener('input', updateDailyDistance);

    // 保存
    document.getElementById('save-btn').addEventListener('click', saveDay);

    // 設定保存
    document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

    // PDF出力
    document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);

    // データバックアップ
    document.getElementById('export-data-btn').addEventListener('click', function () {
      var data = {
        records: state.records,
        settings: state.settings,
        exportDate: new Date().toISOString()
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mkt-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('バックアップを保存しました');
    });

    // データ復元
    document.getElementById('import-data-btn').addEventListener('click', function () {
      document.getElementById('import-data-input').click();
    });
    document.getElementById('import-data-input').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (data.records) state.records = data.records;
          if (data.settings) {
            state.settings = data.settings;
            document.getElementById('setting-name').value = state.settings.name || '';
            document.getElementById('setting-vehicle').value = state.settings.vehicle || '';
            document.getElementById('setting-inspector').value = state.settings.inspector || '';
          }
          saveRecords();
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
          updateDisplayInfo();
          renderDayGrid();
          loadDayForm();
          updateMonthlyList();
          showToast('データを復元しました');
        } catch (err) {
          showToast('ファイルの読み込みに失敗しました');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // データ削除
    document.getElementById('clear-data-btn').addEventListener('click', function () {
      if (confirm('全てのデータを削除しますか？この操作は元に戻せません。')) {
        state.records = {};
        saveRecords();
        renderDayGrid();
        loadDayForm();
        updateMonthlyList();
        showToast('全データを削除しました');
      }
    });
  }

  // --- 起動 ---
  document.addEventListener('DOMContentLoaded', init);
})();

// =====================================================
// 点呼記録簿 — Google Apps Script (Webアプリ)
// =====================================================
// 【セットアップ手順】
// 1. Googleスプレッドシートを新規作成
// 2. スプレッドシートのIDをコピー（URLの /d/XXXXX/edit の XXXXX 部分）
// 3. 下の SPREADSHEET_ID に貼り付け
// 4. GASエディタで「デプロイ」→「新しいデプロイ」
//    - 種類: ウェブアプリ
//    - 実行ユーザー: 自分
//    - アクセス: 全員
// 5. デプロイURLをアプリの設定画面に入力
// =====================================================

var SPREADSHEET_ID = 'ここにスプレッドシートIDを貼り付け';

// ヘッダー1行目（グループ）
var HEADER_ROW1 = [
  '日', '曜', '月',
  '乗務前 自主点呼', '', '', '', '', '', '', '', '',
  '乗務後 自主点呼', '', '', '', '', '', '', '', ''
];

// ヘッダー2行目（項目名）
var HEADER_ROW2 = [
  '', '', '',
  '時間', '開始走行距離', '配達エリア', 'アルコール\n検知器', '酒気帯び', '疾病・\n疲労等', '日常点検', '点呼\n執行者', '備考',
  '時間', '修了走行距離', '1日の\n走行距離', 'アルコール\n検知器', '酒気帯び', '疾病・\n疲労等', '車両の\n異常', '点呼\n執行者', '備考'
];

function formatNewSheet(sheet, driverName, year, month) {
  // --- タイトル情報をシート上部に表示しない（シート名で判別） ---

  // --- ヘッダー1行目: グループ見出し ---
  // 「日」「曜」「月」を結合（縦2行）
  sheet.getRange(1, 1, 2, 1).merge().setBackground('#e8e8e8').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange(1, 2, 2, 1).merge().setBackground('#e8e8e8').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange(1, 3, 2, 1).merge().setBackground('#e8e8e8').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 「乗務前 自主点呼」を結合（D1:L1）
  sheet.getRange(1, 4, 1, 9).merge().setBackground('#dce8f7').setFontWeight('bold').setHorizontalAlignment('center');

  // 「乗務後 自主点呼」を結合（M1:U1）
  sheet.getRange(1, 13, 1, 9).merge().setBackground('#fde8d0').setFontWeight('bold').setHorizontalAlignment('center');

  // --- ヘッダー2行目: 項目名の背景色 ---
  sheet.getRange(2, 4, 1, 9).setBackground('#dce8f7').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.getRange(2, 13, 1, 9).setBackground('#fde8d0').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

  // --- 全ヘッダーに罫線 ---
  sheet.getRange(1, 1, 2, 21).setBorder(true, true, true, true, true, true, '#333333', SpreadsheetApp.BorderStyle.SOLID);

  // --- 列幅設定 ---
  sheet.setColumnWidth(1, 30);   // 日
  sheet.setColumnWidth(2, 30);   // 曜
  sheet.setColumnWidth(3, 30);   // 月
  sheet.setColumnWidth(4, 50);   // 時間(前)
  sheet.setColumnWidth(5, 85);   // 開始走行距離
  sheet.setColumnWidth(6, 75);   // 配達エリア
  sheet.setColumnWidth(7, 65);   // アルコール検知器(前)
  sheet.setColumnWidth(8, 55);   // 酒気帯び(前)
  sheet.setColumnWidth(9, 55);   // 疾病・疲労(前)
  sheet.setColumnWidth(10, 60);  // 日常点検
  sheet.setColumnWidth(11, 50);  // 点呼執行者(前)
  sheet.setColumnWidth(12, 70);  // 備考(前)
  sheet.setColumnWidth(13, 50);  // 時間(後)
  sheet.setColumnWidth(14, 85);  // 修了走行距離
  sheet.setColumnWidth(15, 60);  // 1日走行距離
  sheet.setColumnWidth(16, 65);  // アルコール検知器(後)
  sheet.setColumnWidth(17, 55);  // 酒気帯び(後)
  sheet.setColumnWidth(18, 55);  // 疾病・疲労(後)
  sheet.setColumnWidth(19, 55);  // 車両の異常
  sheet.setColumnWidth(20, 50);  // 点呼執行者(後)
  sheet.setColumnWidth(21, 70);  // 備考(後)

  // --- 行の高さ ---
  sheet.setRowHeight(1, 28);
  sheet.setRowHeight(2, 40);

  // --- 2行目を固定 ---
  sheet.setFrozenRows(2);

  // --- フォントサイズ ---
  sheet.getRange(1, 1, 2, 21).setFontSize(9);
}

function formatDataRow(sheet, rowNum) {
  var range = sheet.getRange(rowNum, 1, 1, 21);
  range.setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);
  range.setHorizontalAlignment('center');
  range.setFontSize(9);
  // 乗務前セル（D〜L）に薄い青背景
  sheet.getRange(rowNum, 4, 1, 9).setBackground('#eef4fb');
  // 乗務後セル（M〜U）に薄いオレンジ背景
  sheet.getRange(rowNum, 13, 1, 9).setBackground('#fef5ed');
}

function prefillAllDays(sheet, year, month) {
  var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  var westernYear = parseInt(year) + 2018;
  var daysInMonth = new Date(westernYear, parseInt(month), 0).getDate();

  for (var d = 1; d <= daysInMonth; d++) {
    var dateObj = new Date(westernYear, parseInt(month) - 1, d);
    var wdIndex = dateObj.getDay();
    var row = [d, weekdays[wdIndex], month, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    sheet.appendRow(row);
    var rowNum = sheet.getLastRow();
    formatDataRow(sheet, rowNum);

    // 日曜は赤、土曜は青
    if (wdIndex === 0) {
      sheet.getRange(rowNum, 1, 1, 3).setFontColor('#cc0000');
    } else if (wdIndex === 6) {
      sheet.getRange(rowNum, 1, 1, 3).setFontColor('#1a73e8');
    }
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var data = JSON.parse(e.postData.contents);

    // シート名: ドライバー名_R{年}年{月}月
    var driverName = data.name || '名前未設定';
    var sheetName = driverName + '_R' + data.year + '年' + data.month + '月';

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADER_ROW1);
      sheet.appendRow(HEADER_ROW2);
      formatNewSheet(sheet, driverName, data.year, data.month);
      prefillAllDays(sheet, data.year, data.month);
    }

    // 既存行を検索（日が一致する行を更新）
    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 2; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.day)) {
        targetRow = i + 1;
        break;
      }
    }

    // 1日走行距離を計算
    var beforeDist = parseInt(data.beforeDistance) || 0;
    var afterDist = parseInt(data.afterDistance) || 0;
    var dailyDist = (beforeDist > 0 && afterDist > 0 && afterDist >= beforeDist)
      ? (afterDist - beforeDist) : '';

    // 曜日を計算
    var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    var westernYear = parseInt(data.year) + 2018;
    var dateObj = new Date(westernYear, parseInt(data.month) - 1, parseInt(data.day));
    var wdIndex = dateObj.getDay();
    var wdName = weekdays[wdIndex];

    var rowData = [
      data.day,
      wdName,
      data.month,
      data.beforeTime || '',
      data.beforeDistance || '',
      data.deliveryArea || '',
      data.beforeAlcohol || '',
      data.beforeDrinking || '',
      data.beforeHealth || '',
      data.beforeInspection || '',
      data.beforeInspector || '',
      data.beforeNote || '',
      data.afterTime || '',
      data.afterDistance || '',
      dailyDist,
      data.afterAlcohol || '',
      data.afterDrinking || '',
      data.afterHealth || '',
      data.afterVehicle || '',
      data.afterInspector || '',
      data.afterNote || ''
    ];

    var rowIndex;
    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
      rowIndex = targetRow;
    } else {
      sheet.appendRow(rowData);
      rowIndex = sheet.getLastRow();
    }

    formatDataRow(sheet, rowIndex);

    // 日曜は赤、土曜は青
    if (wdIndex === 0) {
      sheet.getRange(rowIndex, 1, 1, 3).setFontColor('#cc0000');
    } else if (wdIndex === 6) {
      sheet.getRange(rowIndex, 1, 1, 3).setFontColor('#1a73e8');
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

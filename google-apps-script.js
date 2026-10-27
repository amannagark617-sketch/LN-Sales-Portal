/**
 * DAILY SALES REPORT GENERATOR (SHOWROOM / REGION-WISE)
 * Uses sheets: "Data", "Targets", "ID Password", "Report Tab"
 */

function generateDailySalesReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Sheets
  var dataSheet = ss.getSheetByName("Data");
  var targetsSheet = ss.getSheetByName("Targets");
  var idPasswordSheet = ss.getSheetByName("ID Password");
  
  if (!dataSheet || !targetsSheet || !idPasswordSheet) {
    Logger.log("Error: Could not find required sheets ('Data', 'Targets', 'ID Password').");
    return;
  }

  // 2. Determine Date Parameters (Yesterday & MTD)
  var today = new Date();
  var yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  var yesterdayStr = formatDateDDMMMYYYY(yesterday); // e.g., "30-Jul-2026"
  var currentYear = yesterday.getFullYear();
  var currentMonth = yesterday.getMonth(); // 0-indexed (0 = Jan, 6 = Jul)
  var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  var dayOfMonth = yesterday.getDate(); // Days elapsed in month up to yesterday

  // 3. Parse "ID Password" -> Pull Showroom / Region list strictly from Column B (Index 1) & Map Salespersons
  var idPassData = idPasswordSheet.getDataRange().getValues();
  var salespersonToShowroom = {};
  var validShowroomsMap = {}; // Map normalized showroom name -> actual showroom display name
  var showroomList = [];

  for (var i = 1; i < idPassData.length; i++) {
    var row = idPassData[i];
    var showroom = row[1] ? String(row[1]).trim() : "";
    var salespersonName = row[2] ? String(row[2]).trim() : "";
    
    if (showroom) {
      var normShowroom = showroom.toLowerCase();
      if (!validShowroomsMap[normShowroom]) {
        validShowroomsMap[normShowroom] = showroom;
        showroomList.push(showroom);
      }
    }
    
    if (salespersonName && showroom) {
      salespersonToShowroom[salespersonName.toLowerCase()] = showroom;
    }
  }

  // Fallback if ID Password Column B is empty
  if (showroomList.length === 0) {
    showroomList = ["Other Region"];
    validShowroomsMap["other region"] = "Other Region";
  }

  // Initialize Aggregators for Showrooms/Regions from "ID Password"
  var reportData = {};
  showroomList.forEach(function(s) {
    reportData[s] = {
      showroom: s,
      yesterdayTarget: 0,
      yesterdayAch: 0,
      mtdTarget: 0,
      mtdAch: 0
    };
  });

  // 4. Parse "Targets" Sheet
  var targetRows = targetsSheet.getDataRange().getValues();
  for (var t = 1; t < targetRows.length; t++) {
    var tRow = targetRows[t];
    var keyName = tRow[0] ? String(tRow[0]).trim() : "";
    var rawDate = tRow[1];
    var targetVal = parseNumber(tRow[2]);

    if (!keyName || !targetVal) continue;

    // Check if target row belongs to current month
    if (isTargetInCurrentMonth(rawDate, currentYear, currentMonth)) {
      var normKey = keyName.toLowerCase();
      var mappedShowroom = validShowroomsMap[normKey] || salespersonToShowroom[normKey] || keyName;
      
      if (!reportData[mappedShowroom]) {
        reportData[mappedShowroom] = {
          showroom: mappedShowroom,
          yesterdayTarget: 0,
          yesterdayAch: 0,
          mtdTarget: 0,
          mtdAch: 0
        };
      }

      var dailyTarget = targetVal / daysInMonth;
      var mtdTargetVal = dailyTarget * dayOfMonth;

      reportData[mappedShowroom].yesterdayTarget += dailyTarget;
      reportData[mappedShowroom].mtdTarget += mtdTargetVal;
    }
  }

  // 5. Parse "Data" Sheet (Sales Records)
  var salesRows = dataSheet.getDataRange().getValues();
  var headers = salesRows[0];
  
  // Dynamic column detection for Gross/Net sales
  var salesColIdx = 26; // Default AA (0-based 26)
  for (var h = 0; h < headers.length; h++) {
    var hText = String(headers[h]).toLowerCase();
    if (hText.indexOf("gross") !== -1 || hText.indexOf("net sales") !== -1 || hText.indexOf("amount") !== -1) {
      salesColIdx = h;
      break;
    }
  }

  // Column AK for Showroom / Region (AK = Column 37 -> 0-based index 36)
  var showroomColIdx = 36; 
  for (var h = 0; h < headers.length; h++) {
    var hText = String(headers[h]).toLowerCase().trim();
    if (hText === "showroom" || hText === "region" || hText === "showroom/region" || hText === "showroom / region") {
      showroomColIdx = h;
      break;
    }
  }

  for (var d = 1; d < salesRows.length; d++) {
    var sRow = salesRows[d];
    var rowDate = parseDate(sRow[0]);
    var salesperson = sRow[1] ? String(sRow[1]).trim() : "";
    var salesAmt = parseNumber(sRow[salesColIdx]);

    if (!rowDate || salesAmt <= 0) continue;

    // Pull Showroom / Region value directly from Data Column AK (index 36)
    var rawShowroom = sRow[showroomColIdx] ? String(sRow[showroomColIdx]).trim() : (sRow[36] ? String(sRow[36]).trim() : "");
    var showroomKey = rawShowroom ? rawShowroom.toLowerCase() : "";

    // Priority 1: Match Data Column AK against valid showrooms
    // Priority 2: Use Data Column AK raw text if present
    // Priority 3: Fallback to salesperson profile only if Column AK is blank
    var showroom = validShowroomsMap[showroomKey] 
      || (rawShowroom ? rawShowroom : (salespersonToShowroom[salesperson.toLowerCase()] || "Other Region"));

    if (!reportData[showroom]) {
      reportData[showroom] = {
        showroom: showroom,
        yesterdayTarget: 0,
        yesterdayAch: 0,
        mtdTarget: 0,
        mtdAch: 0
      };
    }

    // Is Yesterday?
    if (isSameDate(rowDate, yesterday)) {
      reportData[showroom].yesterdayAch += salesAmt;
    }

    // Is MTD (Same Month & Year, up to Yesterday)?
    if (rowDate.getFullYear() === currentYear && rowDate.getMonth() === currentMonth && rowDate.getDate() <= yesterday.getDate()) {
      reportData[showroom].mtdAch += salesAmt;
    }
  }

  // 6. Generate Summary PDF Report
  var pdfBlob = buildPDFReport(reportData, yesterdayStr);
  
  // Save PDF to Google Drive
  var folder = DriveApp.getRootFolder();
  var pdfFile = folder.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  // 7. Save Summary to "Report Tab"
  saveToReportTab(ss, yesterdayStr, reportData, pdfUrl);

  // 8. Generate WhatsApp Message Payload
  var waMessage = generateWhatsAppMessage(yesterdayStr, reportData, pdfUrl);
  Logger.log("--- WHATSAPP MESSAGE PAYLOAD ---");
  Logger.log(waMessage);

  return { pdfUrl: pdfUrl, waMessage: waMessage };
}

/* ================= HELPER FUNCTIONS ================= */

function formatDateDDMMMYYYY(d) {
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var day = ("0" + d.getDate()).slice(-2);
  var month = months[d.getMonth()];
  var year = d.getFullYear();
  return day + "-" + month + "-" + year;
}

function parseNumber(val) {
  if (!val) return 0;
  var num = Number(String(val).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
}

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  var str = String(val).trim();
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // DD/MM/YYYY or DD-MM-YYYY format fallback
  var parts = str.split(/[/-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  return null;
}

function isSameDate(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function isTargetInCurrentMonth(rawDate, targetYear, targetMonth) {
  if (!rawDate) return false;
  if (rawDate instanceof Date) {
    return rawDate.getFullYear() === targetYear && rawDate.getMonth() === targetMonth;
  }
  var str = String(rawDate).trim();
  var parts = str.split(/[/-]/);
  if (parts.length >= 2) {
    var m = parseInt(parts[0], 10) - 1;
    var y = parseInt(parts[1], 10);
    if (parts[1].length === 2) y = 2000 + y;
    if (m === targetMonth && y === targetYear) return true;
  }
  return false;
}

function toLacs(val) {
  return (val / 100000).toFixed(2);
}

function saveToReportTab(ss, dateStr, reportData, pdfUrl) {
  var sheet = ss.getSheetByName("Report Tab");
  if (!sheet) {
    sheet = ss.insertSheet("Report Tab");
    sheet.appendRow([
      "Date", 
      "Report Name", 
      "Total Yest. Target (Lacs)", 
      "Total Yest. Ach. (Lacs)", 
      "Yest. Ach %", 
      "Total MTD Target (Lacs)", 
      "Total MTD Ach. (Lacs)", 
      "MTD Ach %", 
      "PDF Link", 
      "Generated At"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#111827").setFontColor("#ffffff");
  }

  var totalYestTarget = 0, totalYestAch = 0, totalMtdTarget = 0, totalMtdAch = 0;
  Object.keys(reportData).forEach(function(k) {
    var item = reportData[k];
    totalYestTarget += item.yesterdayTarget;
    totalYestAch += item.yesterdayAch;
    totalMtdTarget += item.mtdTarget;
    totalMtdAch += item.mtdAch;
  });

  var yestPct = totalYestTarget > 0 ? Math.round((totalYestAch / totalYestTarget) * 100) : 0;
  var mtdPct = totalMtdTarget > 0 ? Math.round((totalMtdAch / totalMtdTarget) * 100) : 0;

  sheet.appendRow([
    dateStr,
    "Showroom Sales Performance Report",
    toLacs(totalYestTarget),
    toLacs(totalYestAch),
    yestPct + "%",
    toLacs(totalMtdTarget),
    toLacs(totalMtdAch),
    mtdPct + "%",
    pdfUrl,
    new Date()
  ]);
}

/* ================= BEAUTIFUL PDF & VISUAL CHARTS BUILDER ================= */

function buildPDFReport(reportData, dateStr) {
  var totalYestTarget = 0, totalYestAch = 0, totalMtdTarget = 0, totalMtdAch = 0;
  var rowsHtml = "";

  // Sort showrooms in ASCENDING order of MTD Achievement % (Low to High so low performing showrooms are at the top)
  var keys = Object.keys(reportData).sort(function(a, b) {
    var itemA = reportData[a];
    var itemB = reportData[b];
    var pctA = itemA.mtdTarget > 0 ? (itemA.mtdAch / itemA.mtdTarget) : 0;
    var pctB = itemB.mtdTarget > 0 ? (itemB.mtdAch / itemB.mtdTarget) : 0;
    if (pctA !== pctB) {
      return pctA - pctB; // Ascending order
    }
    return a.localeCompare(b);
  });

  keys.forEach(function(k) {
    var item = reportData[k];
    totalYestTarget += item.yesterdayTarget;
    totalYestAch += item.yesterdayAch;
    totalMtdTarget += item.mtdTarget;
    totalMtdAch += item.mtdAch;

    var yestPct = item.yesterdayTarget > 0 ? Math.round((item.yesterdayAch / item.yesterdayTarget) * 100) : 0;
    var mtdPct = item.mtdTarget > 0 ? Math.round((item.mtdAch / item.mtdTarget) * 100) : 0;

    var statusBadge = mtdPct >= 100 ? '<span class="badge green">🟢 Target Achieved</span>' : 
                     (mtdPct >= 70 ? '<span class="badge yellow">🟡 Moderate</span>' : '<span class="badge red">🔴 Critical</span>');

    var barWidth = Math.min(100, mtdPct);
    var barColor = mtdPct >= 100 ? '#10b981' : (mtdPct >= 70 ? '#d97706' : '#dc2626');

    rowsHtml += `
      <tr>
        <td class="font-bold">${item.showroom}</td>
        <td>₹ ${toLacs(item.yesterdayTarget)} L</td>
        <td>₹ ${toLacs(item.yesterdayAch)} L</td>
        <td><b style="color:${barColor}">${yestPct}%</b></td>
        <td>₹ ${toLacs(item.mtdTarget)} L</td>
        <td>₹ ${toLacs(item.mtdAch)} L</td>
        <td>
          <b style="color:${barColor}">${mtdPct}%</b>
          <div class="bar-bg"><div class="bar-fill" style="width:${barWidth}%; background-color:${barColor};"></div></div>
        </td>
        <td>${statusBadge}</td>
      </tr>
    `;
  });

  var overallYestPct = totalYestTarget > 0 ? Math.round((totalYestAch / totalYestTarget) * 100) : 0;
  var overallMtdPct = totalMtdTarget > 0 ? Math.round((totalMtdAch / totalMtdTarget) * 100) : 0;

  var html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #000000; padding: 20px; background: #ffffff; }
        .header { text-align: center; border-bottom: 4px solid #111827; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #000000; font-size: 24px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900; }
        .header p { margin: 6px 0 0 0; color: #111827; font-size: 14px; font-weight: 800; }
        
        .kpi-container { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 12px; }
        .kpi-card { flex: 1; background: #111827; border: 2px solid #000000; border-radius: 8px; padding: 14px; text-align: center; color: #ffffff; }
        .kpi-title { font-size: 12px; color: #f3f4f6; text-transform: uppercase; font-weight: 800; margin-bottom: 6px; }
        .kpi-val { font-size: 20px; color: #ffffff; font-weight: 900; }
        .kpi-sub { font-size: 12px; font-weight: 800; margin-top: 4px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; color: #000000; }
        th { background: #111827; color: #ffffff; padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 900; border: 1px solid #000000; }
        td { padding: 9px 8px; border: 1px solid #111827; color: #000000; font-weight: 600; }
        tr:nth-child(even) { background-color: #1f2937; }
        tr:nth-child(even) td { color: #ffffff; }
        .font-bold { font-weight: 800; }

        .bar-bg { background: #000000; height: 7px; border-radius: 4px; overflow: hidden; margin-top: 4px; border: 1px solid #111827; }
        .bar-fill { height: 100%; }

        .badge { font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px; display: inline-block; }
        .green { background: #d1fae5; color: #064e3b; }
        .yellow { background: #fef3c7; color: #78350f; }
        .red { background: #fee2e2; color: #7f1d1d; }

        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #000000; font-weight: 800; border-top: 2px solid #000000; padding-top: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Daily Sales Performance Report</h1>
        <p>SHOWROOM & REGION-WISE PERFORMANCE ANALYSIS | DATE: ${dateStr}</p>
      </div>

      <div class="kpi-container">
        <div class="kpi-card">
          <div class="kpi-title">Yesterday's Sales</div>
          <div class="kpi-val">₹ ${toLacs(totalYestAch)} Lacs</div>
          <div class="kpi-sub" style="color: ${overallYestPct >= 100 ? '#34d399' : '#f87171'}">Target: ₹ ${toLacs(totalYestTarget)} L (${overallYestPct}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">MTD Sales</div>
          <div class="kpi-val">₹ ${toLacs(totalMtdAch)} Lacs</div>
          <div class="kpi-sub" style="color: ${overallMtdPct >= 100 ? '#34d399' : '#f87171'}">Target: ₹ ${toLacs(totalMtdTarget)} L (${overallMtdPct}%)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Overall MTD Achievement</div>
          <div class="kpi-val" style="color: ${overallMtdPct >= 100 ? '#34d399' : '#fbbf24'}">${overallMtdPct}%</div>
          <div class="kpi-sub" style="color: #f3f4f6">Run Rate Status</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Showroom / Region</th>
            <th>Yest. Target</th>
            <th>Yest. Ach.</th>
            <th>Yest. %</th>
            <th>MTD Target</th>
            <th>MTD Ach.</th>
            <th>MTD %</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr style="background-color: #111827; font-weight: 900; color: #ffffff;">
            <td style="color: #ffffff; font-weight: 900;">TOTAL OVERALL</td>
            <td>₹ ${toLacs(totalYestTarget)} L</td>
            <td>₹ ${toLacs(totalYestAch)} L</td>
            <td>${overallYestPct}%</td>
            <td>₹ ${toLacs(totalMtdTarget)} L</td>
            <td>₹ ${toLacs(totalMtdAch)} L</td>
            <td>${overallMtdPct}%</td>
            <td>${overallMtdPct >= 100 ? '🟢 ON TRACK' : '🟡 IN PROGRESS'}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Generated automatically via Daily Sales Analytics Engine • All financial figures rounded in Lakhs (Lacs)
      </div>
    </body>
    </html>
  `;

  return Utilities.newBlob(html, "text/html", "Sales_Report_" + dateStr + ".html").getAs("application/pdf").setName("Sales_Report_" + dateStr + ".pdf");
}

function generateWhatsAppMessage(dateStr, reportData, pdfUrl) {
  var totalYestTarget = 0, totalYestAch = 0, totalMtdTarget = 0, totalMtdAch = 0;
  var detailsText = "";

  // Sort showrooms in ASCENDING order of MTD Achievement % (Low to High so low performing showrooms are at the top)
  var keys = Object.keys(reportData).sort(function(a, b) {
    var itemA = reportData[a];
    var itemB = reportData[b];
    var pctA = itemA.mtdTarget > 0 ? (itemA.mtdAch / itemA.mtdTarget) : 0;
    var pctB = itemB.mtdTarget > 0 ? (itemB.mtdAch / itemB.mtdTarget) : 0;
    if (pctA !== pctB) {
      return pctA - pctB; // Ascending order
    }
    return a.localeCompare(b);
  });

  keys.forEach(function(k) {
    var item = reportData[k];
    totalYestTarget += item.yesterdayTarget;
    totalYestAch += item.yesterdayAch;
    totalMtdTarget += item.mtdTarget;
    totalMtdAch += item.mtdAch;

    var mtdPct = item.mtdTarget > 0 ? Math.round((item.mtdAch / item.mtdTarget) * 100) : 0;
    var icon = mtdPct >= 100 ? "🟢" : (mtdPct >= 70 ? "🟡" : "🔴");

    detailsText += `${icon} *${item.showroom}*\n`;
    detailsText += `   • Yest: ₹${toLacs(item.yesterdayAch)} L / Target: ₹${toLacs(item.yesterdayTarget)} L\n`;
    detailsText += `   • MTD: ₹${toLacs(item.mtdAch)} L (${mtdPct}% Achieved)\n\n`;
  });

  var overallMtdPct = totalMtdTarget > 0 ? Math.round((totalMtdAch / totalMtdTarget) * 100) : 0;

  var msg = `📊 *DAILY SALES SUMMARY REPORT*\n`;
  msg += `📅 *Date:* ${dateStr}\n\n`;
  msg += `📈 *OVERALL MTD SUMMARY*\n`;
  msg += `• MTD Target: ₹ *${toLacs(totalMtdTarget)} Lacs*\n`;
  msg += `• MTD Achievement: ₹ *${toLacs(totalMtdAch)} Lacs*\n`;
  msg += `• Overall Achievement: *${overallMtdPct}%*\n\n`;
  msg += `🏢 *SHOWROOM PERFORMANCE (ATTENTION NEEDED FIRST)*\n`;
  msg += detailsText;
  msg += `📄 *Download PDF Report:* ${pdfUrl}`;

  return msg;
}

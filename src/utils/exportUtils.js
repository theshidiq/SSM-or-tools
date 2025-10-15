import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { shiftSymbols } from "../constants/shiftConstants";
import { isDateWithinWorkPeriod } from "./dateUtils";

// Export schedule to CSV format
export const exportToCSV = (staffMembers, dateRange, schedule) => {
  // Validate input parameters
  if (!Array.isArray(staffMembers)) {
    console.error("exportToCSV: staffMembers is not an array:", staffMembers);
    alert(
      "スタッフデータの読み込みに失敗しました。ページを再読み込みしてください。",
    );
    return;
  }

  if (!Array.isArray(dateRange) || dateRange.length === 0) {
    console.error("exportToCSV: dateRange is invalid:", dateRange);
    alert("日付範囲が正しくありません。");
    return;
  }

  if (!schedule || typeof schedule !== "object") {
    console.error("exportToCSV: schedule is invalid:", schedule);
    alert("スケジュールデータが正しくありません。");
    return;
  }

  const headers = [
    "Date / 日付",
    ...staffMembers.map((staff) => staff?.name || "Unknown"),
  ];
  const rows = [headers];

  dateRange.forEach((date) => {
    const validDate = new Date(date);
    if (isNaN(validDate.getTime())) return; // Skip invalid dates

    const dateKey = format(validDate, "yyyy-MM-dd");
    const row = [
      `${format(validDate, "dd-MMM")} (${format(validDate, "EEE", { locale: ja })})`,
      ...staffMembers.map((staff) => {
        // Check if date is within work period
        if (!isDateWithinWorkPeriod(validDate, staff)) {
          return "-"; // Show dash for dates outside work period
        }
        const shift = schedule[staff.id]?.[dateKey] || "";
        return shift ? shiftSymbols[shift]?.symbol || "" : "";
      }),
    ];
    rows.push(row);
  });

  try {
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `shift-schedule-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    alert("エクスポートに失敗しました。もう一度お試しください。");
  }
};

// Generate print-friendly HTML content
export const generatePrintHTML = (staffMembers, dateRange, schedule) => {
  // Validate input parameters
  if (!Array.isArray(staffMembers)) {
    console.error(
      "generatePrintHTML: staffMembers is not an array:",
      staffMembers,
    );
    return "<html><body><h1>Error: スタッフデータの読み込みに失敗しました</h1></body></html>";
  }

  if (!Array.isArray(dateRange) || dateRange.length === 0) {
    console.error("generatePrintHTML: dateRange is invalid:", dateRange);
    return "<html><body><h1>Error: 日付範囲が正しくありません</h1></body></html>";
  }

  if (!schedule || typeof schedule !== "object") {
    console.error("generatePrintHTML: schedule is invalid:", schedule);
    return "<html><body><h1>Error: スケジュールデータが正しくありません</h1></body></html>";
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Schedule</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .content-wrapper {
            max-width: 100%;
            width: 100%;
          }
          h1 {
            font-size: 16px;
            margin: 8px 0;
            text-align: center;
          }
          p {
            text-align: center;
            margin: 5px 0;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            max-width: 100%;
            margin: 10px auto;
            table-layout: fixed;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: center;
            font-size: 12px;
            width: auto;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .date-header {
            font-weight: bold;
            background-color: #f9f9f9;
            min-width: 50px;
            width: 50px;
          }
          .not-working { background-color: #f0f0f0; color: #999; }
          .shift-symbol { font-size: 18px; font-weight: bold; }
          .early { color: #2563eb; }
          .normal { color: #374151; }
          .late { color: #7c3aed; }
          .off { color: #dc2626; }
          .holiday { color: #eab308; }
          .unavailable { color: #991b1b; }
          .legend {
            margin-top: 10px;
            font-size: 10px;
            text-align: center;
          }

          @media print {
            @page { size: A4 portrait; margin: 10mm; }
            body {
              font-size: 12px;
              margin: 0;
              padding: 5px;
            }
            table {
              font-size: 12px;
              width: 100%;
            }
            th, td {
              padding: 3px 2px;
              font-size: 12px;
              height: 18px;
            }
            .shift-symbol { font-size: 16px; }
            h1 { font-size: 14px; margin: 5px 0; }
            .date-header {
              min-width: 40px;
              width: 40px;
            }
          }
        </style>
      </head>
      <body>
        <h1>調理場シフト表</h1>
        <p>期間: ${
          dateRange && dateRange.length > 0
            ? (() => {
                const startDate = new Date(dateRange[0]);
                const endDate = new Date(dateRange[dateRange.length - 1]);
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
                  return "";
                return `${format(startDate, "yyyy年M月d日")} ~ ${format(endDate, "yyyy年M月d日")}`;
              })()
            : ""
        }</p>
        <table>
          <thead>
            <tr>
              <th>日付 / Date</th>
              ${staffMembers.map((staff) => `<th>${staff.name}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${dateRange
              .map((date) => {
                const validDate = new Date(date);
                if (isNaN(validDate.getTime())) return ""; // Skip invalid dates

                const dateKey = format(validDate, "yyyy-MM-dd");
                return `
                <tr>
                  <td class="date-header">${format(validDate, "d")} <small>${format(validDate, "EEE", { locale: ja })}</small></td>
                  ${staffMembers
                    .map((staff) => {
                      // Check if date is within work period
                      if (!isDateWithinWorkPeriod(validDate, staff)) {
                        return '<td class="not-working">-</td>'; // Show dash for dates outside work period
                      }

                      const shift = schedule[staff.id]?.[dateKey] || "";
                      let symbol = "";

                      // Handle empty string as normal shift (different display for パート vs others)
                      if (!shift || shift === "" || shift === "normal") {
                        // Special case: Nakata (中田) shows unavailable symbol for normal/empty shifts
                        if (staff.name === "中田") {
                          symbol = "⊘";
                        } else {
                          // Normal shift - show circle for パート, blank for others
                          symbol = staff.status === "パート" ? "○" : "";
                        }
                      } else {
                        // Try to find symbol by direct value match first (for symbols stored directly)
                        const symbolEntry = Object.entries(shiftSymbols).find(
                          ([key, val]) => val.symbol === shift
                        );
                        // If found as symbol, use it; otherwise lookup by key; fallback to original value
                        symbol = symbolEntry ? shift : (shiftSymbols[shift]?.symbol || shift);
                      }

                      return `<td class="${shift || 'normal'}"><span class="shift-symbol">${symbol}</span></td>`;
                    })
                    .join("")}
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
        <div class="legend">
          <p>△ = Early Shift | ○ = Normal Shift | ◇ = Late Shift | × = Off Day | ⊘ = Unavailable</p>
        </div>
      </body>
    </html>
  `;
};

// Print schedule
export const printSchedule = (staffMembers, dateRange, schedule) => {
  // Validate input parameters
  if (!Array.isArray(staffMembers)) {
    console.error("printSchedule: staffMembers is not an array:", staffMembers);
    alert(
      "スタッフデータの読み込みに失敗しました。ページを再読み込みしてください。",
    );
    return;
  }

  if (!Array.isArray(dateRange) || dateRange.length === 0) {
    console.error("printSchedule: dateRange is invalid:", dateRange);
    alert("日付範囲が正しくありません。");
    return;
  }

  if (!schedule || typeof schedule !== "object") {
    console.error("printSchedule: schedule is invalid:", schedule);
    alert("スケジュールデータが正しくありません。");
    return;
  }

  const printContent = generatePrintHTML(staffMembers, dateRange, schedule);
  const printWindow = window.open("", "_blank");

  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  } else {
    alert("ポップアップがブロックされました。ポップアップを許可してください。");
  }
};

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { shiftSymbols } from '../constants/shiftConstants';
import { isDateWithinWorkPeriod } from './dateUtils';

// Export schedule to CSV format
export const exportToCSV = (staffMembers, dateRange, schedule) => {
  const headers = ['Date / 日付', ...staffMembers.map(staff => staff?.name || 'Unknown')];
  const rows = [headers];

  dateRange.forEach(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const row = [
      `${format(date, 'dd-MMM')} (${format(date, 'EEE', { locale: ja })})`,
      ...staffMembers.map(staff => {
        // Check if date is within work period
        if (!isDateWithinWorkPeriod(date, staff)) {
          return '-'; // Show dash for dates outside work period
        }
        const shift = schedule[staff.id]?.[dateKey] || '';
        return shift ? shiftSymbols[shift]?.symbol || '' : '';
      })
    ];
    rows.push(row);
  });

  try {
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift-schedule-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('エクスポートに失敗しました。もう一度お試しください。');
  }
};

// Generate print-friendly HTML content
export const generatePrintHTML = (staffMembers, dateRange, schedule) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Schedule</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .date-header { font-weight: bold; background-color: #f9f9f9; }
          .not-working { background-color: #f0f0f0; color: #999; }
          .early { color: #2563eb; }
          .normal { color: #374151; }
          .late { color: #7c3aed; }
          .off { color: #dc2626; }
          .holiday { color: #eab308; }
          .unavailable { color: #991b1b; }
        </style>
      </head>
      <body>
        <h1>🍣 Japanese Restaurant Shift Schedule</h1>
        <p>期間: ${format(dateRange[0], 'yyyy年M月d日')} ~ ${format(dateRange[dateRange.length - 1], 'yyyy年M月d日')}</p>
        <table>
          <thead>
            <tr>
              <th>日付 / Date</th>
              ${staffMembers.map(staff => `<th>${staff.name}<br><small>${staff.position}</small></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dateRange.map(date => {
              const dateKey = format(date, 'yyyy-MM-dd');
              return `
                <tr>
                  <td class="date-header">${format(date, 'dd-MMM')}<br><small>${format(date, 'EEE', { locale: ja })}</small></td>
                  ${staffMembers.map(staff => {
                    // Check if date is within work period
                    if (!isDateWithinWorkPeriod(date, staff)) {
                      return '<td class="not-working">-</td>'; // Show dash for dates outside work period
                    }
                    const shift = schedule[staff.id]?.[dateKey] || '';
                    const symbol = shift ? shiftSymbols[shift]?.symbol || '' : '';
                    return `<td class="${shift}">${symbol}</td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top: 20px; font-size: 12px;">
          <p>△ = Early Shift (10:00-18:00) | ○ = Normal Shift (11:00-20:00) | ◇ = Late Shift (15:00-23:00) | × = Off Day | ⊘ = Unavailable</p>
        </div>
      </body>
    </html>
  `;
};

// Print schedule
export const printSchedule = (staffMembers, dateRange, schedule) => {
  const printContent = generatePrintHTML(staffMembers, dateRange, schedule);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  } else {
    alert('ポップアップがブロックされました。ポップアップを許可してください。');
  }
};
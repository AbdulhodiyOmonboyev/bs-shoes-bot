const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { formatMoney, formatDuration } = require('../utils/helpers');

const tempDir = path.join(__dirname, '..', '..', 'data', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Generate Attendance Excel Report
 */
async function generateAttendanceExcel(attendanceRecords, title = 'Davomat Hisoboti') {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Davomat');

  worksheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Sana', key: 'date', width: 14 },
    { header: 'Ishchi F.I.Sh', key: 'name', width: 26 },
    { header: 'Roli', key: 'role', width: 18 },
    { header: 'Belgilangan vaqt', key: 'start_time', width: 16 },
    { header: 'Kelgan vaqti', key: 'check_in', width: 14 },
    { header: 'Ketgan vaqti', key: 'check_out', width: 14 },
    { header: 'Ishlangan vaqt', key: 'worked', width: 18 },
    { header: 'Bonus', key: 'bonus', width: 14 },
    { header: 'Jarima', key: 'fine', width: 14 },
    { header: 'Holati', key: 'status', width: 14 }
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' } // Dark blue
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  attendanceRecords.forEach((row, idx) => {
    const roleName = row.role === 'student' ? "Maktab o'quvchisi 🎒" : "Oddiy ishchi 👷‍♂️";
    const statusText = row.status === 'completed' ? 'Yakunlangan' : row.status === 'late' ? 'Kechikkan' : 'Kelgan';
    
    const r = worksheet.addRow({
      index: idx + 1,
      date: row.date,
      name: row.full_name,
      role: roleName,
      start_time: row.work_start_time || '09:00',
      check_in: row.check_in_time || '-',
      check_out: row.check_out_time || 'Hali ishda',
      worked: row.worked_minutes ? formatDuration(row.worked_minutes) : '-',
      bonus: row.bonus_amount ? formatMoney(row.bonus_amount) : "0 so'm",
      fine: row.fine_amount ? formatMoney(row.fine_amount) : "0 so'm",
      status: statusText
    });
    r.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const filePath = path.join(tempDir, `davomat_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Generate Payroll Settlement Excel Report
 */
async function generatePayrollExcel(settlements, periodNumber) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Haftalik #${periodNumber}`);

  worksheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Ishchi F.I.Sh', key: 'name', width: 26 },
    { header: 'Qilingan ish', key: 'work_sum', width: 18 },
    { header: 'Bonus (+)', key: 'bonus', width: 16 },
    { header: 'Kechikish (-)', key: 'late_fine', width: 16 },
    { header: 'Boshqa jarima (-)', key: 'other_fine', width: 18 },
    { header: 'Avans (-)', key: 'advance', width: 16 },
    { header: "To'lanadigan sof oylik", key: 'net_salary', width: 24 }
  ];

  // Header styling
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF15803D' } // Emerald green
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  let totalPayout = 0;
  settlements.forEach((item, idx) => {
    const f = item.financials;
    totalPayout += f.netSalary;
    const r = worksheet.addRow({
      index: idx + 1,
      name: item.worker.full_name,
      work_sum: formatMoney(f.totalWork),
      bonus: formatMoney(f.totalBonus),
      late_fine: formatMoney(f.totalLateFine),
      other_fine: formatMoney(f.totalFines),
      advance: formatMoney(f.totalAdvances),
      net_salary: formatMoney(f.netSalary)
    });
    r.alignment = { vertical: 'middle', horizontal: 'right' };
    r.getCell('index').alignment = { vertical: 'middle', horizontal: 'center' };
    r.getCell('name').alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Summary Row
  const totalRow = worksheet.addRow({
    index: '',
    name: 'JAMI TO\'LOV:',
    work_sum: '',
    bonus: '',
    late_fine: '',
    other_fine: '',
    advance: '',
    net_salary: formatMoney(totalPayout)
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFDE047' } // Light yellow
  };

  const filePath = path.join(tempDir, `oylik_davr_${periodNumber}_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

/**
 * Generate Client Orders Excel Report
 */
async function generateClientReportExcel(clients, ordersByClientId) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Mijozlar va Sotuv');

  worksheet.columns = [
    { header: '#', key: 'index', width: 6 },
    { header: 'Mijoz', key: 'name', width: 24 },
    { header: 'Telefon', key: 'phone', width: 16 },
    { header: 'Do\'kon / Tashkilot', key: 'company', width: 20 },
    { header: 'Mahsulot', key: 'product', width: 22 },
    { header: 'Pochka soni', key: 'packs', width: 14 },
    { header: 'Pochka narxi', key: 'price', width: 16 },
    { header: 'Jami summa', key: 'total', width: 18 },
    { header: 'To\'langan', key: 'paid', width: 18 },
    { header: 'Qoldiq qarz', key: 'debt', width: 18 },
    { header: 'Sana', key: 'date', width: 16 }
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4338CA' } // Indigo
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  let counter = 1;
  clients.forEach(c => {
    const orders = ordersByClientId[c.id] || [];
    if (orders.length === 0) {
      worksheet.addRow({
        index: counter++,
        name: c.name,
        phone: c.phone || '-',
        company: c.company_name || '-',
        product: '-',
        packs: '-',
        price: '-',
        total: "0 so'm",
        paid: "0 so'm",
        debt: "0 so'm",
        date: '-'
      });
    } else {
      orders.forEach(o => {
        worksheet.addRow({
          index: counter++,
          name: c.name,
          phone: c.phone || '-',
          company: c.company_name || '-',
          product: o.product_name,
          packs: o.packs_quantity,
          price: formatMoney(o.price_per_pack),
          total: formatMoney(o.total_amount),
          paid: formatMoney(o.paid_amount),
          debt: formatMoney(o.debt_amount),
          date: o.created_at.slice(0, 10)
        });
      });
    }
  });

  const filePath = path.join(tempDir, `clientlar_${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = {
  generateAttendanceExcel,
  generatePayrollExcel,
  generateClientReportExcel
};

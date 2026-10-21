import ExcelJS from 'exceljs';

// Stops Excel from running text like "=HYPERLINK(...)" as a formula
const safeCell = (value) =>
  typeof value === 'string' && /^([=@\t\r]|[+-][^0-9])/.test(value) ? `'${value}` : value;

// Sends an .xlsx file as a download.
// columns: [{ header: 'Name', key: 'name', width: 25 }]
const sendExcel = async (res, filename, columns, rows) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');

  sheet.columns = columns;
  rows.forEach((row) => {
    const safeRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, safeCell(value)])
    );
    sheet.addRow(safeRow);
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

export default sendExcel;

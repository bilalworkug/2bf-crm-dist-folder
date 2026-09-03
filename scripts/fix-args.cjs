const fs = require('fs');
const dir = './components/dashboards';
const files = fs.readdirSync(dir);
files.forEach(f => {
  if (f.endsWith('.tsx')) {
    let c = fs.readFileSync(dir + '/' + f, 'utf8');
    let fixed = false;
    
    // Some are missing arguments because of my previous script
    if (c.includes('exportDashboardToPDF();')) {
      const role = f.split('-dashboard.tsx')[0].replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      c = c.replace(/exportDashboardToPDF\(\);/g, `exportDashboardToPDF(data, filters, profile?.full_name || 'User', '${role}');`);
      fixed = true;
    }
    if (c.includes('exportDashboardToExcel();')) {
      const role = f.split('-dashboard.tsx')[0].replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
      c = c.replace(/exportDashboardToExcel\(\);/g, `exportDashboardToExcel(data, filters, profile?.full_name || 'User', '${role}');`);
      fixed = true;
    }

    if (fixed) fs.writeFileSync(dir + '/' + f, c);
  }
});

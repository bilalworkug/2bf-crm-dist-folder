// Ambient declaration to help TypeScript resolve jsPDF and jspdf-autotable
// under bundler moduleResolution where the types path may not be resolved correctly
declare module 'jspdf' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPDF: any;
  export default jsPDF;
}

declare module 'jspdf-autotable' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable: any;
  export default autoTable;
}

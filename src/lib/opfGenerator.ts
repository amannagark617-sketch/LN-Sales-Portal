export const generateOPF = (
  month: string,
  financialYear: string,
  salespersonCode: string,
  sequence: number
): string => {
  const mm = month.padStart(2, '0');
  const nn = sequence.toString().padStart(2, '0');
  return `LND${mm}${financialYear}${salespersonCode}${nn}`;
};

import { OPFData, Salesperson } from '../types';

export const getNextOPFNumber = (
  opfData: OPFData[],
  codeMap: Record<string, string>,
  salespersonName: string,
  visitType: string
): string => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString();
  const fy = '2627';
  
  // 1. Determine salesperson code from the uploaded unique code mapping using composite key
  // Key format in codeMap must be: 'visitType-salespersonName'
  const key = `${visitType.trim().toLowerCase()}-${salespersonName.trim().toLowerCase()}`;
  const salespersonCode = codeMap[key] || 'AR';
  
  console.log('--- DEBUG OPF GENERATION ---');
  console.log('Generating OPF for:', { visitType, salespersonName, salespersonCode, lookupKey: key });
  
  // 2. Filter ALL OPF data for this salesperson code within the same financial year
  // The OPF number structure is LND + MM + FY + CODE + SEQ
  // We search for matches that include the FY and SalespersonCode specifically
  const searchPattern = `${fy}${salespersonCode}`;
  
  const allSalespersonEntries = opfData.filter(o => {
    // We check if the OPF contains the year and code in the expected relative positions
    // Structure: LND(3) MM(2) FY(4) CODE(...) SEQ(2)
    const isMatch = o.opf.includes(searchPattern);
    if (isMatch) console.log('Historical match found for year sequence:', o.opf);
    return isMatch;
  });
  
  console.log('Found', allSalespersonEntries.length, 'historical entries for this FY matching code:', salespersonCode);
  
  // 3. Find the max sequence across the entire year
  let maxSequence = 0;
  
  if (allSalespersonEntries.length > 0) {
    const sequences = allSalespersonEntries.map(o => {
      // Look for the trailing digits at the very end of the string
      const match = o.opf.match(/(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    maxSequence = Math.max(...sequences, 0);
  }
  
  console.log('Calculated maxSequence:', maxSequence);
  
  return generateOPF(month, fy, salespersonCode, maxSequence + 1);
};

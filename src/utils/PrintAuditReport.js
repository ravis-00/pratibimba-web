import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // 🟢 FIX 1: Import as a function

// Helper to format dates
const formatDate = (dateVal) => {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return dateVal;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) { return dateVal; }
};

// Helper to add days to a date
const addDays = (dateVal, days) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  d.setDate(d.getDate() + days);
  return formatDate(d);
};

export const generateAuditReportPDF = async (report) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // ==========================================
  // 1. LOGO & HEADER
  // ==========================================
  const logoUrl = '/logo.png';
  const logoImg = new Image();
  logoImg.src = logoUrl;

  // We wrap the rest in a function to run after image loads (or fails)
  const generateContent = () => {
      // B. Main Title
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text("INTERNAL QUALITY AUDIT REPORT", pageWidth / 2, 45, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Ref: ${(report.audit_id || "").replace("IQA", "IAR")}`, pageWidth / 2, 52, { align: "center" });

      // ==========================================
      // 2. METADATA TABLE
      // ==========================================
      const reportDate = report.completion_date || report.schedule_end_date || new Date();
      
      // 🟢 FIX 2: Use autoTable(doc, options) instead of doc.autoTable
      autoTable(doc, {
        startY: 60,
        head: [['Attribute', 'Details', 'Attribute', 'Details']],
        body: [
          ['Report ID', (report.audit_id || "").replace("IQA", "IAR"), 'Report Date', formatDate(reportDate)],
          ['Location', report.prakalpa_name || '-', 'Audit Type', 'Internal Quality Audit'],
          ['Functional Area', report.functional_area || '-', 'Criteria', 'SQAA / SESQ / Policies'],
          ['Audit Period', `${formatDate(report.schedule_start_date)} to ${formatDate(report.schedule_end_date)}`, 'Status', (report.status || 'COMPLETED').toUpperCase()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontStyle: 'bold', lineColor: [200, 200, 200] },
        styles: { fontSize: 9, cellPadding: 2, lineColor: [200, 200, 200] },
        columnStyles: { 0: { fontStyle: 'bold', width: 35 }, 2: { fontStyle: 'bold', width: 35 } }
      });

      // ==========================================
      // 3. EXECUTIVE SUMMARY & MANDATE
      // ==========================================
      let ncCount = 0;
      let ofiCount = 0;
      let gpCount = 0;

      (report.observations || []).forEach(obs => {
          const t = (obs.type || "").toLowerCase();
          if (t.includes('non') || t.includes('nc')) ncCount++;
          else if (t.includes('improvement') || t.includes('opportunity')) ofiCount++;
          else if (t.includes('good') || t.includes('practice')) gpCount++;
      });

      const summaryY = doc.lastAutoTable.finalY + 10;
      
      // Draw Summary Boxes
      const boxWidth = 50;
      const boxHeight = 20;
      const startX = (pageWidth - (boxWidth * 3) - 20) / 2; // Center the 3 boxes

      // NC Box
      doc.setDrawColor(220, 53, 69); doc.setFillColor(255, 240, 240);
      doc.roundedRect(startX, summaryY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(220, 53, 69); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(String(ncCount), startX + (boxWidth/2), summaryY + 8, { align: 'center' });
      doc.setFontSize(7);
      doc.text("NON-CONFORMANCES", startX + (boxWidth/2), summaryY + 15, { align: 'center' });

      // OFI Box
      doc.setDrawColor(13, 110, 253); doc.setFillColor(240, 245, 255);
      doc.roundedRect(startX + boxWidth + 10, summaryY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(13, 110, 253); doc.setFontSize(14);
      doc.text(String(ofiCount), startX + boxWidth + 10 + (boxWidth/2), summaryY + 8, { align: 'center' });
      doc.setFontSize(7);
      doc.text("OPPORTUNITIES (OFI)", startX + boxWidth + 10 + (boxWidth/2), summaryY + 15, { align: 'center' });

      // GP Box
      doc.setDrawColor(25, 135, 84); doc.setFillColor(240, 255, 245);
      doc.roundedRect(startX + (boxWidth * 2) + 20, summaryY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(25, 135, 84); doc.setFontSize(14);
      doc.text(String(gpCount), startX + (boxWidth * 2) + 20 + (boxWidth/2), summaryY + 8, { align: 'center' });
      doc.setFontSize(7);
      doc.text("GOOD PRACTICES", startX + (boxWidth * 2) + 20 + (boxWidth/2), summaryY + 15, { align: 'center' });

      // --- ACTION MANDATE WITH DATES ---
      const mandateY = summaryY + boxHeight + 8;
      const ncTarget = addDays(reportDate, 30);
      const ofiTarget = addDays(reportDate, 60);

      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'bold');
      doc.text("Action Mandate:", 14, mandateY);
      
      doc.setFont('helvetica', 'normal');
      const mandateText = `NCs to be closed within 30 days (${ncTarget}). OFIs to be addressed within 60 days (${ofiTarget}).`;
      doc.text(mandateText, 45, mandateY);

      // ==========================================
      // 4. DETAILED FINDINGS TABLE
      // ==========================================
      const tableData = (report.observations || []).map((obs, index) => {
          let idRef = (report.audit_id || "REF").replace("IQA", "IAR");
          let typeLabel = "Note";
          const t = (obs.type || "").toLowerCase();

          // Sequential ID generation
          const seqId = `${idRef}-${String(index + 1).padStart(2, '0')}`;

          if (t.includes('non') || t.includes('nc')) typeLabel = "Non-Conformance";
          else if (t.includes('improvement') || t.includes('opportunity')) typeLabel = "Opportunity for Improvement";
          else if (t.includes('good')) typeLabel = "Good Practice";

          return [
              seqId,
              typeLabel,
              obs.functional_area || "General",
              obs.observation_text || "-"
          ];
      });

      // 🟢 FIX 2: Use autoTable(doc, options)
      autoTable(doc, {
        startY: mandateY + 10,
        head: [['Obs ID', 'Type', 'Area', 'Observation & Finding']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 50, 65], textColor: [255, 255, 255], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: { 
            0: { width: 35, fontStyle: 'bold' },
            1: { width: 45, fontStyle: 'bold' },
            2: { width: 30 },
            3: { width: 'auto' } // Text wrap
        }
      });

      // ==========================================
      // 5. SIGNATURES & DISCLAIMER
      // ==========================================
      const finalY = doc.lastAutoTable.finalY + 30; // Space after table
      
      // Check if we have space, else add page
      if (finalY > 250) doc.addPage();

      const sigY = finalY > 250 ? 40 : finalY;

      doc.setLineWidth(0.5);
      doc.setDrawColor(100, 100, 100);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);

      // Auditor Section
      doc.setFont('helvetica', 'bold');
      doc.text(report.coordinator_name || "Coordinator", 30, sigY - 2, { align: 'center' }); // Name
      doc.line(15, sigY, 85, sigY); // Line
      doc.setFont('helvetica', 'normal');
      doc.text("Auditor", 50, sigY + 5, { align: 'center' }); // Label

      // Auditee Section
      const auditeeName = report.assigned_auditees ? report.assigned_auditees.split(',')[0] : "Auditee";
      
      doc.setFont('helvetica', 'bold');
      doc.text(auditeeName, pageWidth - 50, sigY - 2, { align: 'center' }); // Name
      doc.line(pageWidth - 85, sigY, pageWidth - 15, sigY); // Line
      doc.setFont('helvetica', 'normal');
      doc.text("Auditee", pageWidth - 50, sigY + 5, { align: 'center' }); // Label

      // Auto-Gen Disclaimer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text("This report is system generated. Physical signatures are not required for digital compliance.", pageWidth / 2, sigY + 20, { align: 'center' });

      // Save
      doc.save(`Report_${(report.audit_id || "Draft").replace("IQA", "IAR")}.pdf`);
  };

  logoImg.onload = () => {
    // Draw Logo (Top Center)
    const logoWidth = 25;
    const logoHeight = 25;
    const logoX = (pageWidth - logoWidth) / 2;
    doc.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
    generateContent();
  };

  logoImg.onerror = () => {
    // If logo fails, generate without it
    generateContent();
  };
};
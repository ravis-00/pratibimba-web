import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateAuditReportPDF = (reportData) => {
  const doc = new jsPDF();
  
  // 🟢 1. CALCULATE REPORT REF (e.g., IQAN25140 -> IARN25140)
  const reportRef = (reportData.audit_id || "REF").replace("IQA", "IAR");

  // --- HEADER ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RASHTROTTHANA PARISHAT", 14, 15);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Central Quality Audit Team", 195, 15, { align: 'right' });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185); 
  doc.text("INTERNAL QUALITY AUDIT REPORT", 105, 25, { align: 'center' });
  doc.setTextColor(0, 0, 0); 
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Report Ref: ${reportRef}`, 105, 30, { align: 'center' });

  // --- AUDIT CONTEXT ---
  const auditInfo = [
    ["Report Ref ID", reportRef, "Report Date", new Date().toLocaleDateString()],
    ["Location", reportData.prakalpa_name || "N/A", "Audit Type", "Internal Quality Audit"],
    ["Functional Area", reportData.functional_area || "N/A", "Criteria", "SQAA / SESQ / Policies / SOPs"],
    ["Audit Period", `${reportData.schedule_start_date || '-'} to ${reportData.schedule_end_date || '-'}`, "Status", "COMPLETED"]
  ];

  autoTable(doc, {
    startY: 35,
    body: auditInfo,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 35, fillColor: [245, 245, 245] },
      1: { width: 60 },
      2: { fontStyle: 'bold', width: 35, fillColor: [245, 245, 245] },
      3: { width: 60 }
    }
  });

  // --- EXECUTIVE SUMMARY COUNTS ---
  let ncCount = 0, ofiCount = 0, gpCount = 0;
  let trackingSequence = 0; // Sequence for NC/OFI (01, 02, 03)

  // 🟢 2. NEW ID GENERATION LOGIC
  const observationsBody = reportData.observations.map((obs) => {
    const type = (obs.type || "").toUpperCase();
    let uniqueId = "";
    
    // Check Type
    const isNC = type.includes("NON") || type.includes("NC");
    const isOFI = type.includes("IMPROVEMENT") || type.includes("OFI");
    const isGP = type.includes("GOOD") || type.includes("GP");

    if (isNC || isOFI) {
      // Increment Main Tracking Sequence
      trackingSequence++;
      // ID Format: IARN25140-01
      uniqueId = `${reportRef}-${String(trackingSequence).padStart(2, '0')}`;
      
      // Update Summary Counts
      if (isNC) ncCount++;
      if (isOFI) ofiCount++;
    } 
    else {
      // GP Logic remains separate
      gpCount++;
      uniqueId = `GP-${String(gpCount).padStart(2, '0')}`;
    }

    return [
      uniqueId, 
      type.split(' ')[0], 
      obs.functional_area || "General",
      obs.observation_text || "-"
    ];
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  
  // --- CARDS DRAWING (Summary) ---
  const cardWidth = 55;
  const cardHeight = 25;
  const gap = 8;
  const startX = 14;

  // NC Card
  doc.setDrawColor(255, 200, 200);
  doc.setFillColor(255, 245, 245);
  doc.roundedRect(startX, finalY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(16);
  doc.setTextColor(192, 57, 43); 
  doc.text(String(ncCount), startX + (cardWidth/2), finalY + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.text("NON-CONFORMANCES", startX + (cardWidth/2), finalY + 20, { align: 'center' });

  // OFI Card
  doc.setDrawColor(200, 200, 255);
  doc.setFillColor(245, 245, 255);
  doc.roundedRect(startX + cardWidth + gap, finalY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(16);
  doc.setTextColor(41, 128, 185); 
  doc.text(String(ofiCount), startX + cardWidth + gap + (cardWidth/2), finalY + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.text("OPPORTUNITIES (OFI)", startX + cardWidth + gap + (cardWidth/2), finalY + 20, { align: 'center' });

  // GP Card
  doc.setDrawColor(200, 255, 200);
  doc.setFillColor(245, 255, 245);
  doc.roundedRect(startX + (cardWidth * 2) + (gap * 2), finalY, cardWidth, cardHeight, 3, 3, 'FD');
  doc.setFontSize(16);
  doc.setTextColor(39, 174, 96); 
  doc.text(String(gpCount), startX + (cardWidth * 2) + (gap * 2) + (cardWidth/2), finalY + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.text("GOOD PRACTICES", startX + (cardWidth * 2) + (gap * 2) + (cardWidth/2), finalY + 20, { align: 'center' });

  // Mandate Text
  doc.setTextColor(100);
  doc.setFontSize(8);
  doc.text("* Action Mandate: NCs to be closed within 30 days. OFIs to be addressed within 60 days.", 14, finalY + 32);
  doc.setTextColor(0); 

  // --- DETAILED OBSERVATIONS TABLE ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Detailed Findings", 14, finalY + 42);

  autoTable(doc, {
    startY: finalY + 45,
    head: [['Obs ID', 'Type', 'Area', 'Observation & Finding']],
    body: observationsBody,
    theme: 'grid',
    headStyles: { fillColor: [52, 73, 94] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { width: 35, fontStyle: 'bold' }, // Made wider for IARN25140-01
      1: { width: 25 },
      2: { width: 40 },
      3: { width: 'auto' }
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const text = data.cell.raw;
        if (text.includes('NC')) data.cell.styles.textColor = [192, 57, 43]; 
        if (text.includes('OFI')) data.cell.styles.textColor = [41, 128, 185]; 
        if (text.includes('GP')) data.cell.styles.textColor = [39, 174, 96]; 
      }
    }
  });

  // --- SIGNATURES ---
  const sigY = doc.lastAutoTable.finalY + 20;
  if (sigY < 270) {
      doc.setFontSize(9);
      doc.text("__________________________", 14, sigY);
      doc.text("Auditor Signature", 14, sigY + 5);
      
      doc.text("__________________________", 140, sigY);
      doc.text("Auditee Acknowledgment", 140, sigY + 5);
  }

  doc.save(`Report_${reportRef}.pdf`);
};
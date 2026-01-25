import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // 🟢 1. Import as a named function

export const generateAuditSchedulePDF = (audit, logoUrl) => {
  const doc = new jsPDF();
  
  // --- 1. HEADER ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RASHTROTTHANA PARISHAT", 14, 15);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Central Quality Audit Team", 195, 15, { align: 'right' });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(41, 128, 185); 
  doc.text("INTERNAL AUDIT SCHEDULE", 105, 25, { align: 'center' });
  doc.setTextColor(0, 0, 0); 

  // --- 2. AUDIT DETAILS ---
  const auditDetailsData = [
    ["Audit Ref ID", audit.audit_id || "N/A", "Date of Issue", new Date().toLocaleDateString()],
    ["Location / Prakalpa", audit.prakalpa_name || "N/A", "Audit Type", "Internal Quality Audit"],
    ["Functional Area", audit.functional_area || "N/A", "Standard / Criteria", "SQAA / SESQ / Policies / SOPs"],
    ["Audit Scope", `${audit.functional_area || ''} & Associated Audit Areas`, "", ""]
  ];

  // 🟢 2. Use autoTable(doc, options) instead of doc.autoTable(options)
  autoTable(doc, {
    startY: 35,
    body: auditDetailsData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', width: 40, fillColor: [245, 245, 245] },
      1: { width: 55 },
      2: { fontStyle: 'bold', width: 40, fillColor: [245, 245, 245] },
      3: { width: 55 }
    }
  });

  // --- 3. AUDIT TEAM ---
  const teamData = [
    ["Audit Coordinator", audit.coordinator_name || "Central Office"],
    ["Auditor(s)", audit.auditors_list || "Assigned Team"],
    ["Auditee (Process Owner)", audit.auditee_name || "Department Head"]
  ];

  doc.text("Audit Team", 14, doc.lastAutoTable.finalY + 10);
  
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [['Role', 'Name']],
    body: teamData,
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [52, 73, 94] }
  });

  // --- 4. AGENDA (Using 'schedule_time' Column) ---
  const selectedSlot = audit.schedule_time || "9:30 to 5:30"; 
  let agendaData = [];

  if (selectedSlot.includes("1:30")) {
    // OPTION A: MORNING (9:30 to 1:30)
    agendaData = [
      ["09:30 AM - 10:00 AM", "Opening Meeting", "Auditors & Auditee Team"],
      ["10:00 AM - 01:00 PM", "Staff Interview / Physical Verification / Records", "Auditee / Process Owner"],
      ["01:00 PM - 01:30 PM", "Closing Meeting", "Auditors & Auditee Team"]
    ];
  } 
  else if (selectedSlot.includes("2:00")) {
    // OPTION B: AFTERNOON (2:00 to 5:30)
    agendaData = [
      ["02:00 PM - 02:30 PM", "Opening Meeting", "Auditors & Auditee Team"],
      ["02:30 PM - 05:00 PM", "Staff Interview / Physical Verification / Records", "Auditee / Process Owner"],
      ["05:00 PM - 05:30 PM", "Closing Meeting", "Auditors & Auditee Team"]
    ];
  } 
  else {
    // OPTION C: FULL DAY (9:30 to 5:30)
    agendaData = [
      ["09:30 AM - 10:00 AM", "Opening Meeting", "Auditors & Auditee Team"],
      ["10:00 AM - 12:30 PM", "Staff Interview / Physical Verification / Records", "Auditee / Process Owner"],
      ["12:30 PM - 02:00 PM", "Lunch Break", "-"],
      ["02:00 PM - 04:30 PM", "Staff Interviews / Doc Verification / Reviews", "Staff / Users"],
      ["04:30 PM", "Closing Meeting (Summary of Findings)", "Auditors & Auditee Team"]
    ];
  }

  doc.text(`Audit Agenda (${selectedSlot})`, 14, doc.lastAutoTable.finalY + 10);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [['Time', 'Activity / Process', 'Participants']],
    body: agendaData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    styles: { fontSize: 9, cellPadding: 3 }
  });

  // --- 5. FOOTER ---
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Note: Please ensure all relevant files, registers, and personnel are available during the audit slots.", 14, finalY);
  doc.text("This is a system-generated schedule.", 14, finalY + 5);

  doc.save(`Audit_Schedule_${audit.audit_id}.pdf`);
};
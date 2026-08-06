import { isSimplified, isSAS, isScanning, isReconstruction, isSpecialType, STATUSES, PROBATE_STATUSES, POWER_OF_ATTORNEY_STATUSES, SAS_STATUSES, SCAN_STATUSES, RECONSTRUCTION_STATUSES } from "./constants.js";
import { monthsElapsed } from "./format.js";

/* ---- Operational Excellence: when each case type counts as "completed", and which score category it feeds ---- */
export const isCarCompleted = (car) => {
  if (car.status === "Notarized" || car.status === "Completed" || car.status === "Returned from Registry") return true;
  if (car.status === "Registering" && car.registry_filing_number && car.pin) return true; // copied from the registry's spreadsheet
  if ((car.case_type === "Power of Attorney" || car.case_type === "Sub-power of Attorney") && car.paid_status === "ok") return true; // car powers of attorney / sub-powers also count once paid
  return false;
};
export const isPropertyCompleted = (property) =>
  property.stage === "Completed" || property.stage === "Registering" || (property.first_copy === true && property.taxes_paid === true);

export const isSimplifiedDocument = (type) => isSimplified(type); // Certified Copy, Notarial Certificate, Payment Receipt, Notarial Deed, Power/Sub-power of Attorney

export const isDocumentCompleted = (doc) => {
  if (isSimplifiedDocument(doc.document_type)) return doc.power_of_attorney_status === "Paid";
  if (doc.document_type === "Estate Probate") return doc.probate_status === "Registration";
  if (isSAS(doc.document_type)) return doc.sas_status === "Final" || doc.sas_status === "Registry Filing";
  if (isScanning(doc.document_type)) return doc.scan_status === "Completed";
  if (isReconstruction(doc.document_type)) return doc.reconstruction_status === "Paid";
  return doc.status === "Completed";
};

/* Equivalent of "Pending" for each document type, to know when to show the reminder */
export const isPendingLike = (doc) => {
  if (isSimplifiedDocument(doc.document_type)) return doc.power_of_attorney_status === POWER_OF_ATTORNEY_STATUSES[0];
  if (doc.document_type === "Estate Probate") return doc.probate_status === PROBATE_STATUSES[0];
  if (isSAS(doc.document_type)) return doc.sas_status === SAS_STATUSES[0];
  if (isScanning(doc.document_type)) return doc.scan_status === SCAN_STATUSES[0];
  if (isReconstruction(doc.document_type)) return doc.reconstruction_status === RECONSTRUCTION_STATUSES[0];
  return doc.status === "Pending";
};

/* Operational Excellence score category that a completed document contributes to */
export const scoreCategoryForDocument = (doc) => {
  if (["Notarial Certificate", "Certified Copy", "Sub-power of Attorney", "Special Power of Attorney"].includes(doc.document_type)) return "certificates";
  if (["General Power of Attorney", "SAS", "Notarial Deed", "Estate Probate"].includes(doc.document_type)) return "probates";
  return null; // Payment Receipt, Document Scanning, Signature Certification, Other: don't count toward score
};

/* The document's current status, whichever specific field applies to its type */
export const documentStatusLabel = (doc) => {
  if (isSimplifiedDocument(doc.document_type)) return doc.power_of_attorney_status;
  if (doc.document_type === "Estate Probate") return doc.probate_status;
  if (isSAS(doc.document_type)) return doc.sas_status;
  if (isScanning(doc.document_type)) return doc.scan_status;
  if (isReconstruction(doc.document_type)) return doc.reconstruction_status;
  return doc.status;
};

/* "Pending" or "In Progress" equivalent: the first two stages of whichever flow applies to the document */
export const documentInEarlyStage = (doc) => {
  let arr = STATUSES, val = doc.status;
  if (isSimplifiedDocument(doc.document_type)) { arr = POWER_OF_ATTORNEY_STATUSES; val = doc.power_of_attorney_status; }
  else if (doc.document_type === "Estate Probate") { arr = PROBATE_STATUSES; val = doc.probate_status; }
  else if (isSAS(doc.document_type)) { arr = SAS_STATUSES; val = doc.sas_status; }
  else if (isScanning(doc.document_type)) { arr = SCAN_STATUSES; val = doc.scan_status; }
  else if (isReconstruction(doc.document_type)) { arr = RECONSTRUCTION_STATUSES; val = doc.reconstruction_status; }
  const idx = arr.indexOf(val);
  return idx === 0 || idx === 1;
};
export const carInEarlyStage = (car) => car.status === "Pending" || car.status === "In Progress";

/* Automatic sum of completed cars, documents and properties for a given month (YYYY-MM), grouped by score category */
export function computeAutomaticTotals(cars, documents, properties, flaggedDocuments, ym) {
  const t = { properties: 0, notarizations: 0, probates: 0, certificates: 0, salesChecked: 0, salesFlagged: 0, flaggedCertificates: 0 };
  properties.forEach((p) => { if (isPropertyCompleted(p) && p.completed_at?.slice(0, 7) === ym) t.properties += 1; });
  cars.forEach((c) => {
    if (isCarCompleted(c) && c.completed_at?.slice(0, 7) === ym) t.notarizations += (c.case_type === "Trade-in" ? 2 : 1);
    if ((c.case_type === "Sale" || c.case_type === "Trade-in") && c.case_date?.slice(0, 7) === ym) t.salesChecked += 1;
  });
  documents.forEach((d) => {
    if (!isDocumentCompleted(d) || d.completed_at?.slice(0, 7) !== ym) return;
    const cat = scoreCategoryForDocument(d);
    if (cat) t[cat] += 1;
  });
  (flaggedDocuments || []).forEach((f) => {
    if (!f.flagged_date || f.flagged_date.slice(0, 7) > ym) return;
    if (f.resolved && f.resolved_at && f.resolved_at.slice(0, 7) < ym) return; // already resolved before this month: kept in history but no longer penalizes
    if (f.sector === "Documents") t.flaggedCertificates += 1;
    else t.salesFlagged += 1;
  });
  return t;
}

export { monthsElapsed };
export const isCarObjectionDueSoon = (flag) => flag.sector !== "Documents" && monthsElapsed(flag.flagged_date) >= 4;

/* ---- WhatsApp link builders ---- */
export function whatsappLinkCarDocsReady(car) {
  const name = car.client || "";
  const msg = car.financed
    ? `Hola ${name}, te escribimos de Estudio Cavallo para informarte que la documentación de tu vehículo financiado ya llegó y está en trámite. Nos pondremos en contacto para coordinar los próximos pasos. ¡Saludos!`
    : `Hola ${name}, te escribimos de Estudio Cavallo para avisarte que tus documentos ya están prontos. ¡Saludos!`;
  const digits = (car.phone || "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://api.whatsapp.com/send`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

export function whatsappLinkCoordinateSigning(car) {
  const name = car.client || "";
  const msg = `Hola ${name}, te escribimos de Estudio Cavallo. Tu trámite ya está pronto para firmar — ¿nos confirmás qué día y horario te queda cómodo para coordinar la firma? ¡Saludos!`;
  const digits = (car.phone || "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://api.whatsapp.com/send`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

export function whatsappLinkRequestDocumentation(car) {
  const name = car.client || "";
  let msg = `Hola ${name}, te escribimos de Estudio Cavallo. Para avanzar con la compra del auto voy a necesitar:\n\n- Foto de los títulos (si nunca tuvo títulos: factura)\n- Foto de la libreta\n- Cédula del titular registral y del cónyuge en caso de estar casado\n- Si está divorciado, con quién\n- SOA\n- Computest si el auto está empadronado en Montevideo y tiene más de 5 años`;
  msg += `\n\n¡Muchas gracias!`;
  const digits = (car.phone || "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://api.whatsapp.com/send`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

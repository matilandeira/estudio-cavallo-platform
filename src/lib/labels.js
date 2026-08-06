/* Spanish display labels for the English-valued enums defined in constants.js.
   The English values are the source of truth — they're what's stored in
   Supabase and compared throughout businessLogic.js — this module only maps
   them to the Spanish text shown to users. Never used on free-text fields
   (client names, notes, etc.), only on controlled-vocabulary values. */
import { isSimplifiedDocument, normalizeCarStatus } from "./businessLogic.js";
import { isSAS, isScanning, isReconstruction } from "./constants.js";

export const label = (map, value) => (value ? (map[value] ?? value) : value);

export const PRIORITY_LABELS = { Low: "Baja", Medium: "Media", High: "Alta" };

export const CASE_TYPE_LABELS = {
  Sale: "Compraventa", "Power of Attorney": "Poder", "Sub-power of Attorney": "Submandato",
  "Trade-in": "Permuta", Other: "Otro",
};

/* Only the 3 statuses a car can be set to going forward — see CAR_STATUSES
   in constants.js and normalizeCarStatus() in businessLogic.js. Look up
   through carStatusLabelEs(car) below rather than this map directly if the
   car might still have one of the retired statuses stored (older rows). */
export const CAR_STATUS_LABELS = {
  Pending: "Pendiente", "Ready to Sign": "Pronto para firma", Completed: "Finalizado",
};

export const STATUS_LABELS = {
  Pending: "Pendiente", "In Progress": "En trámite", "On Hold": "En espera",
  "For Review": "Para revisión", Completed: "Finalizado",
};

export const DOCUMENT_TYPE_LABELS = {
  "Certified Copy": "Testimonio", "Notarial Certificate": "Certificado notarial", "Signature Certification": "Certificación de firmas",
  "General Power of Attorney": "Poder general", "Special Power of Attorney": "Poder especial", "Notarial Deed": "Acta notarial",
  "Payment Receipt": "Carta de pago", "Sub-power of Attorney": "Submandato", "Estate Probate": "Sucesiones", SAS: "SAS",
  "Document Scanning": "Escaneo de documentación", "Document Reconstruction": "Reconstrucción de documentación", Other: "Otro",
};

export const PROBATE_STATUS_LABELS = {
  "Gathering Information": "Recolectando información", "First Filing Ready": "Primer escrito pronto",
  "First Filing Submitted": "Primer escrito presentado", Publications: "Publicaciones",
  "Second Filing Submitted": "Segundo escrito presentado", CRA: "CRA", Registration: "Inscripción",
};

export const POA_STATUS_LABELS = {
  "Gathering Data": "Recolectando datos", "Document Ready": "Documento pronto", Signed: "Firmado",
  Delivered: "Entregado", Paid: "Cobrado",
};

export const SCAN_STATUS_LABELS = { Pending: "Pendiente", Completed: "Finalizado" };

export const RECONSTRUCTION_STATUS_LABELS = {
  Pending: "Pendiente", "Requested from Registry": "Pedido al registro", Ready: "Pronto", Paid: "Cobrado",
};

export const SAS_STATUS_LABELS = {
  "Missing Documentation": "Falta documentación", "Name Reservation": "Reserva de nombre",
  "Registry Filing": "Ingreso al registro", RUT: "RUT", Final: "Definitiva",
};

export const PROPERTY_TYPE_LABELS = { Urban: "Urbano", Rural: "Rural" };

export const PROPERTY_STAGE_LABELS = {
  "Preparing Agreement": "Preparar boleto", "Agreement Approved": "Boleto aprobado", "Ready to Sign": "Pronto para firma",
  "Agreement Signed": "Boleto firmado", "Promise of Sale": "Promesa", "Sale Deed": "Compraventa",
  Registering: "Inscribiéndose", "Documentation Received": "Llegó la documentación", Completed: "Finalizado",
};

export const NEXT_ACTION_OWNER_LABELS = {
  Nicolás: "Nicolás", Dahiana: "Dahiana", Alex: "Alex", Andrea: "Andrea", Belén: "Belén",
  Client: "Cliente", Registry: "Registro", Cadastre: "Catastro", DGI: "DGI",
  Municipality: "Intendencia", Bank: "Banco", "Other Notary Office": "Otra escribanía", Other: "Otro",
};

export const FLAG_STATUS_LABELS = {
  Resolving: "Solucionando", "Objection Filed": "Observación presentada", "Objection Nearly Resolved": "Observación pronta",
  "Objection Cleared": "Observación levantada", Completed: "Finalizado",
};

export const SECTOR_LABELS = { Vehicles: "Automotores", Documents: "Documentos" };

/* Tri-state (not_requested/requested/ok) labels live directly on TRI_STATES in
   constants.js instead of here, since that field is never stored — only `key` is. */

export const ORIGIN_LABELS = { Car: "Auto", Document: "Documento", Property: "Inmueble" };

export const FREQ_LABELS = { daily: "Diaria", weekly: "Semanal", monthly: "Mensual" };

export const LEVEL_LABELS = { Gold: "Oro", Silver: "Plata", Bronze: "Bronce" };

/* Spanish status label for a car — normalizes first (see
   normalizeCarStatus() in businessLogic.js) so an older row still carrying
   one of the 5 retired statuses displays as one of the 3 current ones
   instead of falling back to raw, untranslated English text. */
export function carStatusLabelEs(car) {
  return label(CAR_STATUS_LABELS, normalizeCarStatus(car.status));
}

/* Status label for a document, honoring whichever specific status field
   applies to its type — mirrors businessLogic.documentStatusLabel() but
   returns the Spanish text instead of the raw English value. */
export function documentStatusLabelEs(doc) {
  if (isSimplifiedDocument(doc.document_type)) return label(POA_STATUS_LABELS, doc.power_of_attorney_status);
  if (doc.document_type === "Estate Probate") return label(PROBATE_STATUS_LABELS, doc.probate_status);
  if (isSAS(doc.document_type)) return label(SAS_STATUS_LABELS, doc.sas_status);
  if (isScanning(doc.document_type)) return label(SCAN_STATUS_LABELS, doc.scan_status);
  if (isReconstruction(doc.document_type)) return label(RECONSTRUCTION_STATUS_LABELS, doc.reconstruction_status);
  return label(STATUS_LABELS, doc.status);
}

/* Best-effort label for a status value when the originating domain (car vs.
   document vs. property) isn't known at the call site — e.g. a flat, deduped
   list of every status value in play across the whole office, as used by the
   "All work" status filter. Checked in this priority order; the only real
   ambiguity is "In Progress", which is "Trabajando en él" for cars but "En
   trámite" everywhere else — this defaults to the "everywhere else" reading. */
const STATUS_LABEL_FALLBACK_CHAIN = [
  STATUS_LABELS, CAR_STATUS_LABELS, POA_STATUS_LABELS, PROBATE_STATUS_LABELS,
  SAS_STATUS_LABELS, SCAN_STATUS_LABELS, RECONSTRUCTION_STATUS_LABELS, FLAG_STATUS_LABELS,
];
export function bestEffortStatusLabel(value) {
  for (const map of STATUS_LABEL_FALLBACK_CHAIN) {
    if (value in map) return map[value];
  }
  return value;
}

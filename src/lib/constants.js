import { Car, Home, FileText, ClipboardList } from "lucide-react";
import { C } from "./theme.jsx";

/* ============================== STAFF & PRIORITY ============================== */
export const STAFF = ["Nicolás", "Dahiana", "Alex", "Andrea", "Belén"];
export const PRIORITIES = ["Low", "Medium", "High"];
export const PRIORITY_COLOR = { Low: C.muted, Medium: "#8A6A1E", High: C.wax };
export const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2, "": 3 };
export const byPriority = (a, b) => PRIORITY_RANK[a.priority || ""] - PRIORITY_RANK[b.priority || ""];

/* ============================== CARS ============================== */
export const CAR_CASE_TYPES = ["Sale", "Power of Attorney", "Sub-power of Attorney", "Trade-in", "Other"];
export const CAR_STATUSES = ["Pending", "In Progress", "Returned from Registry", "Ready to Sign", "Ready to Notarize", "Notarized", "Registering", "Completed"];

/* ============================== DOCUMENTS ============================== */
export const DOCUMENT_TYPES = [
  "Certified Copy", "Notarial Certificate", "Signature Certification", "General Power of Attorney",
  "Special Power of Attorney", "Notarial Deed", "Payment Receipt", "Sub-power of Attorney",
  "Estate Probate", "SAS", "Document Scanning", "Document Reconstruction", "Other",
];
export const PROBATE_STATUSES = ["Gathering Information", "First Filing Ready", "First Filing Submitted", "Publications", "Second Filing Submitted", "CRA", "Registration"];
export const CERTIFIED_COPY_STATUSES = ["Ready", "Awaiting Client Signature", "Delivered", "Paid"]; // reserved for future use
export const SCAN_STATUSES = ["Pending", "Completed"];
export const POWER_OF_ATTORNEY_STATUSES = ["Gathering Data", "Document Ready", "Signed", "Delivered", "Paid"];
export const SAS_STATUSES = ["Missing Documentation", "Name Reservation", "Registry Filing", "RUT", "Final"];
export const RECONSTRUCTION_STATUSES = ["Pending", "Requested from Registry", "Ready", "Paid"];
export const STATUSES = ["Pending", "In Progress", "On Hold", "For Review", "Completed"];

export const isPowerOfAttorneyLike = (type) => type === "Certified Copy" || type === "Notarial Certificate" || type === "Payment Receipt" || type === "Notarial Deed";
export const isScanning = (type) => type === "Document Scanning";
export const isReconstruction = (type) => type === "Document Reconstruction";
export const isPowerOfAttorney = (type) => type === "General Power of Attorney" || type === "Special Power of Attorney" || type === "Sub-power of Attorney";
export const isSAS = (type) => type === "SAS";
export const hidesGeneralFields = (type) => isPowerOfAttorneyLike(type) || isScanning(type) || isPowerOfAttorney(type) || isSAS(type) || isReconstruction(type);
export const isSpecialType = (type) => hidesGeneralFields(type) || type === "Estate Probate";
/* "Simplified" documents share the same status field (power_of_attorney_status): Certified Copy, Notarial Certificate, Payment Receipt, Notarial Deed, General/Special Power of Attorney, Sub-power of Attorney */
export const isSimplified = (type) => isPowerOfAttorneyLike(type) || isPowerOfAttorney(type);

/* ============================== PROPERTIES ============================== */
export const PROPERTY_TYPES = ["Urban", "Rural"];
export const PROPERTY_STAGES = ["Preparing Agreement", "Agreement Approved", "Ready to Sign", "Agreement Signed", "Promise of Sale", "Sale Deed", "Registering", "Documentation Received", "Completed"];
export const PROPERTY_STAGES_EARLY = ["Preparing Agreement", "Agreement Approved", "Ready to Sign", "Agreement Signed", "Promise of Sale", "Sale Deed"];

/* ============================== SHARED "NEXT ACTION OWNER" LIST ============================== */
export const NEXT_ACTION_OWNERS = ["Nicolás", "Dahiana", "Alex", "Andrea", "Belén", "Client", "Registry", "Cadastre", "DGI", "Municipality", "Bank", "Other Notary Office", "Other"];

/* ============================== FLAGGED DOCUMENTS (registry objections) ============================== */
export const FLAG_STATUSES = ["Resolving", "Objection Filed", "Objection Nearly Resolved", "Objection Cleared", "Completed"];
export const SECTORS = ["Vehicles", "Documents"];

/* ============================== TRI-STATE STATUS (not requested -> requested -> ok) ==============================
   `key` is stored in the database (lien_status, seizure_status, etc.) and must stay English;
   `label` is pure display text, kept in Spanish directly. */
export const TRI_STATES = [
  { key: "not_requested", label: "No pedido", color: "#B33A3A" },
  { key: "requested", label: "Pedido", color: "#C99A2E" },
  { key: "ok", label: "Llegó / OK", color: "#2C6B45" },
];

/* ============================== SCORING (Operational Excellence) ============================== */
const scaleScore = (value, tiers) => {
  let pts = 0;
  for (const [th, p] of tiers) if (value >= th) pts = p;
  return pts;
};
export const TIERS_NOTARIZATIONS = [[90, 20], [100, 30], [110, 40], [120, 50]];
export const TIERS_REVIEWS = [[5, 5], [10, 10]];
export const TIERS_CERTIFICATES = [[15, 5], [20, 10], [25, 15]];
/* Level names are pure display text (never stored or compared anywhere), so
   they're kept in Spanish directly rather than routed through src/lib/labels.js. */
export const LEVELS = [
  { name: "Oro", min: 160, bonus: "20%", color: C.brass },
  { name: "Plata", min: 140, bonus: "15%", color: "#8A93A0" },
  { name: "Bronce", min: 100, bonus: "10%", color: "#A9713F" },
];

export function computeScore(totals) {
  const propertiesPts = (totals.properties || 0) * 15;
  const notarizationsPts = scaleScore(totals.notarizations || 0, TIERS_NOTARIZATIONS);
  const probatesPts = (totals.probates || 0) * 5;
  const reviewsPts = scaleScore(totals.reviews || 0, TIERS_REVIEWS);
  const certificatesPts = scaleScore(totals.certificates || 0, TIERS_CERTIFICATES);
  const pctFlagged = totals.salesChecked > 0 ? (totals.salesFlagged / totals.salesChecked) * 100 : null;
  let qualityPts = 0, qualityPenalty = 0;
  if (pctFlagged !== null) {
    if (pctFlagged <= 5) qualityPts = 10;
    else if (pctFlagged <= 10) qualityPts = 5;
    else if (pctFlagged < 15) qualityPts = 0;
    if (pctFlagged >= 15) qualityPenalty = -10;
  }
  const negativeReviewsPenalty = (totals.negativeReviews || 0) * -10;
  const flaggedCertificatesPenalty = (totals.flaggedCertificates || 0) * -5;
  const total = propertiesPts + notarizationsPts + probatesPts + reviewsPts + certificatesPts + qualityPts + qualityPenalty + negativeReviewsPenalty + flaggedCertificatesPenalty;
  const level = LEVELS.find((n) => total >= n.min) || null;
  return { propertiesPts, notarizationsPts, probatesPts, reviewsPts, certificatesPts, qualityPts, qualityPenalty, negativeReviewsPenalty, flaggedCertificatesPenalty, pctFlagged, total, level };
}

/* ============================== RECURRING ADMIN TASKS (from the office manual) ==============================
   Titles are pure display text (never stored or compared anywhere), so they're kept in
   Spanish directly; `id` and `freq` are real identifiers (DB keys / switch values) and stay English. */
export const RECURRING_TASKS = [
  { id: "r1", title: "Control de planilla y levantamiento de observaciones (títulos en el registro)", freq: "weekly", assignees: ["Andrea"] },
  { id: "r2", title: "Re-control mensual de planilla — títulos en el registro uno por uno", freq: "monthly", assignees: ["Belén"] },
  { id: "r3", title: "Compras de insumos (oficina, cocina, baño)", freq: "weekly", assignees: ["Todos"] },
  { id: "r4", title: "Contar y cargar montepíos y contadores", freq: "monthly", assignees: ["Belén"] },
  { id: "r5", title: "Avisar por WhatsApp títulos ingresados y prontos", freq: "weekly", assignees: ["Belén"] },
  { id: "r6", title: "Cargar Excel de títulos en trámite/registro: completar Número de ingreso y PIN por padrón, y cotejar autos protocolizados y compraventas observadas", freq: "weekly", assignees: ["Andrea"] },
];

/* ============================== MANUAL (procedures reference) ==============================
   Same rationale as above: titles/steps are pure display text, kept in Spanish directly. */
export const PROCEDURES = [
  {
    id: "cars", title: "Automotores", icon: Car, steps: [
      "Solicitar: foto de títulos (o factura si nunca tuvo), foto de libreta, cédula del titular registral y cónyuge si está casado, si está divorciado con quién, SOA, Computest (Montevideo, +5 años). Personas jurídicas además: CUD, BPS, certificado notarial de constitución, administración, inscripción en DGI y comunicación al BCU. Se puede enviar el pedido por WhatsApp con el botón del sistema (estado 'Pendiente').",
      "Armar sobre y hacer estudio de títulos por 6 años: estado civil del vendedor, tracto sucesivo, carta de pago, cláusula de lectura y ratificación, fechas, cartas poder completas. Pasar el auto a 'Trabajando en él'.",
      "Consultar deuda sucive (más convenio), pedir libre de prenda y libre de embargo (semáforo: rojo=no pedido, amarillo=pedido, verde=llegó/OK). Ídem Cert. Sucive y Matrículas requeridas.",
      "Cuando llega la documentación desde el registro, pasar el auto a 'Llegó del registro' — el sistema habilita un botón de WhatsApp para avisar (mensaje distinto si es financiado). Este estado ya cuenta como finalizado para Excelencia Operativa.",
      "Elaborar documento y marcar 'Doc. elaborado' y 'Cobrado' en verde cuando corresponda. Con los 7 semáforos en verde, el auto pasa solo a 'Pronto para firma' y aparece en 'Documentos prontos para agendar' en Inicio.",
      "Coordinar la firma (botón de WhatsApp disponible en 'Pronto para firma'), pasar a 'Para protocolizar' y protocolizar.",
      "Solo compraventas se inscriben en el registro: al pasar a 'Inscribiéndose', cargar Número de ingreso y PIN (se copian del Excel de títulos en trámite) — esto suma a Excelencia Operativa en Protocolizaciones.",
      "Cerrar el trámite en estado 'Protocolizado' o 'Finalizado' según corresponda. Los poderes de auto (tipo Poder) también sirven con el semáforo 'Cobrado' en verde, sin pasar por el registro.",
      "Controles finales en títulos: última procedencia, primera inscripción (sucive + libreta autenticada), divorcio/separación de bienes, SOA, cambio de padrón, BPS, personería jurídica, poderes, voto.",
    ],
  },
  {
    id: "properties", title: "Inmuebles — Boleto de reserva", icon: Home, steps: [
      "Elegir tipo Urbano o Rural al crear el inmueble. Pedir: cédulas, títulos por 30 años, recibo de OSE, contribución, primaria al día, primera copia, pago de impuestos.",
      "Si es PH: seguro, libre de gastos comunes, OSE. Si es Rural, además: ofrecimiento, art. 358, colonización, minería.",
      "Avanzar por las etapas: Preparar boleto → Boleto aprobado → Boleto firmado → Promesa → Compraventa.",
      "Al pasar a 'Inscribiéndose' se habilitan Número de ingreso y PIN (se copian del Excel de títulos en trámite); con Primera copia + Pago de impuestos tildados, o al llegar a esta etapa, ya suma a Excelencia Operativa en Inmuebles.",
      "Luego 'Llegó la documentación' y finalmente 'Finalizado' para cerrar el trámite.",
      "Certificado de Inscripción (semáforo aparte): Actos personales, Certificado de propiedad y Certificado de comercio o prenda quedan en el checklist simple; Inscripción tiene su propio semáforo de 3 colores.",
    ],
  },
  {
    id: "notarial-certificates", title: "Certificados notariales", icon: FileText, steps: [
      "ANDA.", "Contaduría.", "Poderes en general.",
    ],
  },
  {
    id: "filing", title: "Gestoría", icon: ClipboardList, steps: [
      "Ingreso y retiro de documentos en registro (Centro, saneamiento, partidas, retiro PNA, Azpitarte, Multicolor).",
      "Pagar tasas y anotar número de PIN en planilla.",
      "Al llegar un documento: avisar por WhatsApp (ojo financiados) y anotar en planilla.",
      "Al entregar: pedir confirmación por WhatsApp del cliente, o enviarla nosotros.",
      "Financiados que piden documento para salir del país o en trámite de inscripción: certificado notarial de propietario (cobrar $3.000).",
    ],
  },
];

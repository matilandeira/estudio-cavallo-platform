import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Stamp, Plus, X, Search, ChevronDown, ChevronRight, BookOpen,
  ClipboardList, Trash2, Loader2, Car, FileText, Home, LayoutDashboard,
  CheckCircle2, Circle, AlertTriangle, Filter, Download, Bell,
} from "lucide-react";

/* ============================== DESIGN TOKENS ==============================
   Notarial ledger aesthetic: ink, aged paper, wax-seal red, brass.
   Display: Source Serif 4 · Body: IBM Plex Sans · Data: IBM Plex Mono
================================================================================ */
const C = {
  ink: "#1E2A24",
  paper: "#EFE9D8",
  paper2: "#E4DCC4",
  paper3: "#F8F5EC",
  wax: "#7E2A34",
  waxDark: "#5E1F27",
  brass: "#A9813F",
  brassLight: "#C7A468",
  bottle: "#2C4A3B",
  line: "#C9BE9E",
  muted: "#6B7268",
  white: "#FBF9F2",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');`;

/* ============================== CONFIG (from Configuración) ============================== */
const RESPONSABLES = ["Nicolás", "Dahiana", "Alex", "Andrea", "Belén"];
const PRIORIDADES = ["Baja", "Media", "Alta"];
const PRIORIDAD_COLOR = { Baja: C.muted, Media: "#8A6A1E", Alta: C.wax };
const PRIORIDAD_RANK = { Alta: 0, Media: 1, Baja: 2, "": 3 };
const porPrioridad = (a, b) => PRIORIDAD_RANK[a.prioridad || ""] - PRIORIDAD_RANK[b.prioridad || ""];
const TIPOS_AUTO = ["Compraventa", "Poder", "Submandato", "Permuta", "Otro"];
const SEDES_REGISTRO = ["Montevideo", "Canelones", "Maldonado", "Colonia", "San José", "Florida", "Lavalleja", "Rocha", "Treinta y Tres", "Cerro Largo", "Durazno", "Flores", "Soriano", "Río Negro", "Paysandú", "Salto", "Artigas", "Rivera", "Tacuarembó"];
const ESTADOS_REGISTRO = ["Observado", "Definitivo"];
const TIPOS_DOCUMENTO = ["Testimonio", "Certificado notarial", "Certificación de firmas", "Poder general", "Poder especial", "Acta notarial", "Carta de pago", "Submandato", "Sucesiones", "SAS", "Escaneo de documentación", "Reconstrucción de documentación", "Otro"];
const ESTADOS_SUCESION = ["Recolectando información", "Primer escrito pronto", "Primer escrito presentado", "Publicaciones", "Segundo escrito presentado", "CRA", "Inscripción"];
const ESTADOS_TESTIMONIO = ["Pronto", "Falta firma de cliente", "Entregado", "Cobrado"];
const ESTADOS_ESCANEO = ["Pendiente", "Finalizado"];
const ESTADOS_PODER = ["Recolectando datos", "Documento pronto", "Firmado", "Entregado", "Cobrado"];
const ESTADOS_SAS = ["Falta documentación", "Reserva de nombre", "Ingreso al registro", "RUT", "Definitiva"];
const ESTADOS_RECONSTRUCCION = ["Pendiente", "Pedido al registro", "Pronto", "Cobrado"];
const isTestimonioLike = (tipo) => tipo === "Testimonio" || tipo === "Certificado notarial" || tipo === "Carta de pago" || tipo === "Acta notarial";
const isEscaneo = (tipo) => tipo === "Escaneo de documentación";
const isReconstruccion = (tipo) => tipo === "Reconstrucción de documentación";
const isPoder = (tipo) => tipo === "Poder general" || tipo === "Poder especial" || tipo === "Submandato";
const isSAS = (tipo) => tipo === "SAS";
const hideGeneralFields = (tipo) => isTestimonioLike(tipo) || isEscaneo(tipo) || isPoder(tipo) || isSAS(tipo) || isReconstruccion(tipo);
const isSpecialType = (tipo) => hideGeneralFields(tipo) || tipo === "Sucesiones";
const ESTADOS = ["Pendiente", "En trámite", "En espera", "Para revisión", "Finalizado"];
const ESTADOS_AUTO = ["Pendiente", "Trabajando en él", "Llegó del registro", "Pronto para firma", "Para protocolizar", "Protocolizado", "Inscribiéndose", "Finalizado"];

/* ---- Excelencia Operativa: cuándo se considera "finalizado" cada tipo, y a qué categoría suma ---- */
const isCompletedAuto = (a) => {
  if (a.estado === "Protocolizado" || a.estado === "Finalizado" || a.estado === "Llegó del registro") return true;
  if (a.estado === "Inscribiéndose" && a.numeroIngreso && a.pin) return true; // se copia del Excel del registro
  if ((a.tipo === "Poder" || a.tipo === "Submandato") && a.cobrado === "ok") return true; // poderes y submandatos de autos: también cuenta si está cobrado
  return false;
};
const isCompletedInmueble = (i) => i.etapa === "Finalizado" || i.etapa === "Inscribiéndose" || (i.primeraCopia === true && i.impuestos === true);
const isSimplified = (tipo) => isTestimonioLike(tipo) || isPoder(tipo); // Testimonio, Cert. notarial, Carta de pago, Acta notarial, Poder general/especial, Submandato
const isCompletedDocumento = (d) => {
  if (isSimplified(d.tipoDocumento)) return d.estadoPoder === "Cobrado";
  if (d.tipoDocumento === "Sucesiones") return d.estadoSucesion === "Inscripción";
  if (isSAS(d.tipoDocumento)) return d.estadoSAS === "Definitiva" || d.estadoSAS === "Ingreso al registro";
  if (isEscaneo(d.tipoDocumento)) return d.estadoEscaneo === "Finalizado";
  if (isReconstruccion(d.tipoDocumento)) return d.estadoReconstruccion === "Cobrado";
  return d.estado === "Finalizado";
};
/* "Pendiente" equivalente de cada tipo, para saber cuándo mostrar el recordatorio */
const isPendingLike = (d) => {
  if (isSimplified(d.tipoDocumento)) return d.estadoPoder === ESTADOS_PODER[0];
  if (d.tipoDocumento === "Sucesiones") return d.estadoSucesion === ESTADOS_SUCESION[0];
  if (isSAS(d.tipoDocumento)) return d.estadoSAS === ESTADOS_SAS[0];
  if (isEscaneo(d.tipoDocumento)) return d.estadoEscaneo === ESTADOS_ESCANEO[0];
  if (isReconstruccion(d.tipoDocumento)) return d.estadoReconstruccion === ESTADOS_RECONSTRUCCION[0];
  return d.estado === "Pendiente";
};
/* Categoría de Excelencia Operativa a la que suma un documento finalizado */
const scoreCategoryForDocumento = (d) => {
  if (["Certificado notarial", "Testimonio", "Submandato", "Poder especial"].includes(d.tipoDocumento)) return "certificados";
  if (["Poder general", "SAS", "Acta notarial", "Sucesiones"].includes(d.tipoDocumento)) return "sucesiones";
  return null; // Carta de pago, Escaneo, Certificación de firmas, Otro: no suman puntaje
};
/* Estado vigente de un documento, sea cual sea su campo específico según el tipo */
const documentoEstadoLabel = (d) => {
  if (isSimplified(d.tipoDocumento)) return d.estadoPoder;
  if (d.tipoDocumento === "Sucesiones") return d.estadoSucesion;
  if (isSAS(d.tipoDocumento)) return d.estadoSAS;
  if (isEscaneo(d.tipoDocumento)) return d.estadoEscaneo;
  if (isReconstruccion(d.tipoDocumento)) return d.estadoReconstruccion;
  return d.estado;
};
/* "Pendiente" o "Trabajando en él" equivalente: las primeras dos etapas del flujo que le corresponda al documento */
const docEarlyStage = (d) => {
  let arr = ESTADOS, val = d.estado;
  if (isSimplified(d.tipoDocumento)) { arr = ESTADOS_PODER; val = d.estadoPoder; }
  else if (d.tipoDocumento === "Sucesiones") { arr = ESTADOS_SUCESION; val = d.estadoSucesion; }
  else if (isSAS(d.tipoDocumento)) { arr = ESTADOS_SAS; val = d.estadoSAS; }
  else if (isEscaneo(d.tipoDocumento)) { arr = ESTADOS_ESCANEO; val = d.estadoEscaneo; }
  else if (isReconstruccion(d.tipoDocumento)) { arr = ESTADOS_RECONSTRUCCION; val = d.estadoReconstruccion; }
  const idx = arr.indexOf(val);
  return idx === 0 || idx === 1;
};
const autoEarlyStage = (a) => a.estado === "Pendiente" || a.estado === "Trabajando en él";
const ETAPAS_INMUEBLE = ["Preparar boleto", "Boleto aprobado", "Pronto para firma", "Boleto firmado", "Promesa", "Compraventa", "Inscribiéndose", "Llegó la documentación", "Finalizado"];
const ETAPAS_INMUEBLE_TEMPRANAS = ["Preparar boleto", "Boleto aprobado", "Pronto para firma", "Boleto firmado", "Promesa", "Compraventa"];
const TIPOS_INMUEBLE = ["Urbano", "Rural"];
const QUIEN_PELOTA = ["Nicolás", "Dahiana", "Alex", "Andrea", "Belén", "Cliente", "Registro", "Catastro", "DGI", "Intendencia", "Banco", "Otra escribanía", "Otro"];

/* Link de WhatsApp con el mensaje ya armado para avisar que llegó la documentación del auto */
function whatsappLinkAutoDocs(a) {
  const nombre = a.cliente || "";
  const msg = a.financiado
    ? `Hola ${nombre}, te escribimos de Estudio Cavallo para informarte que la documentación de tu vehículo financiado ya llegó y está en trámite. Nos pondremos en contacto para coordinar los próximos pasos. ¡Saludos!`
    : `Hola ${nombre}, te escribimos de Estudio Cavallo para avisarte que tus documentos ya están prontos. ¡Saludos!`;
  const digits = (a.telefono || "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://api.whatsapp.com/send`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

/* Link de WhatsApp para coordinar la firma cuando el auto está pronto para firma */
function whatsappLinkCoordinarFirma(a) {
  const nombre = a.cliente || "";
  const msg = `Hola ${nombre}, te escribimos de Estudio Cavallo. Tu trámite ya está pronto para firmar — ¿nos confirmás qué día y horario te queda cómodo para coordinar la firma? ¡Saludos!`;
  const digits = (a.telefono || "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://api.whatsapp.com/send`;
  return `${base}?text=${encodeURIComponent(msg)}`;
}

/* Link de WhatsApp con el pedido de documentación inicial para un trámite de auto */
function whatsappLinkSolicitarDocumentacion(a) {
  const nombre = a.cliente || "";
  let msg = `Hola ${nombre}, te escribimos de Estudio Cavallo. Para avanzar con la compra del auto voy a necesitar:\n\n- Foto de los títulos (si nunca tuvo títulos: factura)\n- Foto de la libreta\n- Cédula del titular registral y del cónyuge en caso de estar casado\n- Si está divorciado, con quién\n- SOA\n- Computest si el auto está empadronado en Montevideo y tiene más de 5 años`;
  msg += `\n\n¡Muchas gracias!`;
  const digits2 = (a.telefono || "").replace(/\D/g, "");
  const base2 = digits2 ? `https://wa.me/${digits2}` : `https://api.whatsapp.com/send`;
  return `${base2}?text=${encodeURIComponent(msg)}`;
}

/* ============================== SCORING RULES (Excelencia Operativa) ============================== */
const scaleScore = (value, tiers) => {
  let pts = 0;
  for (const [th, p] of tiers) if (value >= th) pts = p;
  return pts;
};
const TIERS_PROTOCOLIZACIONES = [[90, 20], [100, 30], [110, 40], [120, 50]];
const TIERS_RESENAS = [[5, 5], [10, 10]];
const TIERS_CERTIFICADOS = [[15, 5], [20, 10], [25, 15]];
const NIVELES = [
  { name: "Oro", min: 160, bono: "20%", color: C.brass },
  { name: "Plata", min: 140, bono: "15%", color: "#8A93A0" },
  { name: "Bronce", min: 100, bono: "10%", color: "#A9713F" },
];

function computeScore(totals) {
  const inmueblesPts = (totals.inmuebles || 0) * 15;
  const protocolizacionesPts = scaleScore(totals.protocolizaciones || 0, TIERS_PROTOCOLIZACIONES);
  const sucesionesPts = (totals.sucesiones || 0) * 5;
  const resenasPts = scaleScore(totals.resenas || 0, TIERS_RESENAS);
  const certificadosPts = scaleScore(totals.certificados || 0, TIERS_CERTIFICADOS);
  const pctObs = totals.docsControlados > 0 ? (totals.docsObservados / totals.docsControlados) * 100 : null;
  let calidadPts = 0, calidadPenalty = 0;
  if (pctObs !== null) {
    if (pctObs <= 5) calidadPts = 10;
    else if (pctObs <= 10) calidadPts = 5;
    else if (pctObs < 15) calidadPts = 0;
    if (pctObs >= 15) calidadPenalty = -10;
  }
  const resenasNegPenalty = (totals.resenasNegativas || 0) * -10;
  const certObsPenalty = (totals.certObservados || 0) * -5;
  const total = inmueblesPts + protocolizacionesPts + sucesionesPts + resenasPts + certificadosPts + calidadPts + calidadPenalty + resenasNegPenalty + certObsPenalty;
  const nivel = NIVELES.find((n) => total >= n.min) || null;
  return { inmueblesPts, protocolizacionesPts, sucesionesPts, resenasPts, certificadosPts, calidadPts, calidadPenalty, resenasNegPenalty, certObsPenalty, pctObs, total, nivel };
}

/* Suma automática de inmuebles, autos y documentos finalizados, agrupados por categoría de puntaje, para un mes (YYYY-MM) */
function computeAutoTotals(autos, documentos, inmuebles, observados, ym) {
  const t = { inmuebles: 0, protocolizaciones: 0, sucesiones: 0, certificados: 0, docsControlados: 0, docsObservados: 0, certObservados: 0 };
  inmuebles.forEach((i) => { if (isCompletedInmueble(i) && i.fechaFinalizado?.slice(0, 7) === ym) t.inmuebles += 1; });
  autos.forEach((a) => {
    if (isCompletedAuto(a) && a.fechaFinalizado?.slice(0, 7) === ym) t.protocolizaciones += (a.tipo === "Permuta" ? 2 : 1);
    if ((a.tipo === "Compraventa" || a.tipo === "Permuta") && a.fecha?.slice(0, 7) === ym) t.docsControlados += 1;
  });
  documentos.forEach((d) => {
    if (!isCompletedDocumento(d) || d.fechaFinalizado?.slice(0, 7) !== ym) return;
    const cat = scoreCategoryForDocumento(d);
    if (cat) t[cat] += 1;
  });
  (observados || []).forEach((o) => {
    if (!o.fecha || o.fecha.slice(0, 7) > ym) return;
    if (o.resuelto && o.fechaResuelto && o.fechaResuelto.slice(0, 7) < ym) return; // ya resuelto antes de este mes: queda el registro histórico pero no sigue penalizando
    if (o.sector === "Documentos") t.certObservados += 1;
    else t.docsObservados += 1;
  });
  return t;
}

/* Porcentaje de compraventas observadas sobre el total de compraventas del mes */
function pctCompraventasObservadas(totals) {
  return totals.docsControlados > 0 ? (totals.docsObservados / totals.docsControlados) * 100 : null;
}
/* Meses transcurridos desde una fecha (aprox., por mes calendario) */
function mesesTranscurridos(fecha) {
  if (!fecha) return 0;
  const d = new Date(fecha + "T00:00:00");
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

/* ============================== RECURRING ADMIN TASKS (from manual) ============================== */
const RECURRING_TASKS = [
  { id: "r1", title: "Control de planilla y levantamiento de observaciones (títulos en el registro)", freq: "semanal", assignees: ["Andrea"] },
  { id: "r2", title: "Re-control mensual de planilla — títulos en el registro uno por uno", freq: "mensual", assignees: ["Belén"] },
  { id: "r3", title: "Compras de insumos (oficina, cocina, baño)", freq: "semanal", assignees: ["Todos"] },
  { id: "r4", title: "Contar y cargar montepíos y contadores", freq: "mensual", assignees: ["Belén"] },
  { id: "r5", title: "Avisar por WhatsApp títulos ingresados y prontos", freq: "semanal", assignees: ["Belén"] },
  { id: "r6", title: "Cargar Excel de títulos en trámite/registro: completar Número de ingreso y PIN por padrón, y cotejar autos protocolizados y compraventas observadas", freq: "semanal", assignees: ["Andrea"] },
];

/* ============================== MANUAL (procedures reference) ============================== */
const PROCEDURES = [
  {
    id: "automotores", title: "Automotores", icon: Car, steps: [
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
    id: "inmuebles", title: "Inmuebles — Boleto de reserva", icon: Home, steps: [
      "Elegir tipo Urbano o Rural al crear el inmueble. Pedir: cédulas, títulos por 30 años, recibo de OSE, contribución, primaria al día, primera copia, pago de impuestos.",
      "Si es PH: seguro, libre de gastos comunes, OSE. Si es Rural, además: ofrecimiento, art. 358, colonización, minería.",
      "Avanzar por las etapas: Preparar boleto → Boleto aprobado → Boleto firmado → Promesa → Compraventa.",
      "Al pasar a 'Inscribiéndose' se habilitan Número de ingreso y PIN (se copian del Excel de títulos en trámite); con Primera copia + Pago de impuestos tildados, o al llegar a esta etapa, ya suma a Excelencia Operativa en Inmuebles.",
      "Luego 'Llegó la documentación' y finalmente 'Finalizado' para cerrar el trámite.",
      "Certificado de Inscripción (semáforo aparte): Actos personales, Certificado de propiedad y Certificado de comercio o prenda quedan en el checklist simple; Inscripción tiene su propio semáforo de 3 colores.",
    ],
  },
  {
    id: "certificados", title: "Certificados notariales", icon: FileText, steps: [
      "ANDA.", "Contaduría.", "Poderes en general.",
    ],
  },
  {
    id: "gestoria", title: "Gestoría", icon: ClipboardList, steps: [
      "Ingreso y retiro de documentos en registro (Centro, saneamiento, partidas, retiro PNA, Azpitarte, Multicolor).",
      "Pagar tasas y anotar número de PIN en planilla.",
      "Al llegar un documento: avisar por WhatsApp (ojo financiados) y anotar en planilla.",
      "Al entregar: pedir confirmación por WhatsApp del cliente, o enviarla nosotros.",
      "Financiados que piden documento para salir del país o en trámite de inscripción: certificado notarial de propietario (cobrar $3.000).",
    ],
  },
];

/* ============================== STORAGE HOOK ============================== */
/* Guarda en localStorage del navegador. Para compartir datos en tiempo real entre
   varias personas/dispositivos, reemplazar esta funcion por llamadas a tu propio
   backend (API REST, Firebase, Supabase, etc.) manteniendo la misma firma:
   [items, persist(next), loaded] */
function useSharedList(key, seed = []) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : seed;
    } catch (e) { return seed; }
  });

  const persist = useCallback((next) => {
    setItems(next);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch (e) { console.error("storage set failed", key, e); }
  }, [key]);

  return [items, persist, true];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const startOfWeekISO = () => {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/* ============================== SHARED UI BITS ============================== */
function StyleSheet() {
  return (
    <style>{`
      ${FONT_IMPORT}
      .ec-root, .ec-root * { box-sizing: border-box; }
      .ec-root { font-family: 'IBM Plex Sans', sans-serif; color: ${C.ink}; }
      .ec-serif { font-family: 'Source Serif 4', serif; }
      .ec-mono { font-family: 'IBM Plex Mono', monospace; }
      .ec-btn { cursor:pointer; border:1px solid ${C.ink}; background:${C.ink}; color:${C.white};
                 padding:8px 14px; font-size:13px; font-weight:600; letter-spacing:.02em; border-radius:3px;
                 display:inline-flex; align-items:center; gap:6px; transition:all .15s; }
      .ec-btn:hover { background:${C.wax}; border-color:${C.wax}; }
      .ec-btn-ghost { cursor:pointer; border:1px solid ${C.line}; background:transparent; color:${C.ink};
                 padding:7px 12px; font-size:13px; font-weight:500; border-radius:3px; display:inline-flex; align-items:center; gap:6px; }
      .ec-btn-ghost:hover { border-color:${C.wax}; color:${C.wax}; }
      .ec-input, .ec-select { font-family:'IBM Plex Sans',sans-serif; border:1px solid ${C.line}; background:${C.white};
                 padding:7px 9px; font-size:13px; border-radius:3px; color:${C.ink}; width:100%; }
      .ec-input:focus, .ec-select:focus { outline:2px solid ${C.brass}; outline-offset:1px; border-color:${C.brass}; }
      .ec-table { width:100%; border-collapse:collapse; font-size:13px; }
      .ec-table th { text-align:left; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:${C.muted};
                 border-bottom:1.5px solid ${C.ink}; padding:8px 10px; font-weight:600; white-space:nowrap; }
      .ec-table td { padding:8px 10px; border-bottom:1px solid ${C.line}; vertical-align:middle; }
      .ec-table tr:hover td { background:${C.paper3}; }
      .ec-tab { cursor:pointer; padding:10px 18px; font-size:13.5px; font-weight:600; border:none; background:transparent;
                 color:${C.muted}; display:flex; align-items:center; gap:7px; border-bottom:3px solid transparent; }
      .ec-tab.active { color:${C.ink}; border-bottom-color:${C.wax}; }
      .ec-badge { display:inline-flex; align-items:center; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:.01em; white-space:nowrap; }
      .ec-chip { cursor:pointer; border:1px solid ${C.line}; border-radius:20px; padding:4px 11px; font-size:12px; background:${C.white}; }
      .ec-chip.active { background:${C.ink}; color:${C.white}; border-color:${C.ink}; }
      .ec-card { background:${C.white}; border:1px solid ${C.line}; border-radius:6px; }
      .ec-scroll::-webkit-scrollbar{height:8px;width:8px;} .ec-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px;}
      @keyframes ec-fade { from{opacity:0; transform:translateY(4px);} to{opacity:1; transform:translateY(0);} }
      .ec-fade { animation: ec-fade .25s ease; }
      @keyframes ec-spin { to { transform: rotate(360deg); } }
      .ec-spin { animation: ec-spin 1s linear infinite; }
    `}</style>
  );
}

function estadoColor(estado) {
  switch (estado) {
    case "Finalizado": return { bg: "#DCE7DE", fg: C.bottle };
    case "Pendiente": return { bg: "#F0E2C8", fg: "#7A5A1E" };
    case "En trámite": return { bg: "#E4DEEF", fg: "#4B3A73" };
    case "En espera": return { bg: "#F3DDE0", fg: C.wax };
    case "Para revisión": return { bg: "#DCE9EF", fg: "#2C5A6E" };
    default: return { bg: C.paper2, fg: C.muted };
  }
}
function EstadoBadge({ estado }) {
  const { bg, fg } = estadoColor(estado);
  return <span className="ec-badge" style={{ background: bg, color: fg }}>{estado || "—"}</span>;
}

function isOverdue(dateStr, estado) {
  if (!dateStr || estado === "Finalizado") return false;
  return new Date(dateStr) < new Date(todayISO());
}

/* The notarial seal — signature element for the level badge */
function Seal({ nivel, size = 128 }) {
  const label = nivel ? nivel.name.toUpperCase() : "SIN NIVEL";
  const color = nivel ? nivel.color : C.muted;
  const r = size / 2;
  const textId = "seal-arc-" + label;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }}>
      <defs>
        <path id={textId + "-top"} d="M 30,100 A 70,70 0 0 1 170,100" fill="none" />
        <path id={textId + "-bot"} d="M 170,110 A 70,70 0 0 1 30,110" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="100" cy="100" r="82" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 4" />
      <text fontFamily="IBM Plex Mono" fontSize="11" fontWeight="600" letterSpacing="3" fill={color}>
        <textPath href={"#" + textId + "-top"} startOffset="50%" textAnchor="middle">ESTUDIO CAVALLO</textPath>
      </text>
      <text fontFamily="IBM Plex Mono" fontSize="11" fontWeight="600" letterSpacing="3" fill={color}>
        <textPath href={"#" + textId + "-bot"} startOffset="50%" textAnchor="middle">EXCELENCIA · OPERATIVA</textPath>
      </text>
      <text x="100" y="95" textAnchor="middle" fontFamily="Source Serif 4" fontWeight="700" fontSize="26" fill={color}>{label}</text>
      <text x="100" y="118" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="11" fill={color}>
        {nivel ? `bono ${nivel.bono}` : "en construcción"}
      </text>
    </svg>
  );
}

/* Generic inline "add row" panel */
function AddPanel({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="ec-card ec-fade" style={{ padding: 16, marginBottom: 14, borderColor: C.brass, background: C.paper3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        <button className="ec-btn-ghost" onClick={onClose}><X size={14} /> Cerrar</button>
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
function Check({ checked, onChange }) {
  return (
    <button onClick={onChange} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: checked ? C.bottle : C.line }}>
      {checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
    </button>
  );
}

/* Selector de prioridad (Baja/Media/Alta) para trabajos pendientes */
function PrioridadPicker({ value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ color: C.muted }}>Prioridad:</span>
      <select className="ec-select" style={{ width: "auto", color: value ? PRIORIDAD_COLOR[value] : C.muted, fontWeight: value === "Alta" ? 700 : 500 }} value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin definir</option>
        {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
      </select>
    </label>
  );
}

/* Selector de uno o más responsables, como chips tildables */
function ResponsablesPicker({ value, onChange }) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  const toggle = (name) => {
    onChange(list.includes(name) ? list.filter((v) => v !== name) : [...list, name]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {RESPONSABLES.map((name) => (
        <button key={name} type="button" onClick={() => toggle(name)} className={`ec-chip ${list.includes(name) ? "active" : ""}`} style={{ padding: "2px 8px", fontSize: 11 }}>
          {name}
        </button>
      ))}
    </div>
  );
}
/* Texto para mostrar una lista de responsables */
const responsablesLabel = (v) => (Array.isArray(v) ? (v.length ? v.join(", ") : "Sin asignar") : (v || "Sin asignar"));
/* true si el/los responsable(s) de un registro incluyen el nombre elegido en un filtro */
const responsableMatches = (v, name) => (Array.isArray(v) ? v.includes(name) : v === name);

/* 3-state status: no pedido (rojo) -> pedido (amarillo) -> ok (verde). Click to advance. */
const TRI_STATES = [
  { key: "no_pedido", label: "No pedido", color: "#B33A3A" },
  { key: "pedido", label: "Pedido", color: "#C99A2E" },
  { key: "ok", label: "Llegó / OK", color: "#2C6B45" },
];
function TriStatus({ value, onChange }) {
  const idx = Math.max(0, TRI_STATES.findIndex((s) => s.key === value));
  const state = TRI_STATES[idx];
  const advance = () => onChange(TRI_STATES[(idx + 1) % TRI_STATES.length].key);
  return (
    <button onClick={advance} title={`${state.label} — click para cambiar`}
      style={{ width: 17, height: 17, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,.25)", background: state.color, cursor: "pointer", padding: 0 }} />
  );
}
function TriLegend() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 11.5, color: C.muted, marginBottom: 10 }}>
      {TRI_STATES.map((s) => (
        <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} /> {s.label}
        </span>
      ))}
    </div>
  );
}

/* ============================== TAB: INICIO ============================== */
function Inicio({ autos, documentos, inmuebles, excelLog, agenda, setAgenda, prontos, setProntos, proximosFirmar, setProximosFirmar, observados, setObservados, setTab, setTrabajosInitialFilters }) {
  const today = todayISO();
  const kpis = useMemo(() => {
    const semanaInicio = startOfWeekISO();
    const autosHoy = autos.filter((a) => a.fecha >= semanaInicio).length;
    const autosFinalizadosSemana = autos.filter((a) => isCompletedAuto(a) && a.fechaFinalizado && a.fechaFinalizado >= semanaInicio).length;
    const autosPend = autos.filter((a) => !isCompletedAuto(a)).length;
    const docsPend = documentos.filter((d) => !isCompletedDocumento(d)).length;
    const inmActivos = inmuebles.filter((i) => !isCompletedInmueble(i)).length;
    const trabajosActivos = autosPend + docsPend + inmActivos;
    const autosProntos = autos.filter((a) => a.estado === "Pronto para firma").length;
    const docsRevision = documentos.filter((d) => d.estado === "Para revisión").length;
    const vencidos = [
      ...documentos.filter((d) => isOverdue(d.fechaRecordatorio, d.estado)),
      ...inmuebles.filter((i) => isOverdue(i.fechaRecordatorio, i.estado)),
    ].length;
    const tramiteItems = [
      ...autos.filter(autoEarlyStage).map((a) => ({ key: "auto-" + a.id, cliente: a.cliente, tipo: "Auto", estado: a.estado, responsable: responsablesLabel(a.responsables), padron: a.padron, marcaModelo: a.marcaModelo, tab: "autos" })),
      ...documentos.filter(docEarlyStage).map((d) => ({ key: "doc-" + d.id, cliente: d.cliente, tipo: d.tipoDocumento, estado: documentoEstadoLabel(d), responsable: responsablesLabel(d.responsables), padron: "", marcaModelo: "", tab: "documentos" })),
    ].sort((p, q) => p.cliente?.localeCompare(q.cliente || "") || 0);
    const recordatorios = [
      ...autos.filter((a) => a.fechaRecordatorio && a.fechaRecordatorio <= today).map((a) => ({ key: "auto-" + a.id, cliente: a.cliente, origen: "Auto", detalle: a.marcaModelo || a.tipo, fecha: a.fechaRecordatorio, tab: "autos" })),
      ...documentos.filter((d) => d.fechaRecordatorio && d.fechaRecordatorio <= today).map((d) => ({ key: "doc-" + d.id, cliente: d.cliente, origen: "Documento", detalle: d.tipoDocumento, fecha: d.fechaRecordatorio, tab: "documentos" })),
      ...inmuebles.filter((i) => i.fechaRecordatorio && i.fechaRecordatorio <= today).map((i) => ({ key: "inm-" + i.id, cliente: i.cliente, origen: "Inmueble", detalle: `Padrón ${i.padron || "—"}`, fecha: i.fechaRecordatorio, tab: "inmuebles" })),
    ].sort((p, q) => (p.fecha || "").localeCompare(q.fecha || ""));
    return { autosHoy, autosFinalizadosSemana, autosPend, docsPend, inmActivos, trabajosActivos, autosProntos, docsRevision, vencidos, tramiteItems, recordatorios };
  }, [autos, documentos, inmuebles, today]);

  const altaPrioridad = autos.filter((a) => a.prioridad === "Alta").length + documentos.filter((d) => d.prioridad === "Alta").length + inmuebles.filter((i) => i.prioridad === "Alta").length;
  const verPrioridadAlta = () => { setTrabajosInitialFilters({ prioridad: "Alta" }); setTab("trabajos"); };

  const totals = useMemo(() => {
    const t = { inmuebles: 0, protocolizaciones: 0, sucesiones: 0, resenas: 0, certificados: 0, docsControlados: 0, docsObservados: 0, resenasNegativas: 0, certObservados: 0 };
    const ym = today.slice(0, 7);
    excelLog.filter((e) => e.fecha?.slice(0, 7) === ym).forEach((e) => {
      Object.keys(t).forEach((k) => { t[k] += Number(e[k] || 0); });
    });
    const auto = computeAutoTotals(autos, documentos, inmuebles, observados, ym);
    t.inmuebles += auto.inmuebles; t.protocolizaciones += auto.protocolizaciones; t.sucesiones += auto.sucesiones; t.certificados += auto.certificados;
    t.docsControlados += auto.docsControlados; t.docsObservados += auto.docsObservados; t.certObservados += auto.certObservados;
    return t;
  }, [excelLog, autos, documentos, inmuebles, observados, today]);
  const score = computeScore(totals);

  const cards = [
    { label: "Autos ingresados esta semana", value: kpis.autosHoy, icon: Car, tab: "autos" },
    { label: "Autos finalizados esta semana", value: kpis.autosFinalizadosSemana, icon: Car, tab: "trabajos" },
    { label: "Trabajos activos (Autos+Doc.+Inm.)", value: kpis.trabajosActivos, icon: ClipboardList, tab: "trabajos" },
    { label: "Autos prontos para firma", value: kpis.autosProntos, icon: Car, tab: "autos" },
    { label: "Documentos para revisión", value: kpis.docsRevision, icon: FileText, tab: "documentos" },
    { label: "Seguimientos vencidos", value: kpis.vencidos, icon: AlertTriangle, tab: "documentos", danger: true },
  ];

  return (
    <div className="ec-fade">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <AgendaFirmas agenda={agenda} setAgenda={setAgenda} />
          </div>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <ProntosParaAgendar prontos={prontos} setProntos={setProntos} agenda={agenda} setAgenda={setAgenda} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {cards.map((c) => (
              <button key={c.label} onClick={() => setTab(c.tab)} className="ec-card" style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer", borderColor: c.danger && c.value > 0 ? C.wax : C.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <c.icon size={16} color={c.danger && c.value > 0 ? C.wax : C.brass} />
                </div>
                <div className="ec-serif" style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: c.danger && c.value > 0 ? C.wax : C.ink }}>{c.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="ec-card" style={{ padding: "6px 0" }}>
            <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Autos y documentos en trámite</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {altaPrioridad > 0 && (
                  <button onClick={verPrioridadAlta} className="ec-badge" style={{ background: "#F3DDE0", color: C.wax, cursor: "pointer", border: "none", fontWeight: 700 }}>
                    ⚠ {altaPrioridad} prioridad alta
                  </button>
                )}
                <span style={{ fontSize: 12, color: C.muted }}>{kpis.tramiteItems.length} en curso</span>
              </div>
            </div>
            <div className="ec-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="ec-table">
                <thead><tr><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Responsable</th><th>Padrón</th><th>Marca y modelo</th></tr></thead>
                <tbody>
                  {kpis.tramiteItems.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: C.muted, padding: 20 }}>No hay trabajos pendientes o en curso</td></tr>}
                  {kpis.tramiteItems.map((it) => (
                    <tr key={it.key} onClick={() => setTab(it.tab)} style={{ cursor: "pointer" }}>
                      <td>{it.cliente || "—"}</td><td>{it.tipo}</td>
                      <td><EstadoBadge estado={it.estado} /></td><td>{it.responsable}</td>
                      <td>{it.padron || "—"}</td><td>{it.marcaModelo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ec-card" style={{ padding: "6px 0" }}>
            <InmueblesProximosFirmar inmuebles={inmuebles} proximosFirmar={proximosFirmar} setProximosFirmar={setProximosFirmar} setTab={setTab} />
          </div>

          <div className="ec-card" style={{ padding: "6px 0" }}>
            <RecordatoriosUnificados recordatorios={kpis.recordatorios} setTab={setTab} />
          </div>
        </div>
      </div>

      <div className="ec-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <Seal nivel={score.nivel} size={90} />
        <div>
          <div className="ec-mono" style={{ fontSize: 20, fontWeight: 600 }}>{score.total} pts</div>
          <button className="ec-btn-ghost" onClick={() => setTab("excelencia")} style={{ marginTop: 4 }}>Ver excelencia operativa <ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="ec-card" style={{ padding: "6px 0" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
          <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Tareas recurrentes</span>
        </div>
        <RecurringTasks />
      </div>
    </div>
  );
}

/* Minimalist signing-appointment agenda: día · hora · cliente · marca y modelo · observaciones */
/* Recordatorios vencidos o de hoy, juntando Autos + Documentos + Inmuebles en un solo lugar */
function RecordatoriosUnificados({ recordatorios, setTab }) {
  const today = todayISO();
  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}><Bell size={15} color={C.brass} /> Recordatorios</span>
        <span style={{ fontSize: 12, color: C.muted }}>{recordatorios.length}</span>
      </div>
      <div>
        {recordatorios.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay recordatorios pendientes.</div>}
        {recordatorios.map((r) => {
          const vencido = r.fecha < today;
          return (
            <div key={r.key} onClick={() => setTab(r.tab)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, cursor: "pointer", borderLeft: vencido ? `3px solid ${C.wax}` : "3px solid transparent" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.cliente || "Cliente sin nombre"}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{r.origen} · {r.detalle || "—"}</div>
              </div>
              <span style={{ fontSize: 12, color: vencido ? C.wax : C.muted, fontWeight: vencido ? 700 : 400 }}>{fmtDate(r.fecha)}{vencido ? " ⚠" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaFirmas({ agenda, setAgenda }) {
  const [adding, setAdding] = useState(false);
  const blank = () => ({ id: uid(), fecha: todayISO(), hora: "10:00", origen: "Auto", cliente: "", marcaModelo: "", observaciones: "" });
  const [form, setForm] = useState(blank());

  const save = () => { setAgenda([...agenda, { ...form }]); setForm(blank()); setAdding(false); };
  const remove = (id) => setAgenda(agenda.filter((a) => a.id !== id));

  const today = todayISO();
  const upcoming = agenda
    .filter((a) => a.fecha >= today)
    .sort((a, b) => (a.fecha === b.fecha ? (a.hora || "").localeCompare(b.hora || "") : a.fecha.localeCompare(b.fecha)));

  const groups = [];
  upcoming.forEach((a) => {
    const last = groups[groups.length - 1];
    if (last && last.fecha === a.fecha) last.items.push(a);
    else groups.push({ fecha: a.fecha, items: [a] });
  });

  const weekdayLong = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-UY", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Agenda de firmas</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agendar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nueva firma">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
          <Field label="Día"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Hora"><input className="ec-input" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}><option value="Auto">Auto</option><option value="Inmueble">Inmueble</option></select></Field>
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label={form.origen === "Inmueble" ? "Padrón" : "Marca y modelo"}><input className="ec-input" placeholder={form.origen === "Inmueble" ? "Ej: Padrón 12345" : "Ej: VW Gol"} value={form.marcaModelo} onChange={(e) => setForm({ ...form, marcaModelo: e.target.value })} /></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Agendar firma</button></div>
      </AddPanel>

      <div style={{ padding: "4px 0 8px" }}>
        {groups.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay firmas agendadas.</div>}
        {groups.map((g) => (
          <div key={g.fecha} style={{ padding: "8px 16px" }}>
            <div className="ec-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: C.brass, fontWeight: 600, marginBottom: 4, paddingTop: 4, borderTop: g.fecha === today ? "none" : `1px dashed ${C.line}` }}>
              {g.fecha === today ? "Hoy" : weekdayLong(g.fecha)}
            </div>
            {g.items.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "6px 0", fontSize: 13 }}>
                <span className="ec-mono" style={{ width: 48, color: C.ink, fontWeight: 600 }}>{a.hora || "—"}</span>
                <span style={{ width: 130, flexShrink: 0 }}>{a.cliente || "—"}</span>
                <span className="ec-badge" style={{ background: C.paper2, color: a.origen === "Inmueble" ? C.bottle : C.brass, flexShrink: 0 }}>{a.origen || "Auto"}</span>
                <span style={{ width: 130, flexShrink: 0, color: C.muted }}>{a.marcaModelo || "—"}</span>
                <span style={{ flex: 1, color: C.muted, fontSize: 12.5 }}>{a.observaciones || ""}</span>
                <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, flexShrink: 0 }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Documentos listos para firmar (Testimonio/Cert./Carta/Acta en "Pronto", Poderes en "Documento pronto")
   que todavía no tienen fecha y hora asignada; al agendarlos pasan a la Agenda de firmas. */
/* Lista de carga manual: cliente, auto y observaciones. Al ponerle fecha (y hora) y confirmar,
   el registro pasa a la Agenda de firmas y sale de esta lista. */
function ProntosParaAgendar({ prontos, setProntos, agenda, setAgenda }) {
  const [adding, setAdding] = useState(false);
  const blank = () => ({ id: uid(), cliente: "", auto: "", observaciones: "" });
  const [form, setForm] = useState(blank());
  const [drafts, setDrafts] = useState({});

  const save = () => { setProntos([...prontos, { ...form }]); setForm(blank()); setAdding(false); };
  const remove = (id) => setProntos(prontos.filter((p) => p.id !== id));

  const draftFor = (id) => drafts[id] || { fecha: "", hora: "10:00" };
  const setDraft = (id, patch) => setDrafts({ ...drafts, [id]: { ...draftFor(id), ...patch } });

  const agendar = (p) => {
    const draft = draftFor(p.id);
    if (!draft.fecha) return;
    setAgenda([...agenda, { id: uid(), fecha: draft.fecha, hora: draft.hora, cliente: p.cliente, marcaModelo: p.auto, observaciones: p.observaciones }]);
    remove(p.id);
  };

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Documentos prontos para agendar</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo documento pronto">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Auto"><input className="ec-input" placeholder="Ej: VW Gol" value={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.value })} /></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Agregar</button></div>
      </AddPanel>

      <div>
        {prontos.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay documentos prontos sin agendar.</div>}
        {prontos.map((p) => {
          const draft = draftFor(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.cliente || "Cliente sin nombre"}</div>
                <div style={{ fontSize: 11.5, color: C.muted }}>{p.auto || "—"}{p.observaciones ? ` · ${p.observaciones}` : ""}</div>
              </div>
              <input className="ec-input" style={{ width: 130 }} type="date" value={draft.fecha} onChange={(e) => setDraft(p.id, { fecha: e.target.value })} />
              <input className="ec-input" style={{ width: 90 }} type="time" value={draft.hora} onChange={(e) => setDraft(p.id, { hora: e.target.value })} />
              <button className="ec-btn" onClick={() => agendar(p)}><Plus size={13} /> Agendar</button>
              <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Inmuebles próximos a firmarse: se eligen de la lista de Inmuebles y se les puede anotar qué está faltando */
function InmueblesProximosFirmar({ inmuebles, proximosFirmar, setProximosFirmar, setTab }) {
  const [adding, setAdding] = useState(false);
  const blank = () => ({ id: uid(), inmuebleId: "", faltante: "" });
  const [form, setForm] = useState(blank());

  const save = () => {
    const inm = inmuebles.find((i) => i.id === form.inmuebleId);
    if (!inm) return;
    setProximosFirmar([...proximosFirmar, { id: uid(), inmuebleId: inm.id, cliente: inm.cliente, padron: inm.padron, faltante: form.faltante }]);
    setForm(blank()); setAdding(false);
  };
  const remove = (id) => setProximosFirmar(proximosFirmar.filter((p) => p.id !== id));
  const setFaltante = (id, val) => setProximosFirmar(proximosFirmar.map((p) => (p.id === id ? { ...p, faltante: val } : p)));

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Inmuebles próximos a firmarse</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Agregar inmueble próximo a firmarse">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
          <Field label="Inmueble">
            <select className="ec-select" value={form.inmuebleId} onChange={(e) => setForm({ ...form, inmuebleId: e.target.value })}>
              <option value="">Elegir…</option>
              {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.cliente || "Sin cliente"} · Padrón {i.padron || "—"}</option>)}
            </select>
          </Field>
          <Field label="Qué está faltando"><input className="ec-input" value={form.faltante} onChange={(e) => setForm({ ...form, faltante: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Agregar</button></div>
      </AddPanel>

      <div>
        {proximosFirmar.length === 0 && <div style={{ padding: "20px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>No hay inmuebles próximos a firmarse.</div>}
        {proximosFirmar.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140, cursor: "pointer" }} onClick={() => setTab("inmuebles")}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.cliente || "Cliente sin nombre"}</div>
              <div style={{ fontSize: 11.5, color: C.muted }}>Padrón {p.padron || "—"}</div>
            </div>
            <input className="ec-input" style={{ width: 220 }} placeholder="Qué está faltando" value={p.faltante} onChange={(e) => setFaltante(p.id, e.target.value)} />
            <button onClick={() => remove(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Documentos observados: carga manual desde el Excel de títulos en el registro */
const ESTADOS_OBSERVADO = ["Solucionando", "Observación presentada", "Observación pronta", "Observación levantada", "Finalizado"];
const SECTORES_OBSERVADO = ["Automotores", "Documentos"];
function DocumentosObservados({ observados, setObservados, autos, documentos }) {
  const [adding, setAdding] = useState(false);
  const blank = () => ({ id: uid(), fecha: todayISO(), sector: SECTORES_OBSERVADO[0], vinculoId: "", cliente: "", padron: "", marcaModelo: "", numeroIngreso: "", pin: "", documento: "", queSeObservo: "", estado: ESTADOS_OBSERVADO[0], prioridad: "" });
  const [form, setForm] = useState(blank());

  const vincularAuto = (autoId) => {
    const a = (autos || []).find((x) => x.id === autoId);
    if (!a) { setForm({ ...form, vinculoId: "" }); return; }
    setForm({ ...form, vinculoId: autoId, cliente: a.cliente, padron: a.padron, marcaModelo: a.marcaModelo, numeroIngreso: a.numeroIngreso || form.numeroIngreso, pin: a.pin || form.pin });
  };
  const vincularDocumento = (docId) => {
    const d = (documentos || []).find((x) => x.id === docId);
    if (!d) { setForm({ ...form, vinculoId: "" }); return; }
    setForm({ ...form, vinculoId: docId, cliente: d.cliente, documento: d.tipoDocumento });
  };

  const save = () => { setObservados([...observados, { ...form }]); setForm(blank()); setAdding(false); };
  const remove = (id) => setObservados(observados.filter((o) => o.id !== id));
  const setEstado = (id, estado) => {
    if (estado === "Observación pronta" || estado === "Observación levantada" || estado === "Finalizado") {
      setObservados(observados.map((o) => (o.id === id ? { ...o, estado, resuelto: true, fechaResuelto: todayISO() } : o)));
      return;
    }
    setObservados(observados.map((o) => (o.id === id ? { ...o, estado, resuelto: false, fechaResuelto: null } : o)));
  };
  const setPrioridad = (id, prioridad) => setObservados(observados.map((o) => (o.id === id ? { ...o, prioridad } : o)));

  // Auto-escalar a prioridad Alta cuando la inscripción de un automotor observado lleva 4+ meses (caduca a los 5)
  useEffect(() => {
    const aEscalar = observados.filter((o) => o.sector !== "Documentos" && !o.resuelto && mesesTranscurridos(o.fecha) >= 4 && o.prioridad !== "Alta");
    if (aEscalar.length > 0) {
      setObservados(observados.map((o) => (aEscalar.some((x) => x.id === o.id) ? { ...o, prioridad: "Alta" } : o)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observados]);

  const renderRow = (o) => {
    const meses = mesesTranscurridos(o.fecha);
    const porCaducar = o.sector !== "Documentos" && meses >= 4;
    return (
      <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, borderLeft: porCaducar ? `3px solid ${C.wax}` : "3px solid transparent", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{o.cliente || "Cliente sin nombre"}</div>
          {o.sector === "Documentos" ? (
            <div style={{ fontSize: 11.5, color: C.muted }}>{o.documento || "—"} · {o.queSeObservo || "sin detalle"}</div>
          ) : (
            <div style={{ fontSize: 11.5, color: C.muted }}>Padrón {o.padron || "—"} · {o.marcaModelo || "—"} · Ingreso {o.numeroIngreso || "—"} · PIN {o.pin || "—"}</div>
          )}
          {porCaducar && <div style={{ fontSize: 11, color: C.wax, fontWeight: 700, marginTop: 2 }}>⚠ Mes {meses} de 5 — la inscripción caduca pronto</div>}
        </div>
        <PrioridadPicker value={o.prioridad} onChange={(v) => setPrioridad(o.id, v)} />
        <select className="ec-select" style={{ width: "auto" }} value={o.estado || ESTADOS_OBSERVADO[0]} onChange={(e) => setEstado(o.id, e.target.value)}>
          {ESTADOS_OBSERVADO.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => remove(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
      </div>
    );
  };

  const obsAutos = observados.filter((o) => o.sector !== "Documentos" && !o.resuelto);
  const obsDocs = observados.filter((o) => o.sector === "Documentos" && !o.resuelto);
  const resueltos = observados.filter((o) => o.resuelto).sort((a, b) => (b.fechaResuelto || "").localeCompare(a.fechaResuelto || ""));
  const [showHistorial, setShowHistorial] = useState(false);
  const ym = todayISO().slice(0, 7);
  const autosEsteMes = obsAutos.filter((o) => o.fecha?.slice(0, 7) === ym).length;

  return (
    <div>
      <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Documentos observados</span>
        <button className="ec-btn-ghost" onClick={() => setAdding(true)}><Plus size={13} /> Agregar</button>
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nueva observación">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          <Field label="Fecha de ingreso"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Sector"><select className="ec-select" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value, vinculoId: "" })}>{SECTORES_OBSERVADO.map((t) => <option key={t}>{t}</option>)}</select></Field>
          {form.sector === "Automotores" ? (
            <Field label="Vincular a un auto existente (opcional)">
              <select className="ec-select" value={form.vinculoId} onChange={(e) => vincularAuto(e.target.value)}>
                <option value="">Carga manual</option>
                {(autos || []).map((a) => <option key={a.id} value={a.id}>{a.cliente || "Sin cliente"} · Padrón {a.padron || "—"}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Vincular a un documento existente (opcional)">
              <select className="ec-select" value={form.vinculoId} onChange={(e) => vincularDocumento(e.target.value)}>
                <option value="">Carga manual</option>
                {(documentos || []).map((d) => <option key={d.id} value={d.id}>{d.cliente || "Sin cliente"} · {d.tipoDocumento}</option>)}
              </select>
            </Field>
          )}
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Estado"><select className="ec-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS_OBSERVADO.map((t) => <option key={t}>{t}</option>)}</select></Field>
          {form.sector === "Automotores" ? (
            <>
              <Field label="Padrón"><input className="ec-input" value={form.padron} onChange={(e) => setForm({ ...form, padron: e.target.value })} /></Field>
              <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.marcaModelo} onChange={(e) => setForm({ ...form, marcaModelo: e.target.value })} /></Field>
              <Field label="Número de inscripción"><input className="ec-input" value={form.numeroIngreso} onChange={(e) => setForm({ ...form, numeroIngreso: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="Qué documento está observado"><input className="ec-input" placeholder="Ej: Testimonio compraventa" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></Field>
              <Field label="Qué fue lo que se observó"><input className="ec-input" value={form.queSeObservo} onChange={(e) => setForm({ ...form, queSeObservo: e.target.value })} /></Field>
            </>
          )}
          <Field label="Prioridad"><select className="ec-select" value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}><option value="">Sin definir</option>{PRIORIDADES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Agregar</button></div>
      </AddPanel>

      <div style={{ padding: "8px 16px 2px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
        <span>Automotores</span>
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>Este mes: {autosEsteMes} · Total abiertos: {obsAutos.length}</span>
      </div>
      <div>
        {obsAutos.length === 0 && <div style={{ padding: "12px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>Sin observados de automotores.</div>}
        {obsAutos.map(renderRow)}
      </div>

      <div style={{ padding: "10px 16px 2px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, borderTop: `1px dashed ${C.line}` }}>Documentos</div>
      <div>
        {obsDocs.length === 0 && <div style={{ padding: "12px 16px", color: C.muted, fontSize: 13, textAlign: "center" }}>Sin observados de documentos.</div>}
        {obsDocs.map(renderRow)}
      </div>

      <div style={{ borderTop: `1.5px solid ${C.ink}`, marginTop: 4 }}>
        <button onClick={() => setShowHistorial(!showHistorial)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
          <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>Historial de resueltos ({resueltos.length})</span>
          {showHistorial ? <ChevronDown size={14} color={C.muted} /> : <ChevronRight size={14} color={C.muted} />}
        </button>
        {showHistorial && (
          <div style={{ paddingBottom: 6 }}>
            {resueltos.length === 0 && <div style={{ padding: "8px 16px", color: C.muted, fontSize: 12.5, textAlign: "center" }}>Todavía no se resolvió ninguno.</div>}
            {resueltos.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderTop: `1px solid ${C.line}`, fontSize: 12.5 }}>
                <span className="ec-badge" style={{ background: C.paper2, color: C.brass }}>{o.sector}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{o.cliente || "Cliente sin nombre"}</div>
                  <div style={{ color: C.muted, fontSize: 11.5 }}>
                    {o.sector === "Documentos" ? `${o.documento || "—"} · ${o.queSeObservo || "sin detalle"}` : `Padrón ${o.padron || "—"} · ${o.marcaModelo || "—"}`}
                  </div>
                </div>
                <span style={{ color: C.muted }}>{o.estado}</span>
                <span className="ec-mono" style={{ color: C.muted }}>Resuelto {fmtDate(o.fechaResuelto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecurringTasks() {
  const [done, setDone] = useSharedList("cavallo:recurring-done", {});
  const [doneObj] = [done]; // stored as object map keyed by taskId->periodKey
  const [assigneeOverrides, setAssigneeOverrides] = useSharedList("cavallo:recurring-assignees", {});

  const periodKey = (freq) => {
    const d = new Date();
    if (freq === "diaria") return d.toISOString().slice(0, 10);
    if (freq === "mensual") return d.toISOString().slice(0, 7);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  };

  const toggle = (task) => {
    const key = periodKey(task.freq);
    const current = { ...(doneObj || {}) };
    if (current[task.id] === key) delete current[task.id];
    else current[task.id] = key;
    setDone(current);
  };

  const assigneesFor = (task) => (assigneeOverrides || {})[task.id] || task.assignees;
  const setAssignees = (taskId, list) => setAssigneeOverrides({ ...(assigneeOverrides || {}), [taskId]: list });

  const freqLabel = { diaria: "Diaria", semanal: "Semanal", mensual: "Mensual" };
  const freqColor = { diaria: C.bottle, semanal: C.brass, mensual: C.wax };

  return (
    <div>
      {RECURRING_TASKS.map((t) => {
        const isDone = (doneObj || {})[t.id] === periodKey(t.freq);
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
            <Check checked={isDone} onChange={() => toggle(t)} />
            <div style={{ flex: 1, fontSize: 13, textDecoration: isDone ? "line-through" : "none", color: isDone ? C.muted : C.ink, minWidth: 180 }}>{t.title}</div>
            <span className="ec-badge" style={{ background: C.paper2, color: freqColor[t.freq] }}>{freqLabel[t.freq]}</span>
            <ResponsablesPicker value={assigneesFor(t)} onChange={(v) => setAssignees(t.id, v)} compact />
          </div>
        );
      })}
    </div>
  );
}

/* ============================== FILTER BAR ============================== */
function FilterBar({ filters, setFilters, options }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
      <Filter size={14} color={C.muted} />
      {options.map((opt) => (
        <select key={opt.key} className="ec-select" style={{ width: "auto" }}
          value={filters[opt.key] || ""} onChange={(e) => setFilters({ ...filters, [opt.key]: e.target.value })}>
          <option value="">{opt.label}: Todos</option>
          {opt.values.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ))}
      {Object.values(filters).some(Boolean) && (
        <button className="ec-btn-ghost" onClick={() => setFilters({})}><X size={13} /> Limpiar</button>
      )}
    </div>
  );
}

/* ============================== TAB: AUTOS ============================== */
function Autos({ autos, setAutos, prontos, setProntos, modoSimple }) {
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState(blankAuto());
  function blankAuto() {
    return { id: uid(), fecha: todayISO(), cliente: "", telefono: "", financiado: false, matricula: "", padron: "", marcaModelo: "", matricula2: "", padron2: "", marcaModelo2: "", tipo: TIPOS_AUTO[0], responsables: ["Alex", "Belén"], responsablesProtocolizacion: [], libreDePrenda: "no_pedido", libreDeEmbargo: "no_pedido", libreDeDeuda: "no_pedido", certificadoSucive: "no_pedido", matriculasRequeridas: "no_pedido", documentoElaborado: "no_pedido", cobrado: "no_pedido", estado: "Pendiente", numeroIngreso: "", pin: "", fechaRecordatorio: "", prioridad: "", observaciones: "", fechaFinalizado: null, enProntos: false };
  }
  const filtered = autos.filter((a) => !isCompletedAuto(a) && (!filters.estado || a.estado === filters.estado) && (!filters.responsable || responsableMatches(a.responsables, filters.responsable) || responsableMatches(a.responsablesProtocolizacion, filters.responsable))).sort(porPrioridad);

  const save = () => { const a = { ...form }; if (isCompletedAuto(a)) a.fechaFinalizado = todayISO(); setAutos([a, ...autos]); setForm(blankAuto()); setAdding(false); };
  const allGreen = (a) => [a.libreDePrenda, a.libreDeEmbargo, a.libreDeDeuda, a.certificadoSucive, a.matriculasRequeridas, a.documentoElaborado, a.cobrado].every((v) => v === "ok");
  const update = (id, patch) => setAutos(autos.map((a) => {
    if (a.id !== id) return a;
    const next = { ...a, ...patch };
    const was = isCompletedAuto(a), now = isCompletedAuto(next);
    if (now && !was) next.fechaFinalizado = todayISO();
    if (!now && was) next.fechaFinalizado = null;
    const earlyStages = ["Pendiente", "Trabajando en él"];
    if (allGreen(next) && !allGreen(a) && earlyStages.includes(next.estado)) {
      next.estado = "Pronto para firma";
    }
    if (next.estado === "Pronto para firma" && !next.enProntos) {
      next.enProntos = true;
      setProntos([...prontos, { id: uid(), cliente: next.cliente, auto: next.marcaModelo, observaciones: next.observaciones || "" }]);
    }
    if (next.estado === "Para protocolizar" && a.estado !== "Para protocolizar" && (!next.responsablesProtocolizacion || next.responsablesProtocolizacion.length === 0)) {
      next.responsablesProtocolizacion = ["Andrea"];
    }
    return next;
  }));
  const remove = (id) => setAutos(autos.filter((a) => a.id !== id));

  return (
    <div className="ec-fade">
      <Header title="Automotores" subtitle="Registro diario y cuatro controles esenciales." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo trámite de automotor">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          {!modoSimple && (
            <>
              <Field label="Teléfono (WhatsApp)"><input className="ec-input" placeholder="09X XXX XXX" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
              <Field label="Financiado"><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, height: 33 }}><input type="checkbox" checked={form.financiado} onChange={(e) => setForm({ ...form, financiado: e.target.checked })} /> Sí</label></Field>
            </>
          )}
          <Field label="Matrícula"><input className="ec-input" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></Field>
          <Field label="Padrón"><input className="ec-input" value={form.padron} onChange={(e) => setForm({ ...form, padron: e.target.value })} /></Field>
          <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.marcaModelo} onChange={(e) => setForm({ ...form, marcaModelo: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS_AUTO.map((t) => <option key={t}>{t}</option>)}</select></Field>
          {form.tipo === "Permuta" && (
            <>
              <Field label="Matrícula (2º vehículo)"><input className="ec-input" value={form.matricula2} onChange={(e) => setForm({ ...form, matricula2: e.target.value })} /></Field>
              <Field label="Padrón (2º vehículo)"><input className="ec-input" value={form.padron2} onChange={(e) => setForm({ ...form, padron2: e.target.value })} /></Field>
              <Field label="Marca y modelo (2º vehículo)"><input className="ec-input" placeholder="Ej: Fiat Cronos" value={form.marcaModelo2} onChange={(e) => setForm({ ...form, marcaModelo2: e.target.value })} /></Field>
            </>
          )}
          <Field label="Responsable(s)"><ResponsablesPicker value={form.responsables} onChange={(v) => setForm({ ...form, responsables: v })} /></Field>
          <Field label="Estado"><select className="ec-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS_AUTO.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Observaciones"><input className="ec-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        {!modoSimple && form.tipo === "Compraventa" && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, marginBottom: 8 }}>Registro (solo compraventa)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              <Field label="Número de ingreso"><input className="ec-input" value={form.numeroIngreso} onChange={(e) => setForm({ ...form, numeroIngreso: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Guardar trámite</button></div>
      </AddPanel>

      <FilterBar filters={filters} setFilters={setFilters} options={[
        { key: "estado", label: "Estado", values: ESTADOS_AUTO.filter((s) => s !== "Protocolizado") },
        { key: "responsable", label: "Responsable", values: RESPONSABLES },
      ]} />

      {!modoSimple && <TriLegend />}
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No hay autos registrados todavía.</div>}
        {filtered.map((a) => {
          const dueReminder = a.estado === "Pendiente" && a.fechaRecordatorio && a.fechaRecordatorio <= todayISO();
          return (
          <div key={a.id} className="ec-card" style={{ padding: 14, borderColor: dueReminder ? C.wax : C.line }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
                <input className="ec-input" style={{ width: 150, fontWeight: 700 }} placeholder="Cliente" value={a.cliente || ""} onChange={(e) => update(a.id, { cliente: e.target.value })} />
                <input className="ec-input" style={{ width: 140 }} placeholder="Marca y modelo" value={a.marcaModelo || ""} onChange={(e) => update(a.id, { marcaModelo: e.target.value })} />
                {a.financiado && <span className="ec-badge" style={{ background: C.paper2, color: C.wax }}>Financiado</span>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="ec-select" style={{ width: "auto" }} value={a.estado} onChange={(e) => update(a.id, { estado: e.target.value })}>
                  {ESTADOS_AUTO.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>{a.tipo}</span>
              <Field label="Matrícula"><input className="ec-input" style={{ width: 110 }} value={a.matricula || ""} onChange={(e) => update(a.id, { matricula: e.target.value })} /></Field>
              <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={a.padron || ""} onChange={(e) => update(a.id, { padron: e.target.value })} /></Field>
              <Field label="Teléfono"><input className="ec-input" style={{ width: 130 }} value={a.telefono || ""} onChange={(e) => update(a.id, { telefono: e.target.value })} /></Field>
              <span className="ec-mono" style={{ fontSize: 12, color: C.muted }}>{fmtDate(a.fecha)}</span>
              <ResponsablesPicker value={a.responsables} onChange={(v) => update(a.id, { responsables: v })} />
            </div>
            {a.tipo === "Permuta" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}`, alignItems: "center" }}>
                <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600 }}>2º vehículo</span>
                <Field label="Matrícula"><input className="ec-input" style={{ width: 110 }} value={a.matricula2 || ""} onChange={(e) => update(a.id, { matricula2: e.target.value })} /></Field>
                <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={a.padron2 || ""} onChange={(e) => update(a.id, { padron2: e.target.value })} /></Field>
                <Field label="Marca y modelo"><input className="ec-input" style={{ width: 140 }} value={a.marcaModelo2 || ""} onChange={(e) => update(a.id, { marcaModelo2: e.target.value })} /></Field>
              </div>
            )}
            {a.estado === "Pendiente" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkSolicitarDocumentacion(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Pedir documentación por WhatsApp
                </a>
              </div>
            )}
            {a.estado === "Llegó del registro" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkAutoDocs(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Enviar WhatsApp {a.financiado ? "(financiado)" : "(prontos)"}
                </a>
              </div>
            )}
            {a.estado === "Pronto para firma" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <a href={whatsappLinkCoordinarFirma(a)} target="_blank" rel="noreferrer" className="ec-btn" style={{ textDecoration: "none", background: "#2CA043", borderColor: "#2CA043" }}>
                  Coordinar firma por WhatsApp
                </a>
              </div>
            )}
            {!modoSimple && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.libreDePrenda} onChange={(v) => update(a.id, { libreDePrenda: v })} /> Libre de prenda</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.libreDeEmbargo} onChange={(v) => update(a.id, { libreDeEmbargo: v })} /> Libre de embargo</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.libreDeDeuda} onChange={(v) => update(a.id, { libreDeDeuda: v })} /> Libre de deuda</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.certificadoSucive} onChange={(v) => update(a.id, { certificadoSucive: v })} /> Cert. Sucive</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.matriculasRequeridas} onChange={(v) => update(a.id, { matriculasRequeridas: v })} /> Matrículas req.</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.documentoElaborado} onChange={(v) => update(a.id, { documentoElaborado: v })} /> Doc. elaborado</label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={a.cobrado} onChange={(v) => update(a.id, { cobrado: v })} /> Cobrado</label>
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
              <Field label="Observaciones — qué está faltando"><input className="ec-input" placeholder="Ej: falta cédula del cónyuge" value={a.observaciones || ""} onChange={(e) => update(a.id, { observaciones: e.target.value })} /></Field>
            </div>
            {!modoSimple && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Reasignar para protocolización:</span>
                  <ResponsablesPicker value={a.responsablesProtocolizacion} onChange={(v) => update(a.id, { responsablesProtocolizacion: v })} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: dueReminder ? C.wax : C.muted, fontWeight: dueReminder ? 700 : 400 }}>Recordarme el:</span>
                  <input className="ec-input" style={{ width: 140 }} type="date" value={a.fechaRecordatorio || ""} onChange={(e) => update(a.id, { fechaRecordatorio: e.target.value })} />
                  {dueReminder && <span style={{ color: C.wax }}>⚠</span>}
                </label>
                <PrioridadPicker value={a.prioridad} onChange={(v) => update(a.id, { prioridad: v })} />
              </div>
            )}
            {!modoSimple && a.tipo === "Compraventa" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em", color: C.muted, fontWeight: 600, marginBottom: 8 }}>Registro</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                  <Field label="Número de ingreso"><input className="ec-input" value={a.numeroIngreso || ""} onChange={(e) => update(a.id, { numeroIngreso: e.target.value })} /></Field>
                  <Field label="PIN"><input className="ec-input" value={a.pin || ""} onChange={(e) => update(a.id, { pin: e.target.value })} /></Field>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== TAB: DOCUMENTOS ============================== */
/* ============================== TAB: DOCUMENTOS ============================== */
function Documentos({ documentos, setDocumentos, modoSimple }) {
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState({});
  const blank = () => ({
    id: uid(), fecha: todayISO(), cliente: "", telefono: "", tipoDocumento: TIPOS_DOCUMENTO[0], referencia: "", responsables: ["Alex", "Belén"],
    elaborado: false, revisado: false, entregado: false, cobrado: false,
    estado: "Pendiente", estadoSucesion: ESTADOS_SUCESION[0], estadoPoder: ESTADOS_PODER[0],
    vehiculo: "", padron: "", estadoEscaneo: ESTADOS_ESCANEO[0], estadoReconstruccion: ESTADOS_RECONSTRUCCION[0],
    documentacionPedida: false, estadoSAS: ESTADOS_SAS[0],
    quienPelota: QUIEN_PELOTA[0], fechaRecordatorio: "", prioridad: "",
    observaciones: "", fechaFinalizado: null,
  });
  const [form, setForm] = useState(blank());

  const filtered = documentos.filter((d) => !isCompletedDocumento(d) && (!filters.estado || d.estado === filters.estado) && (!filters.responsable || responsableMatches(d.responsables, filters.responsable)) && (!filters.tipoDocumento || d.tipoDocumento === filters.tipoDocumento)).sort(porPrioridad);
  const save = () => { const d = { ...form }; if (isCompletedDocumento(d)) d.fechaFinalizado = todayISO(); setDocumentos([d, ...documentos]); setForm(blank()); setAdding(false); };
  const update = (id, patch) => setDocumentos(documentos.map((d) => {
    if (d.id !== id) return d;
    const next = { ...d, ...patch };
    const was = isCompletedDocumento(d), now = isCompletedDocumento(next);
    if (now && !was) next.fechaFinalizado = todayISO();
    if (!now && was) next.fechaFinalizado = null;
    return next;
  }));
  const remove = (id) => setDocumentos(documentos.filter((d) => d.id !== id));

  /* Control de estado principal según el tipo de documento */
  const primaryEstado = (d) => {
    if (isSimplified(d.tipoDocumento)) return { value: d.estadoPoder, options: ESTADOS_PODER, onChange: (v) => update(d.id, { estadoPoder: v }) };
    if (d.tipoDocumento === "Sucesiones") return { value: d.estadoSucesion, options: ESTADOS_SUCESION, onChange: (v) => update(d.id, { estadoSucesion: v }) };
    if (isSAS(d.tipoDocumento)) return { value: d.estadoSAS, options: ESTADOS_SAS, onChange: (v) => update(d.id, { estadoSAS: v }) };
    if (isEscaneo(d.tipoDocumento)) return { value: d.estadoEscaneo, options: ESTADOS_ESCANEO, onChange: (v) => update(d.id, { estadoEscaneo: v }) };
    if (isReconstruccion(d.tipoDocumento)) return { value: d.estadoReconstruccion, options: ESTADOS_RECONSTRUCCION, onChange: (v) => update(d.id, { estadoReconstruccion: v }) };
    return { value: d.estado, options: ESTADOS, onChange: (v) => update(d.id, { estado: v }) };
  };

  return (
    <div className="ec-fade">
      <Header title="Documentos" subtitle="Testimonios, certificados, poderes, sucesiones, SAS y otros." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo documento">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Teléfono (WhatsApp)"><input className="ec-input" placeholder="09X XXX XXX" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
          <Field label="Tipo de documento"><select className="ec-select" value={form.tipoDocumento} onChange={(e) => setForm({ ...form, tipoDocumento: e.target.value })}>{TIPOS_DOCUMENTO.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Responsable(s)"><ResponsablesPicker value={form.responsables} onChange={(v) => setForm({ ...form, responsables: v })} /></Field>

          {isSimplified(form.tipoDocumento) && (
            <Field label="Estado"><select className="ec-select" value={form.estadoPoder} onChange={(e) => setForm({ ...form, estadoPoder: e.target.value })}>{ESTADOS_PODER.map((t) => <option key={t}>{t}</option>)}</select></Field>
          )}
          {form.tipoDocumento === "Sucesiones" && (
            <Field label="Estado de la sucesión"><select className="ec-select" value={form.estadoSucesion} onChange={(e) => setForm({ ...form, estadoSucesion: e.target.value })}>{ESTADOS_SUCESION.map((t) => <option key={t}>{t}</option>)}</select></Field>
          )}
          {isEscaneo(form.tipoDocumento) && (
            <>
              <Field label="Vehículo"><input className="ec-input" value={form.vehiculo} onChange={(e) => setForm({ ...form, vehiculo: e.target.value })} /></Field>
              <Field label="Padrón"><input className="ec-input" value={form.padron} onChange={(e) => setForm({ ...form, padron: e.target.value })} /></Field>
              <Field label="Estado"><select className="ec-select" value={form.estadoEscaneo} onChange={(e) => setForm({ ...form, estadoEscaneo: e.target.value })}>{ESTADOS_ESCANEO.map((t) => <option key={t}>{t}</option>)}</select></Field>
            </>
          )}
          {isSAS(form.tipoDocumento) && (
            <>
              <Field label="Documentación pedida"><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, height: 33 }}><input type="checkbox" checked={form.documentacionPedida} onChange={(e) => setForm({ ...form, documentacionPedida: e.target.checked })} /> Sí</label></Field>
              <Field label="Estado"><select className="ec-select" value={form.estadoSAS} onChange={(e) => setForm({ ...form, estadoSAS: e.target.value })}>{ESTADOS_SAS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            </>
          )}
          {isReconstruccion(form.tipoDocumento) && (
            <>
              <Field label="Padrón"><input className="ec-input" value={form.padron} onChange={(e) => setForm({ ...form, padron: e.target.value })} /></Field>
              <Field label="Marca y modelo"><input className="ec-input" placeholder="Ej: VW Gol" value={form.vehiculo} onChange={(e) => setForm({ ...form, vehiculo: e.target.value })} /></Field>
              <Field label="Estado"><select className="ec-select" value={form.estadoReconstruccion} onChange={(e) => setForm({ ...form, estadoReconstruccion: e.target.value })}>{ESTADOS_RECONSTRUCCION.map((t) => <option key={t}>{t}</option>)}</select></Field>
            </>
          )}
          {!isSpecialType(form.tipoDocumento) && (
            <>
              {!modoSimple && <Field label="Referencia / descripción"><input className="ec-input" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></Field>}
              <Field label="Estado"><select className="ec-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS.map((t) => <option key={t}>{t}</option>)}</select></Field>
              {!modoSimple && <Field label="Quién tiene la pelota"><select className="ec-select" value={form.quienPelota} onChange={(e) => setForm({ ...form, quienPelota: e.target.value })}>{QUIEN_PELOTA.map((t) => <option key={t}>{t}</option>)}</select></Field>}
              {!modoSimple && <Field label="Próxima fecha clave"><input className="ec-input" type="date" value={form.fechaRecordatorio} onChange={(e) => setForm({ ...form, fechaRecordatorio: e.target.value })} /></Field>}
            </>
          )}
          <Field label="Observaciones"><input className="ec-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Guardar documento</button></div>
      </AddPanel>

      <FilterBar filters={filters} setFilters={setFilters} options={[
        { key: "tipoDocumento", label: "Tipo", values: TIPOS_DOCUMENTO },
        { key: "responsable", label: "Responsable", values: RESPONSABLES },
      ]} />

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No hay documentos registrados todavía.</div>}
        {filtered.map((d) => {
          const est = primaryEstado(d);
          const pending = isPendingLike(d);
          const overdue = !isSpecialType(d.tipoDocumento) && isOverdue(d.fechaRecordatorio, d.estado);
          const dueReminder = pending && d.fechaRecordatorio && d.fechaRecordatorio <= todayISO();
          return (
            <div key={d.id} className="ec-card" style={{ padding: 14, borderColor: dueReminder ? C.wax : C.line }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", flex: 1, minWidth: 220 }}>
                  <input className="ec-input" style={{ width: 160, fontWeight: 700 }} placeholder="Cliente" value={d.cliente || ""} onChange={(e) => update(d.id, { cliente: e.target.value })} />
                  <span style={{ color: C.muted, fontSize: 13 }}>{d.tipoDocumento}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select className="ec-select" style={{ width: "auto" }} value={est.value} onChange={(e) => est.onChange(e.target.value)}>
                    {est.options.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => remove(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8, alignItems: "center" }}>
                <span className="ec-mono" style={{ fontSize: 12, color: C.muted }}>{fmtDate(d.fecha)}</span>
                <Field label="Teléfono"><input className="ec-input" style={{ width: 130 }} value={d.telefono || ""} onChange={(e) => update(d.id, { telefono: e.target.value })} /></Field>
                <ResponsablesPicker value={d.responsables} onChange={(v) => update(d.id, { responsables: v })} />
              </div>
              {!isSpecialType(d.tipoDocumento) && (
                <div style={{ marginTop: 8 }}>
                  <input className="ec-input" placeholder="Referencia / descripción" value={d.referencia || ""} onChange={(e) => update(d.id, { referencia: e.target.value })} />
                </div>
              )}

              {(isEscaneo(d.tipoDocumento) || isReconstruccion(d.tipoDocumento)) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Marca y modelo"><input className="ec-input" style={{ width: 160 }} value={d.vehiculo || ""} onChange={(e) => update(d.id, { vehiculo: e.target.value })} /></Field>
                  <Field label="Padrón"><input className="ec-input" style={{ width: 120 }} value={d.padron || ""} onChange={(e) => update(d.id, { padron: e.target.value })} /></Field>
                </div>
              )}

              {isSAS(d.tipoDocumento) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.documentacionPedida} onChange={() => update(d.id, { documentacionPedida: !d.documentacionPedida })} /> Documentación pedida</label>
                </div>
              )}

              {!modoSimple && !isSpecialType(d.tipoDocumento) && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.elaborado} onChange={() => update(d.id, { elaborado: !d.elaborado })} /> Elaborado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.revisado} onChange={() => update(d.id, { revisado: !d.revisado })} /> Revisado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.entregado} onChange={() => update(d.id, { entregado: !d.entregado })} /> Entregado</label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><Check checked={d.cobrado} onChange={() => update(d.id, { cobrado: !d.cobrado })} /> Cobrado</label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, alignItems: "center", fontSize: 12.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: C.muted }}>Pelota:</span>
                      <select className="ec-select" style={{ width: "auto" }} value={d.quienPelota} onChange={(e) => update(d.id, { quienPelota: e.target.value })}>{QUIEN_PELOTA.map((q) => <option key={q}>{q}</option>)}</select>
                    </label>
                  </div>
                </>
              )}

              {!modoSimple && (pending || !isSpecialType(d.tipoDocumento)) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: dueReminder ? C.wax : C.muted, fontWeight: dueReminder ? 700 : 400 }}>Próxima fecha clave:</span>
                    <input className="ec-input" style={{ width: 140 }} type="date" value={d.fechaRecordatorio || ""} onChange={(e) => update(d.id, { fechaRecordatorio: e.target.value })} />
                    {dueReminder && <span style={{ color: C.wax }}>⚠</span>}
                  </label>
                </div>
              )}
              {!modoSimple && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <PrioridadPicker value={d.prioridad} onChange={(v) => update(d.id, { prioridad: v })} />
                </div>
              )}

              <div style={{ marginTop: 8 }}>
                <input className="ec-input" placeholder="Observaciones" value={d.observaciones || ""} onChange={(e) => update(d.id, { observaciones: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== TAB: INMUEBLES ============================== */
function Inmuebles({ inmuebles, setInmuebles, modoSimple, prontos, setProntos }) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const blank = () => ({ id: uid(), fecha: todayISO(), tipoInmueble: TIPOS_INMUEBLE[0], cliente: "", padron: "", responsables: ["Dahiana"], numeroIngreso: "", pin: "", telefonoComprador: "", telefonoVendedor: "", telefonoEscribano: "", cedulas: false, titulos: false, plano: false, contribucion: false, primaria: false, informacionCatastral: false, proyecto: false, actosPersonales: false, certificadoPropiedad: false, certificadoComercioPrenda: false, primeraCopia: false, impuestos: false, ofrecimiento: false, art358: false, colonizacion: false, mineria: false, inscripcion: "no_pedido", etapa: ETAPAS_INMUEBLE[0], estado: "Pendiente", quienPelota: QUIEN_PELOTA[0], proximaAccion: "", fechaRecordatorio: "", prioridad: "", observaciones: "", fechaFinalizado: null, enProntos: false });
  const [form, setForm] = useState(blank());

  const filtered = inmuebles.filter((i) =>
    !isCompletedInmueble(i) &&
    (!search || `${i.cliente} ${i.padron}`.toLowerCase().includes(search.toLowerCase())) &&
    (!filters.responsable || responsableMatches(i.responsables, filters.responsable)) &&
    (!filters.estado || i.estado === filters.estado)
  ).sort(porPrioridad);
  const save = () => { const i = { ...form }; if (isCompletedInmueble(i)) i.fechaFinalizado = todayISO(); setInmuebles([i, ...inmuebles]); setForm(blank()); setAdding(false); };
  const update = (id, patch) => setInmuebles(inmuebles.map((i) => {
    if (i.id !== id) return i;
    const next = { ...i, ...patch };
    const was = isCompletedInmueble(i), now = isCompletedInmueble(next);
    if (now && !was) next.fechaFinalizado = todayISO();
    if (!now && was) next.fechaFinalizado = null;
    if (next.etapa === "Pronto para firma" && i.etapa !== "Pronto para firma" && !next.enProntos) {
      next.enProntos = true;
      setProntos([...prontos, { id: uid(), cliente: next.cliente, auto: `Padrón ${next.padron || "—"}`, observaciones: next.observaciones || "" }]);
    }
    return next;
  }));
  const remove = (id) => setInmuebles(inmuebles.filter((i) => i.id !== id));
  const isEtapaTardia = (etapa) => !ETAPAS_INMUEBLE_TEMPRANAS.includes(etapa);
  const soloRegistro = (etapa) => etapa === "Llegó la documentación";

  const baseChecklistKeys = [["cedulas", "Cédulas"], ["titulos", "Títulos"], ["plano", "Plano"], ["contribucion", "Contribución"], ["primaria", "Primaria"], ["informacionCatastral", "Caracterización urbana"], ["proyecto", "Proyecto"], ["actosPersonales", "Actos personales"], ["certificadoPropiedad", "Cert. de propiedad"], ["certificadoComercioPrenda", "Cert. de comercio o prenda"], ["primeraCopia", "Primera copia"], ["impuestos", "Pago de impuestos"]];
  const ruralChecklistKeys = [["ofrecimiento", "Ofrecimiento"], ["art358", "Art. 358"], ["colonizacion", "Colonización"], ["mineria", "Minería"]];
  const checklistKeysFor = (tipoInmueble) => (tipoInmueble === "Rural" ? [...baseChecklistKeys, ...ruralChecklistKeys] : baseChecklistKeys);

  return (
    <div className="ec-fade">
      <Header title="Inmuebles" subtitle="Seguimiento por cliente y padrón, con checklist y etapa." onAdd={() => setAdding(true)} />
      <AddPanel open={adding} onClose={() => setAdding(false)} title="Nuevo inmueble">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Tipo"><select className="ec-select" value={form.tipoInmueble} onChange={(e) => setForm({ ...form, tipoInmueble: e.target.value })}>{TIPOS_INMUEBLE.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Cliente"><input className="ec-input" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Padrón"><input className="ec-input" value={form.padron} onChange={(e) => setForm({ ...form, padron: e.target.value })} /></Field>
          <Field label="Responsable(s)"><ResponsablesPicker value={form.responsables} onChange={(v) => setForm({ ...form, responsables: v })} /></Field>
          <Field label="Etapa"><select className="ec-select" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>{ETAPAS_INMUEBLE.map((t) => <option key={t}>{t}</option>)}</select></Field>
          {isEtapaTardia(form.etapa) && !soloRegistro(form.etapa) && (
            <Field label="Estado"><select className="ec-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          )}
          {isEtapaTardia(form.etapa) && (
            <>
              <Field label="Número de ingreso"><input className="ec-input" value={form.numeroIngreso} onChange={(e) => setForm({ ...form, numeroIngreso: e.target.value })} /></Field>
              <Field label="PIN"><input className="ec-input" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></Field>
            </>
          )}
          {!modoSimple && !soloRegistro(form.etapa) && (
            <>
              <Field label="Próxima acción"><input className="ec-input" value={form.proximaAccion} onChange={(e) => setForm({ ...form, proximaAccion: e.target.value })} /></Field>
              <Field label="Próxima fecha clave"><input className="ec-input" type="date" value={form.fechaRecordatorio} onChange={(e) => setForm({ ...form, fechaRecordatorio: e.target.value })} /></Field>
            </>
          )}
          {!modoSimple && (
            <>
              <Field label="Teléfono comprador"><input className="ec-input" value={form.telefonoComprador} onChange={(e) => setForm({ ...form, telefonoComprador: e.target.value })} /></Field>
              <Field label="Teléfono vendedor"><input className="ec-input" value={form.telefonoVendedor} onChange={(e) => setForm({ ...form, telefonoVendedor: e.target.value })} /></Field>
              <Field label="Teléfono escribano"><input className="ec-input" value={form.telefonoEscribano} onChange={(e) => setForm({ ...form, telefonoEscribano: e.target.value })} /></Field>
            </>
          )}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Field label="Observaciones"><input className="ec-input" placeholder="Qué falta / en qué situación estamos" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        {!modoSimple && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
            {checklistKeysFor(form.tipoInmueble).map(([k, label]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
        )}
        <button className="ec-btn" onClick={save}><Plus size={14} /> Guardar inmueble</button>
      </AddPanel>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 320, flex: "1 1 240px" }}>
          <Search size={14} color={C.muted} />
          <input className="ec-input" placeholder="Buscar por cliente o padrón…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FilterBar filters={filters} setFilters={setFilters} options={[
          { key: "responsable", label: "Responsable", values: RESPONSABLES },
          { key: "estado", label: "Estado", values: ESTADOS },
        ]} />
      </div>

      <TriLegend />
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.length === 0 && <div className="ec-card" style={{ padding: 24, textAlign: "center", color: C.muted }}>No se encontraron inmuebles.</div>}
        {filtered.map((i) => {
          const keys = checklistKeysFor(i.tipoInmueble);
          const done = keys.filter(([k]) => i[k]).length;
          const overdue = isOverdue(i.fechaRecordatorio, i.estado);
          return (
            <div key={i.id} className="ec-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
                  <input className="ec-input" style={{ width: 150, fontWeight: 700 }} placeholder="Cliente" value={i.cliente || ""} onChange={(e) => update(i.id, { cliente: e.target.value })} />
                  <Field label="Padrón"><input className="ec-input" style={{ width: 100 }} value={i.padron || ""} onChange={(e) => update(i.id, { padron: e.target.value })} /></Field>
                  <span className="ec-badge" style={{ background: C.paper2, color: i.tipoInmueble === "Rural" ? C.bottle : C.brass }}>{i.tipoInmueble || "Urbano"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {isEtapaTardia(i.etapa) && !soloRegistro(i.etapa) && (
                    <select className="ec-select" style={{ width: "auto" }} value={i.estado} onChange={(e) => update(i.id, { estado: e.target.value })}>
                      {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                  <button onClick={() => remove(i.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <ResponsablesPicker value={i.responsables} onChange={(v) => update(i.id, { responsables: v })} />
              </div>
              {!modoSimple && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                    {keys.map(([k, label]) => (
                      <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: i[k] ? C.bottle : C.muted }}>
                        <Check checked={i[k]} onChange={() => update(i.id, { [k]: !i[k] })} /> {label}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}><TriStatus value={i.inscripcion} onChange={(v) => update(i.id, { inscripcion: v })} /> Inscripción</label>
                  </div>
                </>
              )}
              {isEtapaTardia(i.etapa) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Número de ingreso"><input className="ec-input" style={{ width: 160 }} value={i.numeroIngreso || ""} onChange={(e) => update(i.id, { numeroIngreso: e.target.value })} /></Field>
                  <Field label="PIN"><input className="ec-input" style={{ width: 120 }} value={i.pin || ""} onChange={(e) => update(i.id, { pin: e.target.value })} /></Field>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  {modoSimple ? (
                    <input className="ec-input" placeholder="Qué falta / en qué situación estamos" value={i.observaciones || ""} onChange={(e) => update(i.id, { observaciones: e.target.value })} />
                  ) : (
                    <div style={{ height: 5, background: C.paper2, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(done / keys.length) * 100}%`, background: C.brass }} />
                    </div>
                  )}
                </div>
                <select className="ec-select" style={{ width: "auto" }} value={i.etapa} onChange={(e) => update(i.id, { etapa: e.target.value })}>
                  {ETAPAS_INMUEBLE.map((e) => <option key={e}>{e}</option>)}
                </select>
                {!modoSimple && !soloRegistro(i.etapa) && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ color: overdue ? C.wax : C.muted, fontWeight: overdue ? 700 : 400 }}>Próx.: {i.proximaAccion || "—"} —</span>
                      <input className="ec-input" style={{ width: 140 }} type="date" value={i.fechaRecordatorio || ""} onChange={(e) => update(i.id, { fechaRecordatorio: e.target.value })} />
                      {overdue && <span style={{ color: C.wax }}>⚠</span>}
                    </label>
                    <PrioridadPicker value={i.prioridad} onChange={(v) => update(i.id, { prioridad: v })} />
                  </>
                )}
              </div>
              {!modoSimple && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <Field label="Teléfono comprador"><input className="ec-input" style={{ width: 150 }} value={i.telefonoComprador || ""} onChange={(e) => update(i.id, { telefonoComprador: e.target.value })} /></Field>
                  <Field label="Teléfono vendedor"><input className="ec-input" style={{ width: 150 }} value={i.telefonoVendedor || ""} onChange={(e) => update(i.id, { telefonoVendedor: e.target.value })} /></Field>
                  <Field label="Teléfono escribano"><input className="ec-input" style={{ width: 150 }} value={i.telefonoEscribano || ""} onChange={(e) => update(i.id, { telefonoEscribano: e.target.value })} /></Field>
                </div>
              )}
              {!modoSimple && (
                <div style={{ marginTop: 10 }}>
                  <input className="ec-input" placeholder="Observaciones — información importante" value={i.observaciones || ""} onChange={(e) => update(i.id, { observaciones: e.target.value })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== TAB: EXCELENCIA ============================== */
function Excelencia({ excelLog, setExcelLog, autos, documentos, inmuebles, observados, setTab }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const blank = () => ({ id: uid(), fecha: todayISO(), resenas: 0, resenasNegativas: 0, observaciones: "" });
  const [form, setForm] = useState(blank());
  const [adding, setAdding] = useState(false);

  const monthEntries = excelLog.filter((e) => e.fecha?.slice(0, 7) === month).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const totals = useMemo(() => {
    const t = { inmuebles: 0, protocolizaciones: 0, sucesiones: 0, resenas: 0, certificados: 0, docsControlados: 0, docsObservados: 0, resenasNegativas: 0, certObservados: 0 };
    monthEntries.forEach((e) => Object.keys(t).forEach((k) => { t[k] += Number(e[k] || 0); }));
    const auto = computeAutoTotals(autos, documentos, inmuebles, observados, month);
    t.inmuebles += auto.inmuebles; t.protocolizaciones += auto.protocolizaciones; t.sucesiones += auto.sucesiones; t.certificados += auto.certificados;
    t.docsControlados += auto.docsControlados; t.docsObservados += auto.docsObservados; t.certObservados += auto.certObservados;
    return t;
  }, [monthEntries, autos, documentos, inmuebles, observados, month]);
  const score = computeScore(totals);
  const autosObservadosTotal = (observados || []).filter((o) => o.sector !== "Documentos").length;
  const autosObservadosEsteMes = (observados || []).filter((o) => o.sector !== "Documentos" && o.fecha?.slice(0, 7) === month).length;

  const save = () => { setExcelLog([{ ...form }, ...excelLog]); setForm(blank()); setAdding(false); };
  const remove = (id) => setExcelLog(excelLog.filter((e) => e.id !== id));

  const numFields = [["resenas", "Reseñas"], ["resenasNegativas", "Reseñas negativas"]];

  const [expandedCat, setExpandedCat] = useState(null);

  const drillDownLists = {
    inmuebles: inmuebles.filter((i) => isCompletedInmueble(i) && i.fechaFinalizado?.slice(0, 7) === month).map((i) => ({ key: i.id, cliente: i.cliente, detalle: `Padrón ${i.padron || "—"}`, responsable: responsablesLabel(i.responsables), tab: "inmuebles" })),
    protocolizaciones: autos.filter((a) => isCompletedAuto(a) && a.fechaFinalizado?.slice(0, 7) === month).map((a) => ({ key: a.id, cliente: a.cliente, detalle: `${a.marcaModelo || a.tipo || "—"}${a.padron ? " · Padrón " + a.padron : ""}`, responsable: responsablesLabel(a.responsables), tab: "autos" })),
    sucesiones: documentos.filter((d) => isCompletedDocumento(d) && d.fechaFinalizado?.slice(0, 7) === month && scoreCategoryForDocumento(d) === "sucesiones").map((d) => ({ key: d.id, cliente: d.cliente, detalle: d.tipoDocumento, responsable: responsablesLabel(d.responsables), tab: "documentos" })),
    certificados: documentos.filter((d) => isCompletedDocumento(d) && d.fechaFinalizado?.slice(0, 7) === month && scoreCategoryForDocumento(d) === "certificados").map((d) => ({ key: d.id, cliente: d.cliente, detalle: d.tipoDocumento, responsable: responsablesLabel(d.responsables), tab: "documentos" })),
  };

  const scoreRows = [
    ["Inmuebles", totals.inmuebles, "15 pts c/u · automático", score.inmueblesPts, "inmuebles"],
    ["Protocolizaciones", totals.protocolizaciones, "90/100/110/120+ · automático", score.protocolizacionesPts, "protocolizaciones"],
    ["Sucesiones/Poder/SAS", totals.sucesiones, "5 pts c/u · automático", score.sucesionesPts, "sucesiones"],
    ["Reseñas en Google", totals.resenas, "5 / 10 · manual", score.resenasPts, null],
    ["Certificados+testimonios", totals.certificados, "15/20/25+ · automático", score.certificadosPts, "certificados"],
    ["Calidad documental (% compraventas observadas)", score.pctObs !== null ? `${score.pctObs.toFixed(1)}%` : "sin datos", `≤5% / ≤10% · este mes ${autosObservadosEsteMes} / total abiertos ${autosObservadosTotal}`, score.calidadPts, null],
    ["Penalización calidad (≥15% obs.)", "—", "-10 una vez/mes", score.calidadPenalty, null],
    ["Reseñas negativas", totals.resenasNegativas, "-10 c/u · manual", score.resenasNegPenalty, null],
    ["Certificados observados", totals.certObservados, "-5 c/u · automático", score.certObsPenalty, null],
  ];

  return (
    <div className="ec-fade">
      <Header title="Excelencia Operativa" subtitle="Inmuebles, protocolizaciones, sucesiones y certificados se suman automáticamente al finalizar la tarea. Reseñas y control de calidad se cargan a mano." onAdd={() => setAdding(true)} addLabel="Cargar día" />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>Mes:</span>
        <input className="ec-input" style={{ width: 160 }} type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <AddPanel open={adding} onClose={() => setAdding(false)} title="Registro diario del equipo">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          <Field label="Fecha"><input className="ec-input" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          {numFields.map(([k, label]) => (
            <Field key={k} label={label}><input className="ec-input" type="number" min="0" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} /></Field>
          ))}
          <Field label="Observaciones"><input className="ec-input" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 12 }}><button className="ec-btn" onClick={save}><Plus size={14} /> Guardar registro</button></div>
      </AddPanel>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, marginBottom: 20 }}>
        <div className="ec-card" style={{ padding: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Seal nivel={score.nivel} size={160} />
          <div className="ec-mono" style={{ fontSize: 24, fontWeight: 600 }}>{score.total} pts</div>
          <div style={{ fontSize: 11.5, color: C.muted, textAlign: "center" }}>
            {NIVELES.slice().reverse().map((n) => `${n.name} ${n.min}+`).join("  ·  ")}
          </div>
        </div>
        <div className="ec-card" style={{ padding: "6px 0" }}>
          <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
            <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Desglose del puntaje — {month}</span>
          </div>
          <table className="ec-table">
            <thead><tr><th>Categoría</th><th>Acumulado</th><th>Referencia</th><th>Puntos</th></tr></thead>
            <tbody>
              {scoreRows.map((r) => (
                <React.Fragment key={r[0]}>
                  <tr onClick={() => r[4] && setExpandedCat(expandedCat === r[4] ? null : r[4])} style={{ cursor: r[4] ? "pointer" : "default" }}>
                    <td>{r[0]} {r[4] && (expandedCat === r[4] ? <ChevronDown size={12} style={{ display: "inline", verticalAlign: "middle" }} /> : <ChevronRight size={12} style={{ display: "inline", verticalAlign: "middle" }} />)}</td>
                    <td className="ec-mono">{r[1]}</td><td style={{ color: C.muted, fontSize: 12 }}>{r[2]}</td>
                    <td className="ec-mono" style={{ fontWeight: 700, color: r[3] < 0 ? C.wax : C.ink }}>{r[3] > 0 ? "+" : ""}{r[3]}</td>
                  </tr>
                  {expandedCat === r[4] && r[4] && (
                    <tr>
                      <td colSpan={4} style={{ background: C.paper3, padding: 0 }}>
                        {drillDownLists[r[4]].length === 0 ? (
                          <div style={{ padding: 12, color: C.muted, fontSize: 12.5 }}>Nada sumó en esta categoría en {month}.</div>
                        ) : (
                          <div>
                            {drillDownLists[r[4]].map((it) => (
                              <div key={it.key} onClick={() => setTab && setTab(it.tab)} style={{ display: "flex", gap: 12, padding: "8px 16px", borderTop: `1px solid ${C.line}`, cursor: setTab ? "pointer" : "default", fontSize: 12.5 }}>
                                <span style={{ fontWeight: 600, flex: 1 }}>{it.cliente || "—"}</span>
                                <span style={{ color: C.muted, flex: 1 }}>{it.detalle}</span>
                                <span style={{ color: C.muted }}>{it.responsable}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>TOTAL</td><td className="ec-mono" style={{ fontWeight: 700, fontSize: 15 }}>{score.total}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="ec-card ec-scroll" style={{ overflowX: "auto" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1.5px solid ${C.ink}` }}>
          <span className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Registro diario</span>
        </div>
        <table className="ec-table">
          <thead><tr><th>Fecha</th>{numFields.map(([k, l]) => <th key={k}>{l}</th>)}<th>Obs.</th><th></th></tr></thead>
          <tbody>
            {monthEntries.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: C.muted }}>Sin registros este mes.</td></tr>}
            {monthEntries.map((e) => (
              <tr key={e.id}>
                <td className="ec-mono">{fmtDate(e.fecha)}</td>
                {numFields.map(([k]) => <td key={k} className="ec-mono">{e[k]}</td>)}
                <td>{e.observaciones || "—"}</td>
                <td><button onClick={() => remove(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== TAB: MANUAL ============================== */
/* ============================== TAB: TRABAJOS (unificado) ============================== */
function Trabajos({ autos, setAutos, documentos, setDocumentos, inmuebles, setInmuebles, setTab, initialFilters, observados, setObservados }) {
  const [filters, setFilters] = useState(initialFilters || {});
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState("");

  const items = useMemo(() => {
    const a = autos.map((x) => ({ key: "auto-" + x.id, rawId: x.id, origen: "Auto", tipo: `${x.marcaModelo || x.tipo || "—"}${x.padron ? " · Padrón " + x.padron : ""}`, cliente: x.cliente, responsables: [...new Set([...(x.responsables || []), ...(x.responsablesProtocolizacion || [])])], estado: x.estado, prioridad: x.prioridad, fecha: x.fecha, tab: "autos", extra: (x.numeroIngreso || x.pin) ? `Ingreso ${x.numeroIngreso || "—"} · PIN ${x.pin || "—"}` : "", padron: x.padron, marcaModelo: x.marcaModelo, numeroIngreso: x.numeroIngreso, pin: x.pin }));
    const d = documentos.map((x) => ({ key: "doc-" + x.id, rawId: x.id, origen: "Documento", tipo: x.tipoDocumento, cliente: x.cliente, responsables: x.responsables, estado: documentoEstadoLabel(x), prioridad: x.prioridad, fecha: x.fecha, tab: "documentos", extra: "", tipoDocumento: x.tipoDocumento }));
    const i = inmuebles.map((x) => ({ key: "inm-" + x.id, rawId: x.id, origen: "Inmueble", tipo: `Padrón ${x.padron || "—"}`, cliente: x.cliente, responsables: x.responsables, estado: x.estado, prioridad: x.prioridad, fecha: x.fecha, tab: "inmuebles", extra: (x.numeroIngreso || x.pin) ? `Ingreso ${x.numeroIngreso || "—"} · PIN ${x.pin || "—"}` : "" }));
    const rank = { Alta: 0, Media: 1, Baja: 2, "": 3 };
    return [...a, ...d, ...i].sort((p, q) => (rank[p.prioridad || ""] - rank[q.prioridad || ""]) || (q.fecha || "").localeCompare(p.fecha || ""));
  }, [autos, documentos, inmuebles]);

  const yaObservado = (it) => (observados || []).some((o) => o.vinculoId === it.rawId);
  const observadoDe = (it) => (observados || []).find((o) => o.vinculoId === it.rawId);
  const quitarObservado = (it) => setObservados((observados || []).filter((o) => o.vinculoId !== it.rawId));
  const eliminarTrabajo = (it) => {
    if (it.origen === "Auto") setAutos(autos.filter((a) => a.id !== it.rawId));
    else if (it.origen === "Documento") setDocumentos(documentos.filter((d) => d.id !== it.rawId));
    else if (it.origen === "Inmueble") setInmuebles(inmuebles.filter((i) => i.id !== it.rawId));
  };
  const marcarObservado = (it) => {
    if (yaObservado(it)) return;
    if (it.origen === "Auto") {
      setObservados([...(observados || []), { id: uid(), fecha: todayISO(), sector: "Automotores", vinculoId: it.rawId, cliente: it.cliente, padron: it.padron || "", marcaModelo: it.marcaModelo || "", numeroIngreso: it.numeroIngreso || "", pin: it.pin || "", documento: "", queSeObservo: "", estado: ESTADOS_OBSERVADO[0], prioridad: "" }]);
    } else if (it.origen === "Documento") {
      setObservados([...(observados || []), { id: uid(), fecha: todayISO(), sector: "Documentos", vinculoId: it.rawId, cliente: it.cliente, padron: "", marcaModelo: "", numeroIngreso: "", pin: "", documento: it.tipoDocumento || "", queSeObservo: "", estado: ESTADOS_OBSERVADO[0], prioridad: "" }]);
    }
  };

  const filtered = items.filter((it) =>
    (!filters.responsable || responsableMatches(it.responsables, filters.responsable)) &&
    (!filters.origen || it.origen === filters.origen) &&
    (!filters.estado || it.estado === filters.estado) &&
    (!filters.prioridad || it.prioridad === filters.prioridad) &&
    (!mes || it.fecha?.slice(0, 7) === mes) &&
    (!search || `${it.cliente} ${it.tipo}`.toLowerCase().includes(search.toLowerCase()))
  );

  const todosLosEstados = [...new Set([...ESTADOS_AUTO, ...ESTADOS, ...ESTADOS_PODER, ...ESTADOS_SUCESION, ...ESTADOS_SAS, ...ESTADOS_ESCANEO, ...ESTADOS_RECONSTRUCCION])];

  return (
    <div className="ec-fade">
      <Header title="Todos los trabajos" subtitle="Autos, documentos e inmuebles en un solo lugar, filtrable por responsable." />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 280, flex: "1 1 220px" }}>
          <Search size={14} color={C.muted} />
          <input className="ec-input" placeholder="Buscar por cliente, padrón o marca y modelo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input className="ec-input" style={{ width: 150 }} type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        {mes && <button className="ec-btn-ghost" onClick={() => setMes("")}><X size={13} /> Mes</button>}
        <FilterBar filters={filters} setFilters={setFilters} options={[
          { key: "responsable", label: "Responsable", values: RESPONSABLES },
          { key: "origen", label: "Tipo", values: ["Auto", "Documento", "Inmueble"] },
          { key: "estado", label: "Estado", values: todosLosEstados },
          { key: "prioridad", label: "Prioridad", values: PRIORIDADES },
        ]} />
      </div>

      <div className="ec-card ec-scroll" style={{ overflowX: "auto" }}>
        <table className="ec-table">
          <thead><tr><th>Origen</th><th>Cliente</th><th>Detalle</th><th>Ingreso / PIN</th><th>Responsable</th><th>Estado</th><th>Prioridad</th><th>Fecha</th><th></th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: C.muted }}>No hay trabajos que coincidan con el filtro.</td></tr>}
            {filtered.map((it) => (
              <tr key={it.key} onClick={() => setTab(it.tab)} style={{ cursor: "pointer" }}>
                <td><span className="ec-badge" style={{ background: C.paper2, color: C.brass }}>{it.origen}</span></td>
                <td>{it.cliente || "—"}</td>
                <td>{it.tipo}</td>
                <td style={{ color: C.muted, fontSize: 12 }}>{it.extra || "—"}</td>
                <td>{responsablesLabel(it.responsables)}</td>
                <td><EstadoBadge estado={it.estado} /></td>
                <td>{it.prioridad ? <span style={{ color: PRIORIDAD_COLOR[it.prioridad], fontWeight: it.prioridad === "Alta" ? 700 : 500 }}>{it.prioridad}</span> : <span style={{ color: C.muted }}>—</span>}</td>
                <td className="ec-mono">{fmtDate(it.fecha)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {it.origen !== "Inmueble" && (
                    yaObservado(it) ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Observado</span>
                        <button onClick={() => quitarObservado(it)} title="Eliminar de Documentos observados" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", padding: 0 }}>
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => marcarObservado(it)} className="ec-btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }}>Marcar observado</button>
                    )
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => eliminarTrabajo(it)} title="Eliminar este trabajo" style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", padding: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ec-card" style={{ padding: "6px 0", marginTop: 18 }}>
        <DocumentosObservados observados={observados} setObservados={setObservados} autos={autos} documentos={documentos} />
      </div>
    </div>
  );
}

function Manual() {
  const [openId, setOpenId] = useState(PROCEDURES[0].id);
  const [q, setQ] = useState("");
  const filtered = PROCEDURES.map((p) => ({
    ...p,
    steps: p.steps.filter((s) => !q || s.toLowerCase().includes(q.toLowerCase())),
  })).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.steps.length > 0);

  return (
    <div className="ec-fade">
      <Header title="Manual de procedimientos" subtitle="Referencia rápida por área de trabajo." />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, maxWidth: 360 }}>
        <Search size={14} color={C.muted} />
        <input className="ec-input" placeholder="Buscar en el manual…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="ec-card" style={{ padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="ec-serif" style={{ fontWeight: 700, fontSize: 14.5 }}>Nico Cavallo</div>
          <div style={{ fontSize: 12, color: C.muted }}>Ubicación del estudio</div>
        </div>
        <a href="https://maps.google.com/?q=-34.891102,-56.109699" target="_blank" rel="noreferrer" className="ec-btn-ghost" style={{ textDecoration: "none" }}>Ver en Google Maps</a>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((p) => {
          const Icon = p.icon;
          const isOpen = openId === p.id || !!q;
          return (
            <div key={p.id} className="ec-card">
              <button onClick={() => setOpenId(isOpen && !q ? null : p.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={17} color={C.brass} />
                  <span className="ec-serif" style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>({p.steps.length} pasos)</span>
                </div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              {isOpen && (
                <ol style={{ margin: 0, padding: "0 20px 16px 40px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {p.steps.map((s, idx) => (
                    <li key={idx} style={{ fontSize: 13.5, lineHeight: 1.55 }}>{s}</li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== SHARED HEADER ============================== */
function Header({ title, subtitle, onAdd, addLabel = "Agregar" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <div>
        <h1 className="ec-serif" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12.5, color: C.muted, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {onAdd && <button className="ec-btn" onClick={onAdd}><Plus size={14} /> {addLabel}</button>}
    </div>
  );
}

/* ============================== APP ============================== */
/* Exporta todas las tablas del sistema a un único archivo Excel, como respaldo */
function exportToExcel({ autos, documentos, inmuebles, excelLog, observados, agenda, prontos, proximosFirmar }) {
  const wb = XLSX.utils.book_new();
  const addSheet = (name, rows) => {
    const clean = (rows || []).map((r) => {
      const { fechaFinalizado, enProntos, ...rest } = r;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean.length ? clean : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  addSheet("Autos", autos);
  addSheet("Documentos", documentos);
  addSheet("Inmuebles", inmuebles);
  addSheet("Excelencia-Registro", excelLog);
  addSheet("Documentos Observados", observados);
  addSheet("Agenda de Firmas", agenda);
  addSheet("Prontos para Agendar", prontos);
  addSheet("Inmuebles Prox a Firmar", proximosFirmar);
  XLSX.writeFile(wb, `EstudioCavallo_backup_${todayISO()}.xlsx`);
}

/* Respaldo/restauración exacta (sin pérdida de datos) en JSON, vía copiar/pegar texto
   (evita el bloqueo de descargas de archivos dentro del artefacto) */
function buildBackupJSON({ autos, documentos, inmuebles, excelLog, observados, agenda, prontos, proximosFirmar }) {
  const data = { autos, documentos, inmuebles, excelLog, observados, agenda, prontos, proximosFirmar, exportadoEl: todayISO() };
  return JSON.stringify(data, null, 2);
}
function applyBackupJSON(text, setters) {
  const data = JSON.parse(text);
  if (data.autos) setters.setAutos(data.autos);
  if (data.documentos) setters.setDocumentos(data.documentos);
  if (data.inmuebles) setters.setInmuebles(data.inmuebles);
  if (data.excelLog) setters.setExcelLog(data.excelLog);
  if (data.observados) setters.setObservados(data.observados);
  if (data.agenda) setters.setAgenda(data.agenda);
  if (data.prontos) setters.setProntos(data.prontos);
  if (data.proximosFirmar) setters.setProximosFirmar(data.proximosFirmar);
}
function BackupPanel({ state, setters }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("copiar"); // "copiar" | "restaurar"
  const [pasteText, setPasteText] = useState("");
  const [msg, setMsg] = useState("");
  const backupText = buildBackupJSON(state);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(backupText);
      setMsg("Copiado al portapapeles. Pegalo en una nota o mensaje para guardarlo.");
    } catch (e) {
      setMsg("No se pudo copiar solo — seleccioná el texto de abajo a mano y copialo (Ctrl/Cmd+C).");
    }
  };
  const restaurar = () => {
    try {
      applyBackupJSON(pasteText, setters);
      setMsg("¡Restaurado correctamente!");
      setPasteText("");
    } catch (e) {
      setMsg("No se pudo leer ese texto. Verificá que sea un respaldo copiado completo desde este mismo sistema.");
    }
  };

  return (
    <>
      <button onClick={() => { setOpen(true); setMode("copiar"); setMsg(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.brassLight, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
        <Download size={13} /> Respaldo
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setOpen(false)}>
          <div className="ec-card" style={{ background: C.white, maxWidth: 560, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="ec-serif" style={{ fontWeight: 700, fontSize: 16 }}>Respaldo de datos</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className={`ec-chip ${mode === "copiar" ? "active" : ""}`} onClick={() => { setMode("copiar"); setMsg(""); }}>Copiar respaldo</button>
              <button className={`ec-chip ${mode === "restaurar" ? "active" : ""}`} onClick={() => { setMode("restaurar"); setMsg(""); }}>Restaurar respaldo</button>
            </div>
            {mode === "copiar" ? (
              <>
                <p style={{ fontSize: 12.5, color: C.muted, marginTop: 0 }}>Guardá este texto en una nota, mail o documento. Sirve para restaurar todos los datos si algo se pierde.</p>
                <button className="ec-btn" onClick={copiar} style={{ marginBottom: 10 }}>Copiar al portapapeles</button>
                <textarea readOnly value={backupText} onClick={(e) => e.target.select()} style={{ width: "100%", height: 220, fontFamily: "monospace", fontSize: 11, padding: 8, border: `1px solid ${C.line}`, borderRadius: 4 }} />
              </>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: C.muted, marginTop: 0 }}>Pegá acá el texto de un respaldo copiado antes, y apretá Restaurar.</p>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Pegá el respaldo acá…" style={{ width: "100%", height: 220, fontFamily: "monospace", fontSize: 11, padding: 8, border: `1px solid ${C.line}`, borderRadius: 4, marginBottom: 10 }} />
                <button className="ec-btn" onClick={restaurar} disabled={!pasteText}>Restaurar</button>
              </>
            )}
            {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: C.bottle, fontWeight: 600 }}>{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}


/* ============================== DATOS INICIALES (respaldo del 2026-08-03) ==============================
   Se usan solo la PRIMERA vez que se abre un link nuevo/vacío. Si ya hay datos guardados
   (aunque sea un array vacío ya guardado), estos valores se ignoran por completo. */
const SEED_AUTOS = [{"id": "ylvcslm4", "fecha": "2026-08-03", "cliente": "DIEGO NUÑEZ", "telefono": "", "financiado": false, "matricula": "SCQ3872", "padron": "1018655", "marcaModelo": "PEUGEOT 307", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Llegó del registro", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "PERMUTA 2008", "fechaFinalizado": null, "enProntos": false}, {"id": "2xjguxu6", "fecha": "2026-08-03", "cliente": "DIEGO NUÑEZ", "telefono": "", "financiado": false, "matricula": "ERB5875", "padron": "903232102", "marcaModelo": "PEUGEOT 2008", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pronto para firma", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": true}, {"id": "kmq6uj8x", "fecha": "2026-08-03", "cliente": "CALIFANO", "telefono": "", "financiado": false, "matricula": "SAU2972", "padron": "438308", "marcaModelo": "DAIHATSU APPLAUSE", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Para protocolizar", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "ijlkrgfc", "fecha": "2026-08-03", "cliente": "MANU", "telefono": "", "financiado": false, "matricula": "KDB2648", "padron": "901648294", "marcaModelo": "VW AMAROK", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "d7pyqde1", "fecha": "2026-08-03", "cliente": "MANU", "telefono": "", "financiado": false, "matricula": "IAG8903", "padron": "902952964", "marcaModelo": "VW AMAROK", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "jpn05pfc", "fecha": "2026-08-03", "cliente": "BALARINI", "telefono": "", "financiado": false, "matricula": "MAK1262", "padron": "903677095", "marcaModelo": "BYD YUAN PLUS", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "FALTAN DATOS DE SA", "fechaFinalizado": null, "enProntos": false}, {"id": "9hfql9fp", "fecha": "2026-08-03", "cliente": "BALARINI", "telefono": "", "financiado": false, "matricula": "BED4388", "padron": "903864053", "marcaModelo": "BYD SEAGULL", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Finalizado", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "2ieg7wsq", "fecha": "2026-08-03", "cliente": "BALARINI", "telefono": "", "financiado": false, "matricula": "SCT5836", "padron": "903468616", "marcaModelo": "VW NIVUS", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pronto para firma", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": true}, {"id": "ros8ul0l", "fecha": "2026-08-03", "cliente": "TOMAS", "telefono": "", "financiado": false, "matricula": "", "padron": "", "marcaModelo": "NISSAN KICKS", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "FALTA CONTROL PERSONERIA JURIDICA", "fechaFinalizado": null, "enProntos": false}, {"id": "pis3x8ay", "fecha": "2026-08-03", "cliente": "MARIO SAAVEDRA", "telefono": "", "financiado": false, "matricula": "", "padron": "", "marcaModelo": "SUZUKI SWIFT", "tipo": "Poder", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "FALTA DIVORCIO", "fechaFinalizado": null, "enProntos": false}, {"id": "p0jaskt1", "fecha": "2026-08-03", "cliente": "MANU", "telefono": "", "financiado": false, "matricula": "", "padron": "", "marcaModelo": "SURAN POR KWID", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pronto para firma", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": true}, {"id": "euvldt0f", "fecha": "2026-08-03", "cliente": "DIEGO NUÑEZ", "telefono": "", "financiado": false, "matricula": "", "padron": "", "marcaModelo": "ALTO POR ALTO", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pronto para firma", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": true}, {"id": "xfaoe6u3", "fecha": "2026-08-03", "cliente": "RAUL", "telefono": "098048443", "financiado": false, "matricula": "SCV6800", "padron": "903451479", "marcaModelo": "VW NIVUS", "tipo": "Compraventa", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "w8jp569o", "fecha": "2026-08-03", "cliente": "RAUL", "telefono": "", "financiado": false, "matricula": "BEC3224", "padron": "903214979", "marcaModelo": "VW GOLF", "tipo": "Submandato", "responsables": ["Alex", "Belén"], "responsablesProtocolizacion": [], "libreDePrenda": "no_pedido", "libreDeEmbargo": "no_pedido", "libreDeDeuda": "no_pedido", "certificadoSucive": "no_pedido", "matriculasRequeridas": "no_pedido", "documentoElaborado": "no_pedido", "cobrado": "no_pedido", "estado": "Pendiente", "numeroIngreso": "", "pin": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}];
const SEED_DOCUMENTOS = [{"id": "j3ask0cf", "fecha": "2026-08-03", "cliente": "EDUARDO CARTA DE PAGO", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null}, {"id": "6kimw77p", "fecha": "2026-08-03", "cliente": "ANDRES CALCAGNO", "telefono": "", "tipoDocumento": "Otro", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "ANV", "fechaFinalizado": null}, {"id": "dv4vdyu7", "fecha": "2026-08-03", "cliente": "JUAN CORREA", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "CRA", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null}, {"id": "zotpxk5o", "fecha": "2026-08-03", "cliente": "PIERRE", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "CRA", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "TRAMITE PARA BANCO", "fechaFinalizado": null}, {"id": "2zxvdzvd", "fecha": "2026-08-03", "cliente": "PIERRE", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Inscripción", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "TESTIMONIO PARA COBRO POR BANCO", "fechaFinalizado": null}, {"id": "fhc776gz", "fecha": "2026-08-03", "cliente": "LABARTHE", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "PRESUNTOS HEREDEROS PARA BANCO", "fechaFinalizado": null}, {"id": "0kfup2v1", "fecha": "2026-08-03", "cliente": "SANTO MAURO", "telefono": "", "tipoDocumento": "Sucesiones", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "CRA", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "LEVANTAR CRA", "fechaFinalizado": null}, {"id": "8g9jzu6x", "fecha": "2026-08-03", "cliente": "SANTIAGO HAM", "telefono": "", "tipoDocumento": "SAS", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "En trámite", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": true, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "COMPRAVENTA DE ACCIONES", "fechaFinalizado": null}, {"id": "qcxptcjw", "fecha": "2026-08-03", "cliente": "SERGIO BURGOS", "telefono": "", "tipoDocumento": "Certificado notarial", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "", "padron": "", "estadoEscaneo": "Pendiente", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "NOTARIAL PARA BPS", "fechaFinalizado": null}, {"id": "wvkhnpw2", "fecha": "2026-08-03", "cliente": "FELIPE HOUNIE", "telefono": "", "tipoDocumento": "Escaneo de documentación", "referencia": "", "responsables": ["Alex", "Belén"], "elaborado": false, "revisado": false, "entregado": false, "cobrado": false, "estado": "Pendiente", "estadoSucesion": "Recolectando información", "estadoPoder": "Recolectando datos", "vehiculo": "SUXUKI CELERIO", "padron": "902790408", "estadoEscaneo": "Finalizado", "estadoReconstruccion": "Pendiente", "documentacionPedida": false, "estadoSAS": "Falta documentación", "quienPelota": "Nicolás", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null}];
const SEED_INMUEBLES = [{"id": "rqnvx18t", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "GUILLERMO ROSSEINDORF", "padron": "ESPERANDO SUCESION", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Preparar boleto", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "v880us44", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "VERONICA FERNANDEZ 097966095", "padron": "GROU", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "g7bptdv6", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MONTSERRAT 092806201", "padron": "", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Preparar boleto", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "11s3a9uj", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MERELLO", "padron": "CASA PIRIA", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": true, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "ok", "etapa": "Compraventa", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "2026-08-03", "prioridad": "Alta", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "3tbzqdgo", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "NATALY BERTINAT Y ERNESTO", "padron": "LA PALOMA", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "ESCRIBANO INSCRIBIENDO SUCESION", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "9i9v0zpp", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "HERNAN PEREYRA Y KEVIN LAGUNA", "padron": "EUSKAL", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "ESTUDIO DE DOCUMENTACION", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "fg4au4q2", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "HERNAN PEREYRA", "padron": "BARRIO CEIBO", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "SOLICITAR DOCUMENTACION", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "n2sd0uao", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MERELLO", "padron": "USS170 PIRIAPOLIS", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "ESTUDIO DE DOCUMENTACION", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "g5hfmngz", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MERELLO", "padron": "USS110 MONTEVIDEO", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "v0c8vb73", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "LORELEY", "padron": "COMPRAVENTA JUDICIAL", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "EJECUTAR", "fechaRecordatorio": "", "prioridad": "Media", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "tsleojb4", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MANUEL", "padron": "CHACRA PAYSANDU", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "CONTRIBUCION Y PRIMARIA", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "km6xfiws", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "CALIFANO", "padron": "JAUREGUIVERRY", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "ESTUDIO DE DOCUMENTACION", "fechaRecordatorio": "", "prioridad": "Media", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "pm06jqv0", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "GASTON PRADERI", "padron": "", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": true, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "SOLICITAR DOCUMETNACIOIN", "fechaRecordatorio": "", "prioridad": "Media", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "tuselaej", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "LOLO CAZENAVE", "padron": "", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "Media", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "kw3o0opz", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "FELIPE", "padron": "", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "", "fechaRecordatorio": "", "prioridad": "", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "fdkogvdi", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "MARCE COGOY", "padron": "EUSKAL", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "FIRMA CON BANCO", "fechaRecordatorio": "", "prioridad": "Alta", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "9tygeu6k", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "Bidegain", "padron": "Chacras", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Preparar boleto", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "Ver documento compraventa e impuestos. Enviarle a Bidegain", "fechaRecordatorio": "", "prioridad": "Alta", "observaciones": "", "fechaFinalizado": null, "enProntos": false}, {"id": "06k07pk3", "fecha": "2026-08-03", "tipoInmueble": "Urbano", "cliente": "FRANCISCO TURTU", "padron": "", "responsables": ["Dahiana"], "numeroIngreso": "", "pin": "", "telefonoComprador": "", "telefonoVendedor": "", "telefonoEscribano": "", "cedulas": false, "titulos": false, "plano": false, "contribucion": false, "primaria": false, "informacionCatastral": false, "proyecto": false, "actosPersonales": false, "certificadoPropiedad": false, "certificadoComercioPrenda": false, "primeraCopia": false, "impuestos": false, "ofrecimiento": false, "art358": false, "colonizacion": false, "mineria": false, "inscripcion": "no_pedido", "etapa": "Boleto firmado", "estado": "Pendiente", "quienPelota": "Nicolás", "proximaAccion": "PEDIR PROYECTO DE CV. PEDIR NOTARIAL NO GASTOS COMUNES. PEDIR SEGURO", "fechaRecordatorio": "", "prioridad": "Alta", "observaciones": "", "fechaFinalizado": null, "enProntos": false}];
const SEED_AGENDA = [{"id": "27avhk6g", "fecha": "2026-08-03", "hora": "14:00", "origen": "Auto", "cliente": "AGUSTIN", "marcaModelo": "I10", "observaciones": "VER CERTIFICADOS"}, {"id": "rfk2it2o", "fecha": "2026-08-06", "hora": "15:30", "origen": "Inmueble", "cliente": "MARCE COGOY", "marcaModelo": "", "observaciones": ""}, {"id": "2zypikr0", "fecha": "2026-08-03", "hora": "16:30", "origen": "Auto", "cliente": "MANU", "marcaModelo": "DODGE", "observaciones": "PERMUTA POR RAM"}, {"id": "s9fktboh", "fecha": "2026-08-03", "hora": "12:30", "origen": "Inmueble", "cliente": "FELIPE RAVERA", "marcaModelo": "", "observaciones": ""}, {"id": "li1qcdv3", "fecha": "2026-08-03", "hora": "16:00", "origen": "Auto", "cliente": "MANU", "marcaModelo": "AMAROK POR AMAROK", "observaciones": ""}, {"id": "qcps13ov", "fecha": "2026-08-05", "hora": "17:30", "origen": "Inmueble", "cliente": "CALIFANO", "marcaModelo": "", "observaciones": "MOSTRAR PROPIEDAD"}, {"id": "ovumrsro", "fecha": "2026-08-03", "hora": "17:00", "origen": "Auto", "cliente": "CALIFANO", "marcaModelo": "DAIHATSU APPLAUSE", "observaciones": ""}, {"id": "b865smp9", "fecha": "2026-08-03", "hora": "16:00", "origen": "Auto", "cliente": "DIEGO", "marcaModelo": "2008 POR 307", "observaciones": ""}];
const SEED_PRONTOS = [{"id": "cco1my3o", "cliente": "DIEGO NUÑEZ", "auto": "ALTO POR ALTO", "observaciones": ""}, {"id": "w5rp3eao", "cliente": "MANU", "auto": "SURAN POR KWID", "observaciones": ""}, {"id": "5z31mihz", "cliente": "BALARINI", "auto": "BYD YUAN PLUS", "observaciones": "FALTAN DATOS DE SA"}];
const SEED_PROXIMOS_FIRMAR = [{"id": "y47xr0rl", "inmuebleId": "fdkogvdi", "cliente": "MARCE COGOY", "padron": "EUSKAL", "faltante": "AMPLIAR. ACTUALIZ"}];

export default function App() {
  const [tab, setTab] = useState("inicio");
  const [trabajosInitialFilters, setTrabajosInitialFilters] = useState({});
  const [modoSimpleArr, setModoSimpleArr, modoSimpleLoaded] = useSharedList("cavallo:modo-simple", [false]);
  const modoSimple = modoSimpleArr[0];
  const setModoSimple = (v) => setModoSimpleArr([v]);
  const [autos, setAutos, autosLoaded] = useSharedList("cavallo:autos", SEED_AUTOS);
  const [documentos, setDocumentos, docsLoaded] = useSharedList("cavallo:documentos", SEED_DOCUMENTOS);
  const [inmuebles, setInmuebles, inmLoaded] = useSharedList("cavallo:inmuebles", SEED_INMUEBLES);
  const [excelLog, setExcelLog, excelLoaded] = useSharedList("cavallo:excelencia-log", []);
  const [agenda, setAgenda, agendaLoaded] = useSharedList("cavallo:agenda-firmas", SEED_AGENDA);
  const [prontos, setProntos, prontosLoaded] = useSharedList("cavallo:prontos-agendar", SEED_PRONTOS);
  const [proximosFirmar, setProximosFirmar, proximosFirmarLoaded] = useSharedList("cavallo:inmuebles-proximos-firmar", SEED_PROXIMOS_FIRMAR);
  const [observados, setObservados, observadosLoaded] = useSharedList("cavallo:documentos-observados", []);

  const allLoaded = autosLoaded && docsLoaded && inmLoaded && excelLoaded && agendaLoaded && prontosLoaded && proximosFirmarLoaded && observadosLoaded && modoSimpleLoaded;

  const TABS = [
    { id: "inicio", label: "Inicio", icon: LayoutDashboard },
    { id: "trabajos", label: "Trabajos", icon: ClipboardList },
    { id: "autos", label: "Autos", icon: Car },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "inmuebles", label: "Inmuebles", icon: Home },
    { id: "excelencia", label: "Excelencia", icon: Stamp },
    { id: "manual", label: "Manual", icon: BookOpen },
  ];

  return (
    <div className="ec-root" style={{ minHeight: "100vh", background: C.paper }}>
      <StyleSheet />
      <div style={{ background: C.ink, color: C.white, padding: "16px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Stamp size={22} color={C.brass} />
            <div>
              <div className="ec-serif" style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".01em" }}>Estudio Cavallo</div>
              <div style={{ fontSize: 11, color: C.brassLight, letterSpacing: ".04em", textTransform: "uppercase" }}>Centro de Operaciones · desde 1989</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setModoSimple(!modoSimple)} style={{ background: modoSimple ? C.brass : "none", border: `1px solid ${C.brassLight}`, borderRadius: 4, cursor: "pointer", color: modoSimple ? C.ink : C.brassLight, fontSize: 12, padding: "4px 10px", fontWeight: 600 }}>
              {modoSimple ? "Modo simple" : "Modo completo"}
            </button>
            <button onClick={() => exportToExcel({ autos, documentos, inmuebles, excelLog, observados, agenda, prontos, proximosFirmar })} style={{ background: "none", border: "none", cursor: "pointer", color: C.brassLight, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <Download size={13} /> Exportar a Excel
            </button>
            <BackupPanel
              state={{ autos, documentos, inmuebles, excelLog, observados, agenda, prontos, proximosFirmar }}
              setters={{ setAutos, setDocumentos, setInmuebles, setExcelLog, setObservados, setAgenda, setProntos, setProximosFirmar }}
            />
            <a href="https://maps.google.com/?q=-34.891102,-56.109699" target="_blank" rel="noreferrer" style={{ color: C.brassLight, fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              📍 Ver ubicación
            </a>
          </div>
        </div>
      </div>

      <div style={{ background: C.paper3, borderBottom: `1.5px solid ${C.ink}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", overflowX: "auto" }} className="ec-scroll">
          {TABS.map((t) => (
            <button key={t.id} className={`ec-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 60px" }}>
        {!allLoaded ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, padding: 40, justifyContent: "center" }}>
            <Loader2 size={18} className="ec-spin" /> Cargando datos del estudio…
          </div>
        ) : (
          <>
            {tab === "inicio" && <Inicio autos={autos} documentos={documentos} inmuebles={inmuebles} excelLog={excelLog} agenda={agenda} setAgenda={setAgenda} prontos={prontos} setProntos={setProntos} proximosFirmar={proximosFirmar} setProximosFirmar={setProximosFirmar} observados={observados} setObservados={setObservados} setTab={setTab} setTrabajosInitialFilters={setTrabajosInitialFilters} />}
            {tab === "trabajos" && <Trabajos autos={autos} setAutos={setAutos} documentos={documentos} setDocumentos={setDocumentos} inmuebles={inmuebles} setInmuebles={setInmuebles} setTab={setTab} initialFilters={trabajosInitialFilters} observados={observados} setObservados={setObservados} />}
            {tab === "autos" && <Autos autos={autos} setAutos={setAutos} prontos={prontos} setProntos={setProntos} modoSimple={modoSimple} />}
            {tab === "documentos" && <Documentos documentos={documentos} setDocumentos={setDocumentos} modoSimple={modoSimple} />}
            {tab === "inmuebles" && <Inmuebles inmuebles={inmuebles} setInmuebles={setInmuebles} modoSimple={modoSimple} prontos={prontos} setProntos={setProntos} />}
            {tab === "excelencia" && <Excelencia excelLog={excelLog} setExcelLog={setExcelLog} autos={autos} documentos={documentos} inmuebles={inmuebles} observados={observados} setTab={setTab} />}
            {tab === "manual" && <Manual />}
          </>
        )}
      </div>
    </div>
  );
}

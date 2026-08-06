import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Stamp, ClipboardList, Car, FileText, Home as HomeIcon, LayoutDashboard, BookOpen, Download, LogOut, User } from "lucide-react";
import { C } from "../lib/theme.jsx";
import { todayISO } from "../lib/format.js";
import {
  carsApi, documentsApi, propertiesApi, dailyExcellenceLogApi, signingAppointmentsApi,
  documentsReadyToScheduleApi, propertiesNearSigningApi, flaggedDocumentsApi,
} from "../lib/api.js";
import { useSupabaseCollection } from "../hooks/useSupabaseCollection.js";
import { useAppSettings } from "../hooks/useAppSettings.js";
import { useRecurringTasks } from "../hooks/useRecurringTasks.js";
import { useToasts } from "../hooks/useToasts.js";
import { Toasts, LoadingBlock } from "./SharedUI.jsx";
import GlobalSearch from "./GlobalSearch.jsx";
import AIChatModal from "./AIChatModal.jsx";
import Home from "./Home.jsx";
import Cars from "./Cars.jsx";
import Documents from "./Documents.jsx";
import Properties from "./Properties.jsx";
import Excellence from "./Excellence.jsx";
import AllWork from "./AllWork.jsx";
import Manual from "./Manual.jsx";

const TABS = [
  { id: "home", label: "Inicio", icon: LayoutDashboard },
  { id: "work", label: "Trabajos", icon: ClipboardList },
  { id: "cars", label: "Autos", icon: Car },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "properties", label: "Inmuebles", icon: HomeIcon },
  { id: "excellence", label: "Excelencia", icon: Stamp },
  { id: "manual", label: "Manual", icon: BookOpen },
];

/* Exports every table in the system to a single Excel file, as an ad hoc backup/report */
function exportToExcel({ cars, documents, properties, dailyExcellenceLog, flaggedDocuments, signingAppointments, documentsReadyToSchedule, propertiesNearSigning }) {
  const wb = XLSX.utils.book_new();
  const addSheet = (name, rows) => {
    const clean = (rows || []).map((r) => {
      const { completed_at, ready_to_schedule, ...rest } = r;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(clean.length ? clean : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  addSheet("Autos", cars);
  addSheet("Documentos", documents);
  addSheet("Inmuebles", properties);
  addSheet("Excelencia-Registro", dailyExcellenceLog);
  addSheet("Documentos Observados", flaggedDocuments);
  addSheet("Agenda de Firmas", signingAppointments);
  addSheet("Prontos para Agendar", documentsReadyToSchedule);
  addSheet("Inmuebles Prox a Firmar", propertiesNearSigning);
  XLSX.writeFile(wb, `EstudioCavallo_export_${todayISO()}.xlsx`);
}

/* Everything that needs a live Supabase session: this component is only ever
   mounted by App.jsx once `session` is confirmed truthy, so none of the data
   hooks below fire a single query until the user is actually signed in. */
export default function AuthenticatedApp({ user, signOut }) {
  const [tab, setTab] = useState("home");
  const [workInitialFilters, setWorkInitialFilters] = useState({});
  const [highlight, setHighlight] = useState(null); // { tab, id } — set by GlobalSearch "jump to item"
  const { toasts, notify, dismiss } = useToasts();

  const goToItem = (targetTab, id) => {
    setTab(targetTab);
    setHighlight({ tab: targetTab, id });
  };

  const { simpleMode, loading: settingsLoading, toggleSimpleMode } = useAppSettings({ notify });
  const cars = useSupabaseCollection(carsApi, { notify });
  const documents = useSupabaseCollection(documentsApi, { notify });
  const properties = useSupabaseCollection(propertiesApi, { notify });
  const dailyExcellenceLog = useSupabaseCollection(dailyExcellenceLogApi, { notify });
  const signingAppointments = useSupabaseCollection(signingAppointmentsApi, { notify });
  const documentsReadyToSchedule = useSupabaseCollection(documentsReadyToScheduleApi, { notify });
  const propertiesNearSigning = useSupabaseCollection(propertiesNearSigningApi, { notify });
  const flaggedDocuments = useSupabaseCollection(flaggedDocumentsApi, { notify });
  const recurringTasks = useRecurringTasks({ notify });

  const allLoaded =
    !settingsLoading && !cars.loading && !documents.loading && !properties.loading && !dailyExcellenceLog.loading &&
    !signingAppointments.loading && !documentsReadyToSchedule.loading && !propertiesNearSigning.loading &&
    !flaggedDocuments.loading && !recurringTasks.loading;

  return (
    <>
      <Toasts toasts={toasts} dismiss={dismiss} />
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
            <GlobalSearch cars={cars} documents={documents} properties={properties} signingAppointments={signingAppointments} onNavigate={goToItem} />
            <button onClick={toggleSimpleMode} style={{ background: simpleMode ? C.brass : "none", border: `1px solid ${C.brassLight}`, borderRadius: 4, cursor: "pointer", color: simpleMode ? C.ink : C.brassLight, fontSize: 12, padding: "4px 10px", fontWeight: 600 }}>
              {simpleMode ? "Modo simple" : "Modo completo"}
            </button>
            <button
              onClick={() => exportToExcel({
                cars: cars.rows, documents: documents.rows, properties: properties.rows,
                dailyExcellenceLog: dailyExcellenceLog.rows, flaggedDocuments: flaggedDocuments.rows,
                signingAppointments: signingAppointments.rows, documentsReadyToSchedule: documentsReadyToSchedule.rows,
                propertiesNearSigning: propertiesNearSigning.rows,
              })}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.brassLight, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
            >
              <Download size={13} /> Exportar a Excel
            </button>
            <a href="https://maps.google.com/?q=-34.891102,-56.109699" target="_blank" rel="noreferrer" style={{ color: C.brassLight, fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              📍 Ver ubicación
            </a>
            <div style={{ width: 1, height: 18, background: "rgba(199,164,104,.35)" }} />
            <span title={user?.email} style={{ display: "flex", alignItems: "center", gap: 6, color: C.brassLight, fontSize: 12, maxWidth: 160 }}>
              <User size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</span>
            </span>
            <button
              onClick={signOut}
              title="Cerrar sesión"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.brassLight, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
            >
              <LogOut size={13} /> Cerrar sesión
            </button>
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
          <LoadingBlock label="Cargando datos del estudio…" />
        ) : (
          <>
            {tab === "home" && (
              <Home
                cars={cars} documents={documents} properties={properties} dailyExcellenceLog={dailyExcellenceLog}
                signingAppointments={signingAppointments} documentsReadyToSchedule={documentsReadyToSchedule}
                propertiesNearSigning={propertiesNearSigning} flaggedDocuments={flaggedDocuments}
                setTab={setTab} setWorkInitialFilters={setWorkInitialFilters} recurringTasks={recurringTasks}
                highlightId={highlight?.tab === "home" ? highlight.id : null}
              />
            )}
            {tab === "work" && (
              <AllWork cars={cars} documents={documents} properties={properties} flaggedDocuments={flaggedDocuments} setTab={setTab} initialFilters={workInitialFilters} />
            )}
            {tab === "cars" && <Cars cars={cars} documentsReadyToSchedule={documentsReadyToSchedule} simpleMode={simpleMode} highlightId={highlight?.tab === "cars" ? highlight.id : null} />}
            {tab === "documents" && <Documents documents={documents} simpleMode={simpleMode} highlightId={highlight?.tab === "documents" ? highlight.id : null} />}
            {tab === "properties" && <Properties properties={properties} documentsReadyToSchedule={documentsReadyToSchedule} simpleMode={simpleMode} highlightId={highlight?.tab === "properties" ? highlight.id : null} />}
            {tab === "excellence" && (
              <Excellence dailyExcellenceLog={dailyExcellenceLog} cars={cars} documents={documents} properties={properties} flaggedDocuments={flaggedDocuments} setTab={setTab} />
            )}
            {tab === "manual" && <Manual />}
          </>
        )}
      </div>

      <AIChatModal />
    </>
  );
}

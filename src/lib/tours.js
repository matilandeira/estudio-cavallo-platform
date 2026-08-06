/* Step sequences for the driver.js product tour — see TourButton.jsx for
   how these run. Every tour opens with the same "buscador global" step
   since the search bar/shortcut lives in the header on every screen; the
   rest is specific to what that tab actually shows. Steps target real DOM
   elements via `data-tour="..."` attributes sprinkled across the relevant
   components — see each component for the matching attribute. */

const searchStep = () => ({
  element: '[data-tour="global-search"]',
  popover: {
    title: "Buscador global",
    description: "Buscá cualquier auto, documento, inmueble o firma agendada desde acá, sin importar en qué pestaña estés. Atajo de teclado: Ctrl/Cmd + K.",
    side: "bottom",
    align: "start",
  },
});

export const homeTourSteps = [
  searchStep(),
  {
    element: '[data-tour="signing-agenda"]',
    popover: {
      title: "Agenda de firmas",
      description: "Las firmas ya coordinadas aparecen acá, agrupadas por día. \"Agendar\" carga una firma nueva directamente.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="ready-to-schedule"]',
    popover: {
      title: "Documentos prontos para agendar",
      description: "Cuando un auto o un inmueble llega a \"Pronto para firma\", aparece acá automáticamente — no hace falta cargarlo a mano. Desde acá se coordina el día y hora, o se agrega uno manualmente.",
      side: "top",
    },
  },
  {
    element: '[data-tour="urgent-toggle"]',
    popover: {
      title: "⚡ Urgentes",
      description: "Este filtro muestra solo los recordatorios vencidos o que vencen en los próximos 7 días, para no tener que revisar toda la lista.",
      side: "left",
    },
  },
  {
    element: '[data-tour="kpi-cards"]',
    popover: {
      title: "Resumen rápido",
      description: "Estas tarjetas son atajos: al hacer clic te llevan directamente a la pestaña correspondiente, ya filtrada cuando corresponde.",
      side: "top",
    },
  },
];

export const carsTourSteps = [
  searchStep(),
  {
    element: '[data-tour="bulk-select"]',
    popover: {
      title: "Selección múltiple",
      description: "Tildá \"Seleccionar todo\" o auto por auto para elegir varios a la vez. Con al menos uno tildado aparece una barra arriba para cambiar el estado o reasignar responsable en lote.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="status-select"]',
    popover: {
      title: "Estado del trámite",
      description: "Cambiá el estado desde acá. Al llegar a \"Pronto para firma\" — a mano, o solo con los 7 controles en verde — el auto aparece automáticamente en \"Documentos prontos para agendar\" en Inicio.",
      side: "left",
    },
  },
  {
    element: '[data-tour="urgent-toggle"]',
    popover: {
      title: "⚡ Urgentes",
      description: "Filtra la lista para mostrar solo los autos con recordatorio vencido o que vence esta semana.",
      side: "bottom",
    },
  },
];

export const documentsTourSteps = [
  searchStep(),
  {
    element: '[data-tour="bulk-select"]',
    popover: {
      title: "Selección múltiple",
      description: "Tildá \"Seleccionar todo\" o documento por documento. Con alguno tildado aparece una barra arriba para reasignar responsable, o cambiar el estado en lote (esto último solo aplica a documentos con estado general — poderes, sucesiones, SAS, etc. tienen su propio flujo de estados).",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="status-select"]',
    popover: {
      title: "Estado del documento",
      description: "El campo de estado cambia según el tipo (poder, sucesión, SAS, testimonio, etc.) — cada uno tiene sus propias etapas.",
      side: "left",
    },
  },
  {
    element: '[data-tour="urgent-toggle"]',
    popover: {
      title: "⚡ Urgentes",
      description: "Filtra la lista para mostrar solo los documentos con próxima fecha clave vencida o que vence esta semana.",
      side: "bottom",
    },
  },
];

export const propertiesTourSteps = [
  searchStep(),
  {
    element: '[data-tour="search"]',
    popover: {
      title: "Buscar en Inmuebles",
      description: "Buscá por cliente o padrón sin salir de esta pestaña.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="bulk-select"]',
    popover: {
      title: "Selección múltiple",
      description: "Tildá \"Seleccionar todo\" o inmueble por inmueble. Con alguno tildado aparece una barra arriba para cambiar el estado o reasignar responsable en lote.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="status-select"]',
    popover: {
      title: "Estado y etapa",
      description: "La etapa (boleto, promesa, compraventa, etc.) se elige más abajo en cada tarjeta. Al llegar a \"Pronto para firma\" el inmueble aparece automáticamente en \"Documentos prontos para agendar\" en Inicio.",
      side: "left",
    },
  },
  {
    element: '[data-tour="urgent-toggle"]',
    popover: {
      title: "⚡ Urgentes",
      description: "Filtra la lista para mostrar solo los inmuebles con próxima fecha clave vencida o que vence esta semana.",
      side: "bottom",
    },
  },
];

export const workTourSteps = [
  searchStep(),
  {
    element: '[data-tour="search"]',
    popover: {
      title: "Buscar en Trabajos",
      description: "Buscá por cliente, padrón o marca y modelo entre autos, documentos e inmuebles a la vez.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="filters"]',
    popover: {
      title: "Filtros",
      description: "Filtrá por responsable, tipo, estado o prioridad. Hacé clic en cualquier fila para ir directo a esa pestaña.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="urgent-toggle"]',
    popover: {
      title: "⚡ Urgentes",
      description: "Filtra la lista para mostrar solo lo que está vencido o vence en los próximos 7 días, entre autos, documentos e inmuebles.",
      side: "bottom",
    },
  },
];

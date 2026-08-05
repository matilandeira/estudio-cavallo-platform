# Estudio Cavallo — Centro de Operaciones

Proyecto React (Vite) del sistema de gestión de trabajos de Estudio Cavallo:
Autos, Documentos, Inmuebles, Excelencia Operativa y Trabajos.

## Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior (incluye `npm`)

## Instalación

Abrí una terminal en esta carpeta y ejecutá:

```bash
npm install
```

## Uso en desarrollo (para probarlo en tu compu)

```bash
npm run dev
```

Esto va a mostrar una dirección como `http://localhost:5173` — abrila en el navegador.

## Generar la versión final para publicar en un servidor

```bash
npm run build
```

Esto crea una carpeta `dist/` con los archivos listos para subir a cualquier
hosting (Netlify, Vercel, un servidor propio, etc.).

## Sobre el almacenamiento de datos

**Importante:** esta versión guarda los datos en el `localStorage` del
navegador donde se abre — es decir, **cada dispositivo/navegador tiene su
propia copia**, no se comparte en tiempo real entre varias personas.

Si más adelante alguien quiere que el equipo vea los mismos datos en tiempo
real desde distintos dispositivos, hay que:

1. Armar un backend con una base de datos real (por ejemplo Firebase,
   Supabase, o una API propia).
2. Reemplazar la función `useSharedList` en `src/App.jsx` (está comentada
   ahí mismo, indicando qué reemplazar) por llamadas a ese backend,
   manteniendo la misma firma de retorno: `[items, persist(next), loaded]`.

El resto del programa (todas las pantallas, lógica de Excelencia Operativa,
etc.) no necesita cambios para eso — solo esa función de almacenamiento.

## Estructura

```
estudio-cavallo/
├── index.html          # HTML raíz que carga la app
├── package.json         # Dependencias y scripts
├── vite.config.js       # Configuración de Vite
└── src/
    ├── main.jsx          # Punto de entrada de React
    └── App.jsx           # Todo el programa (componentes, lógica, estilos)
```

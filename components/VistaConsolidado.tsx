"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  calcularDefinitivaCorte,
  calcularProyeccionCorte3,
  type ProyeccionCorte3,
} from "@/lib/calculos";
import {
  Calculator,
  Download,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";

interface VistaConsolidadoProps {
  asignaturaId: number;
}

interface FilaConsolidado {
  id: number;
  identificacion: string;
  nombreCompleto: string;
  definitivaC1: number | null;
  definitivaC2: number | null;
  definitivaC3: number | null;
  proyeccion: ProyeccionCorte3;
}

export function VistaConsolidado({ asignaturaId }: VistaConsolidadoProps) {
  const [busqueda, setBusqueda] = useState("");

  // Extracción consolidada masiva de estudiantes, cortes, actividades y notas en una pasada
  const datos = useLiveQuery(async () => {
    if (!asignaturaId) return null;

    const asignatura = await db.asignaturas.get(asignaturaId);

    const estudiantes = await db.estudiantes
      .where("asignaturaId")
      .equals(asignaturaId)
      .toArray();

    const cortes = await db.cortes
      .where("asignaturaId")
      .equals(asignaturaId)
      .sortBy("numeroCorte");

    const corteIds = cortes.map((c) => c.id!).filter(Boolean);

    const actividades =
      corteIds.length > 0
        ? await db.actividades.where("corteId").anyOf(corteIds).toArray()
        : [];

    const actividadIds = actividades.map((a) => a.id!).filter(Boolean);

    const notas =
      actividadIds.length > 0
        ? await db.notas.where("actividadId").anyOf(actividadIds).toArray()
        : [];

    return {
      asignatura,
      estudiantes,
      cortes,
      actividades,
      notas,
    };
  }, [asignaturaId]);

  // Cálculos de definitivas y proyecciones para todos los estudiantes
  const { filas, corte1, corte2, corte3, metricas } = useMemo(() => {
    if (!datos) {
      return {
        filas: [],
        corte1: null,
        corte2: null,
        corte3: null,
        metricas: null,
      };
    }

    const { estudiantes, cortes, actividades, notas } = datos;

    const c1 = cortes.find((c) => c.numeroCorte === 1) ?? null;
    const c2 = cortes.find((c) => c.numeroCorte === 2) ?? null;
    const c3 = cortes.find((c) => c.numeroCorte === 3) ?? null;

    const actC1 = actividades.filter((a) => a.corteId === c1?.id);
    const actC2 = actividades.filter((a) => a.corteId === c2?.id);
    const actC3 = actividades.filter((a) => a.corteId === c3?.id);

    // Mapa rápido de notas: `${estudianteId}_${actividadId}` -> valor
    const notasMap = new Map<string, number>();
    for (const n of notas) {
      notasMap.set(`${n.estudianteId}_${n.actividadId}`, n.valor);
    }

    const peso1 = c1?.porcentaje ?? 35;
    const peso2 = c2?.porcentaje ?? 35;
    const peso3 = c3?.porcentaje ?? 30;

    const listaFilas: FilaConsolidado[] = estudiantes.map((est) => {
      const defC1 = calcularDefinitivaCorte(est.id!, actC1, notasMap, peso1);
      const defC2 = calcularDefinitivaCorte(est.id!, actC2, notasMap, peso2);
      const defC3 = calcularDefinitivaCorte(est.id!, actC3, notasMap, peso3);

      const proy = calcularProyeccionCorte3(defC1, defC2);

      return {
        id: est.id!,
        identificacion: est.identificacion,
        nombreCompleto: est.nombreCompleto,
        definitivaC1: defC1,
        definitivaC2: defC2,
        definitivaC3: defC3,
        proyeccion: proy,
      };
    });

    // Métricas del simulador
    let yaAprobo = 0;
    let alcanzable = 0;
    let dificil = 0;
    let imposible = 0;
    let sumaAcumulados = 0;

    for (const f of listaFilas) {
      sumaAcumulados += f.proyeccion.acumulado70;
      if (f.proyeccion.estado === "ya_aprobo") yaAprobo++;
      else if (f.proyeccion.estado === "alcanzable") alcanzable++;
      else if (f.proyeccion.estado === "dificil") dificil++;
      else if (f.proyeccion.estado === "imposible") imposible++;
    }

    const total = listaFilas.length;
    const promedioAcumulado = total > 0 ? sumaAcumulados / total : 0;

    return {
      filas: listaFilas,
      corte1: c1,
      corte2: c2,
      corte3: c3,
      metricas: {
        total,
        yaAprobo,
        alcanzable,
        dificil,
        imposible,
        promedioAcumulado,
      },
    };
  }, [datos]);

  // Filtrado por buscador
  const filasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return filas;
    const q = busqueda.toLowerCase().trim();
    return filas.filter(
      (f) =>
        f.nombreCompleto.toLowerCase().includes(q) ||
        f.identificacion.toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  // Función de Exportación a CSV compatible con Excel en español
  const handleExportarCSV = () => {
    if (!filas || filas.length === 0) {
      alert("No hay datos de estudiantes para exportar.");
      return;
    }

    const headers = [
      "No",
      "Identificación",
      "Nombre Completo",
      "Definitiva Corte 1 (35%)",
      "Definitiva Corte 2 (35%)",
      "Acumulado Actual (70%)",
      "Nota Requerida Corte 3 (30%)",
      "Estado Proyección",
    ];

    const rows = filas.map((f, idx) => {
      const c1Str = f.definitivaC1 !== null ? f.definitivaC1.toFixed(1).replace(".", ",") : "N/A";
      const c2Str = f.definitivaC2 !== null ? f.definitivaC2.toFixed(1).replace(".", ",") : "N/A";
      const acumStr = f.proyeccion.acumulado70.toFixed(2).replace(".", ",");
      const reqStr = f.proyeccion.notaRequeridaCorte3.toFixed(2).replace(".", ",");
      const estadoStr = f.proyeccion.mensaje.replace(/"/g, '""');

      return [
        idx + 1,
        `"${f.identificacion}"`,
        `"${f.nombreCompleto}"`,
        c1Str,
        c2Str,
        acumStr,
        reqStr,
        `"${estadoStr}"`,
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const nombreLimpio = (datos?.asignatura?.nombre ?? "Asignatura")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 30);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Consolidado_${nombreLimpio}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Resumen y Botón de Exportar */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              <Calculator className="w-3.5 h-3.5" />
              <span>Simulador de Calificaciones Finales</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Consolidado y Proyección — Corte 3 (30%)
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Cálculo acumulado basado en el 70% reglamentario (Corte 1: 35% + Corte 2: 35%) y
              simulación automática de la calificación mínima necesaria en el Corte 3 (30%) para alcanzar la definitiva aprobatoria de 3.0.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportarCSV}
              disabled={!filas || filas.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
              title="Descargar tabla en formato compatible con Microsoft Excel"
            >
              <Download className="w-4 h-4" />
              <span>Exportar a Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Estado Grupal */}
        {metricas && metricas.total > 0 && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Ya Aprobados (0.0)</span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {metricas.yaAprobo}
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 ml-1">
                  ({metricas.total > 0 ? ((metricas.yaAprobo / metricas.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Alcanzable (&le; 3.0)</span>
              </div>
              <div className="text-xl font-bold font-mono text-sky-700 dark:text-sky-400 mt-1">
                {metricas.alcanzable}
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 ml-1">
                  ({metricas.total > 0 ? ((metricas.alcanzable / metricas.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Exigente (3.1 a 5.0)</span>
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {metricas.dificil}
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 ml-1">
                  ({metricas.total > 0 ? ((metricas.dificil / metricas.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Crítico (&gt; 5.0)</span>
              </div>
              <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
                {metricas.imposible}
                <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500 ml-1">
                  ({metricas.total > 0 ? ((metricas.imposible / metricas.total) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Cuadrícula del Consolidado */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
              Sábana Consolidada de Notas
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50 px-2 py-0.5 rounded">
              {filas.length} estudiante(s)
            </span>
          </div>

          {/* Barra de búsqueda de estudiantes */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar estudiante o documento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-zinc-400 mb-3" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
              No hay estudiantes registrados en esta asignatura
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Importa la lista de estudiantes en la pestaña &quot;Estudiantes&quot; para habilitar el simulador.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 uppercase font-medium border-b border-zinc-200 dark:border-zinc-800 select-none">
                <tr>
                  {/* Sticky 1: # */}
                  <th className="sticky left-0 z-20 w-12 min-w-[48px] max-w-[48px] px-3 py-3 text-center bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
                    #
                  </th>

                  {/* Sticky 2: Identificación */}
                  <th className="sticky left-[48px] z-20 w-36 min-w-[130px] max-w-[130px] px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
                    Identificación
                  </th>

                  {/* Sticky 3: Nombre Completo */}
                  <th className="sticky left-[178px] z-20 min-w-[200px] px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    Nombre Completo
                  </th>

                  {/* Definitiva Corte 1 */}
                  <th className="px-4 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <div>Definitiva C1</div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 lowercase">
                      peso: 35%
                    </div>
                  </th>

                  {/* Definitiva Corte 2 */}
                  <th className="px-4 py-3 text-center border-r border-zinc-200 dark:border-zinc-800">
                    <div>Definitiva C2</div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 lowercase">
                      peso: 35%
                    </div>
                  </th>

                  {/* Acumulado Actual 70% */}
                  <th className="px-4 py-3 text-center border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-800/40">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      Acumulado (70%)
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 lowercase">
                      máx 3.5 pts
                    </div>
                  </th>

                  {/* Nota Requerida Corte 3 */}
                  <th className="px-4 py-3 text-center border-r border-zinc-200 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="font-bold text-amber-950 dark:text-amber-200">
                      Requerida C3 (30%)
                    </div>
                    <div className="font-mono text-[10px] text-amber-700 dark:text-amber-400 lowercase">
                      para aprobar (3.0)
                    </div>
                  </th>

                  {/* Estado / Semáforo */}
                  <th className="px-4 py-3 text-center min-w-[160px]">
                    <div>Estado Proyección</div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 lowercase">
                      diagnóstico simulado
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {filasFiltradas.map((fila, index) => {
                  const { proyeccion } = fila;

                  return (
                    <tr
                      key={fila.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 transition-colors group"
                    >
                      {/* Sticky 1: # */}
                      <td className="sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] px-3 py-2.5 text-center font-mono text-zinc-400 dark:text-zinc-500 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800">
                        {index + 1}
                      </td>

                      {/* Sticky 2: Identificación */}
                      <td className="sticky left-[48px] z-10 w-36 min-w-[130px] max-w-[130px] px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800">
                        {fila.identificacion}
                      </td>

                      {/* Sticky 3: Nombre Completo */}
                      <td className="sticky left-[178px] z-10 min-w-[200px] px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        <span className="truncate block max-w-[220px]">
                          {fila.nombreCompleto}
                        </span>
                      </td>

                      {/* Definitiva C1 */}
                      <td className="px-4 py-2.5 text-center font-mono border-r border-zinc-200 dark:border-zinc-800">
                        {fila.definitivaC1 !== null ? (
                          <span
                            className={`font-semibold ${
                              fila.definitivaC1 >= 3.0
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {fila.definitivaC1.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">Pendiente</span>
                        )}
                      </td>

                      {/* Definitiva C2 */}
                      <td className="px-4 py-2.5 text-center font-mono border-r border-zinc-200 dark:border-zinc-800">
                        {fila.definitivaC2 !== null ? (
                          <span
                            className={`font-semibold ${
                              fila.definitivaC2 >= 3.0
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {fila.definitivaC2.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">Pendiente</span>
                        )}
                      </td>

                      {/* Acumulado 70% */}
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
                        {proyeccion.acumulado70.toFixed(2)}
                        <span className="text-[10px] font-normal text-zinc-400 ml-1">/ 3.5</span>
                      </td>

                      {/* Requerida C3 (30%) */}
                      <td className="px-4 py-2.5 text-center font-mono font-extrabold border-r border-zinc-200 dark:border-zinc-800 bg-amber-50/30 dark:bg-amber-950/15">
                        {proyeccion.estado === "ya_aprobo" ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            0.0
                          </span>
                        ) : proyeccion.estado === "imposible" ? (
                          <span className="text-rose-600 dark:text-rose-400" title="Supera la nota máxima de 5.0">
                            {proyeccion.notaRequeridaCorte3.toFixed(1)}
                          </span>
                        ) : (
                          <span
                            className={
                              proyeccion.notaRequeridaCorte3 <= 3.0
                                ? "text-sky-600 dark:text-sky-400"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {proyeccion.notaRequeridaCorte3.toFixed(1)}
                          </span>
                        )}
                      </td>

                      {/* Estado Semáforo Badge */}
                      <td className="px-4 py-2.5 text-center">
                        {proyeccion.estado === "ya_aprobo" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>¡Aprobó la Materia!</span>
                          </span>
                        ) : proyeccion.estado === "alcanzable" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80">
                            <TrendingUp className="w-3 h-3" />
                            <span>Alcanzable (&le; 3.0)</span>
                          </span>
                        ) : proyeccion.estado === "dificil" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Exigente (3.1 a 5.0)</span>
                          </span>
                        ) : proyeccion.estado === "imposible" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/80">
                            <XCircle className="w-3 h-3" />
                            <span>Reprobado (&gt; 5.0)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                            <HelpCircle className="w-3 h-3" />
                            <span>Pendiente de Notas</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

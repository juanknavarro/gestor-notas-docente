"use client";

import { useState, useMemo, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  calcularDefinitivaCorte,
  clasificarResultadoAprendizaje,
  type CategoriaDesempeno,
  type EstudianteConNota,
} from "@/lib/calculos";
import {
  BarChart3,
  Calendar,
  BookOpen,
  Layers,
  Users,
  Award,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

export default function ReportesPage() {
  // 1. Estados para los selectores en cascada
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState<number | null>(null);
  const [selectedNumeroCorte, setSelectedNumeroCorte] = useState<number>(1);

  // 2. Cargar periodos
  const periodos = useLiveQuery(() => db.periodos.toArray());

  // Auto-seleccionar primer periodo si no hay ninguno seleccionado
  useEffect(() => {
    if (periodos && periodos.length > 0 && selectedPeriodoId === null) {
      setSelectedPeriodoId(periodos[0].id!);
    }
  }, [periodos, selectedPeriodoId]);

  // 3. Cargar asignaturas del periodo seleccionado
  const asignaturas = useLiveQuery(
    () =>
      selectedPeriodoId
        ? db.asignaturas.where("periodoId").equals(selectedPeriodoId).toArray()
        : [],
    [selectedPeriodoId]
  );

  // Auto-seleccionar primera asignatura o ajustar si cambia el periodo
  useEffect(() => {
    if (asignaturas && asignaturas.length > 0) {
      const existe = asignaturas.some((a) => a.id === selectedAsignaturaId);
      if (!existe) {
        setSelectedAsignaturaId(asignaturas[0].id!);
      }
    } else {
      setSelectedAsignaturaId(null);
    }
  }, [asignaturas, selectedAsignaturaId]);

  // 4. Extracción consolidada del corte, estudiantes, actividades y notas
  const datosReporte = useLiveQuery(async () => {
    if (!selectedAsignaturaId) return null;

    // Obtener configuración del corte (ej. Corte 1 con 35%)
    let corte = await db.cortes
      .where("asignaturaId")
      .equals(selectedAsignaturaId)
      .and((c) => c.numeroCorte === selectedNumeroCorte)
      .first();

    // Fallback de peso según convención reglamentaria institucional
    const pesoFallback = selectedNumeroCorte === 3 ? 30 : 35;
    const pesoCorte = corte ? corte.porcentaje : pesoFallback;
    const corteId = corte?.id;

    // Obtener estudiantes de la asignatura
    const estudiantes = await db.estudiantes
      .where("asignaturaId")
      .equals(selectedAsignaturaId)
      .toArray();

    // Obtener actividades de este corte
    const actividades = corteId
      ? await db.actividades.where("corteId").equals(corteId).toArray()
      : [];

    const actividadIds = actividades.map((a) => a.id!).filter(Boolean);

    // Obtener notas registradas
    const notas =
      actividadIds.length > 0
        ? await db.notas.where("actividadId").anyOf(actividadIds).toArray()
        : [];

    return {
      corte,
      pesoCorte,
      estudiantes,
      actividades,
      notas,
    };
  }, [selectedAsignaturaId, selectedNumeroCorte]);

  // 5. Procesamiento analítico y categorización
  const analisis = useMemo(() => {
    if (!datosReporte) return null;

    const { estudiantes, actividades, notas, pesoCorte } = datosReporte;

    // Mapa rápido de notas: `${estudianteId}_${actividadId}` -> valor
    const notasMap = new Map<string, number>();
    for (const n of notas) {
      notasMap.set(`${n.estudianteId}_${n.actividadId}`, n.valor);
    }

    // Calcular definitiva y categorizar a cada estudiante
    const estudiantesConNota: EstudianteConNota[] = [];

    for (const est of estudiantes) {
      const def = calcularDefinitivaCorte(est.id!, actividades, notasMap, pesoCorte);
      const definitiva = def !== null ? def : 0;
      const categoria = clasificarResultadoAprendizaje(definitiva);

      estudiantesConNota.push({
        estudianteId: est.id!,
        nombreCompleto: est.nombreCompleto,
        identificacion: est.identificacion,
        definitiva,
        categoria,
      });
    }

    const totalEvaluados = estudiantesConNota.length;

    // Agrupación en las 4 categorías
    const bajo = estudiantesConNota.filter((e) => e.categoria === "Bajo");
    const aceptable = estudiantesConNota.filter((e) => e.categoria === "Aceptable");
    const competente = estudiantesConNota.filter((e) => e.categoria === "Competente");
    const excelente = estudiantesConNota.filter((e) => e.categoria === "Excelente");

    const sumaDefinitivas = estudiantesConNota.reduce((acc, e) => acc + e.definitiva, 0);
    const promedioGrupo = totalEvaluados > 0 ? sumaDefinitivas / totalEvaluados : 0;

    const totalAprobados = aceptable.length + competente.length + excelente.length;
    const totalReprobados = bajo.length;
    const tasaAprobacion = totalEvaluados > 0 ? (totalAprobados / totalEvaluados) * 100 : 0;

    // Porcentajes para cada categoría
    const pctBajo = totalEvaluados > 0 ? (bajo.length / totalEvaluados) * 100 : 0;
    const pctAceptable = totalEvaluados > 0 ? (aceptable.length / totalEvaluados) * 100 : 0;
    const pctCompetente = totalEvaluados > 0 ? (competente.length / totalEvaluados) * 100 : 0;
    const pctExcelente = totalEvaluados > 0 ? (excelente.length / totalEvaluados) * 100 : 0;

    return {
      totalEvaluados,
      promedioGrupo,
      tasaAprobacion,
      totalAprobados,
      totalReprobados,
      tieneActividades: actividades.length > 0,
      bajo: {
        estudiantes: bajo,
        count: bajo.length,
        porcentaje: pctBajo,
      },
      aceptable: {
        estudiantes: aceptable,
        count: aceptable.length,
        porcentaje: pctAceptable,
      },
      competente: {
        estudiantes: competente,
        count: competente.length,
        porcentaje: pctCompetente,
      },
      excelente: {
        estudiantes: excelente,
        count: excelente.length,
        porcentaje: pctExcelente,
      },
    };
  }, [datosReporte]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Informes y Analítica</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Evaluación de Resultados de Aprendizaje
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Distribución de rendimiento estudiantil por categorías institucionales y análisis estadístico por corte.
        </p>
      </div>

      {/* Top Bar: Filtros en Cascada */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Selector Periodo */}
          <div>
            <label
              htmlFor="filtro-periodo"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Periodo Académico</span>
            </label>
            <select
              id="filtro-periodo"
              value={selectedPeriodoId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedPeriodoId(val);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
            >
              {!periodos || periodos.length === 0 ? (
                <option value="">No hay periodos creados</option>
              ) : (
                periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 2. Selector Asignatura */}
          <div>
            <label
              htmlFor="filtro-asignatura"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Asignatura</span>
            </label>
            <select
              id="filtro-asignatura"
              value={selectedAsignaturaId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedAsignaturaId(val);
              }}
              disabled={!asignaturas || asignaturas.length === 0}
              className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 disabled:opacity-50 transition-colors"
            >
              {!asignaturas || asignaturas.length === 0 ? (
                <option value="">No hay asignaturas en este periodo</option>
              ) : (
                asignaturas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} {a.numeroClase ? `(Clase ${a.numeroClase})` : ""} — {a.programa}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Selector Corte */}
          <div>
            <label
              htmlFor="filtro-corte"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Corte Evaluativo</span>
            </label>
            <select
              id="filtro-corte"
              value={selectedNumeroCorte}
              onChange={(e) => setSelectedNumeroCorte(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
            >
              <option value={1}>Corte 1 (35%)</option>
              <option value={2}>Corte 2 (35%)</option>
              <option value={3}>Corte 3 (30%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estados Vacíos Previos */}
      {!periodos || periodos.length === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <Calendar className="w-10 h-10 text-zinc-400 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No tienes periodos académicos registrados
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            Crea tu primer periodo académico para comenzar a estructurar tus cursos.
          </p>
          <Link
            href="/periodos"
            className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
          >
            Ir a Periodos
          </Link>
        </div>
      ) : !asignaturas || asignaturas.length === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <BookOpen className="w-10 h-10 text-zinc-400 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No hay asignaturas en este periodo
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            Agrega asignaturas para este periodo para generar reportes estadísticos.
          </p>
          <Link
            href="/asignaturas"
            className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
          >
            Ir a Asignaturas
          </Link>
        </div>
      ) : !analisis ? (
        <div className="p-12 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
          Cargando datos del reporte...
        </div>
      ) : analisis.totalEvaluados === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <Users className="w-10 h-10 text-zinc-400 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No hay estudiantes matriculados
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            Importa la lista de estudiantes mediante el módulo Elysa en la vista de la asignatura.
          </p>
          {selectedAsignaturaId && (
            <Link
              href={`/asignaturas/${selectedAsignaturaId}`}
              className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
            >
              Gestionar Estudiantes
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Aviso si el corte aún no tiene actividades evaluativas */}
          {!analisis.tieneActividades && (
            <div className="flex items-center gap-3 p-4 text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Corte sin actividades registradas</p>
                <p className="text-amber-800 dark:text-amber-400/90 mt-0.5">
                  El Corte {selectedNumeroCorte} aún no tiene actividades creadas. Todas las definitivas actuales se reflejan en 0.0 hasta que registres actividades y calificaciones.
                </p>
              </div>
            </div>
          )}

          {/* Tarjetas KPI (Key Performance Indicators) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI 1: Total Evaluados */}
            <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs mb-2">
                <span className="font-medium">Total Evaluados</span>
                <Users className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                {analisis.totalEvaluados}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {analisis.totalAprobados} aprobados
                </span>
                <span>•</span>
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  {analisis.totalReprobados} reprobados
                </span>
              </div>
            </div>

            {/* KPI 2: Promedio General del Grupo */}
            <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs mb-2">
                <span className="font-medium">Promedio del Grupo</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono">
                <span
                  className={
                    analisis.promedioGrupo >= 3.0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {analisis.promedioGrupo.toFixed(1)}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal ml-1.5">
                  / 5.0
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {analisis.promedioGrupo >= 3.0
                  ? "Rendimiento promedio sobre el umbral aprobatorio"
                  : "Rendimiento promedio por debajo de la nota aprobatoria"}
              </p>
            </div>

            {/* KPI 3: Tasa de Aprobación */}
            <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl">
              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs mb-2">
                <span className="font-medium">Tasa de Aprobación</span>
                <Award className="w-4 h-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                {analisis.tasaAprobacion.toFixed(1)}%
              </div>
              <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    analisis.tasaAprobacion >= 70
                      ? "bg-emerald-500"
                      : analisis.tasaAprobacion >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${analisis.tasaAprobacion}%` }}
                />
              </div>
            </div>
          </div>

          {/* Barra de Distribución Apilada (Stacked Bar) */}
          <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                  Distribución Acumulada de Resultados
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Proporción de estudiantes en cada nivel de logro para el Corte {selectedNumeroCorte}.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Bajo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Aceptable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Competente</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Excelente</span>
                </div>
              </div>
            </div>

            {/* Barra Horizontal Apilada */}
            <div className="w-full h-5 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden flex shadow-inner">
              {analisis.bajo.porcentaje > 0 && (
                <div
                  className="h-full bg-rose-500 transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ width: `${analisis.bajo.porcentaje}%` }}
                  title={`Bajo: ${analisis.bajo.count} alumnos (${analisis.bajo.porcentaje.toFixed(1)}%)`}
                >
                  {analisis.bajo.porcentaje >= 8 && `${analisis.bajo.porcentaje.toFixed(0)}%`}
                </div>
              )}
              {analisis.aceptable.porcentaje > 0 && (
                <div
                  className="h-full bg-amber-500 transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ width: `${analisis.aceptable.porcentaje}%` }}
                  title={`Aceptable: ${analisis.aceptable.count} alumnos (${analisis.aceptable.porcentaje.toFixed(1)}%)`}
                >
                  {analisis.aceptable.porcentaje >= 8 && `${analisis.aceptable.porcentaje.toFixed(0)}%`}
                </div>
              )}
              {analisis.competente.porcentaje > 0 && (
                <div
                  className="h-full bg-sky-500 transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ width: `${analisis.competente.porcentaje}%` }}
                  title={`Competente: ${analisis.competente.count} alumnos (${analisis.competente.porcentaje.toFixed(1)}%)`}
                >
                  {analisis.competente.porcentaje >= 8 && `${analisis.competente.porcentaje.toFixed(0)}%`}
                </div>
              )}
              {analisis.excelente.porcentaje > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ width: `${analisis.excelente.porcentaje}%` }}
                  title={`Excelente: ${analisis.excelente.count} alumnos (${analisis.excelente.porcentaje.toFixed(1)}%)`}
                >
                  {analisis.excelente.porcentaje >= 8 && `${analisis.excelente.porcentaje.toFixed(0)}%`}
                </div>
              )}
            </div>
          </div>

          {/* Desglose por Categoría: 4 Tarjetas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Categoría 1: BAJO */}
            <div className="bg-white border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <h4 className="font-bold text-sm text-rose-950 dark:text-rose-200">
                      Bajo
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                    0.0 a 2.9
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-rose-950 dark:text-rose-100">
                    {analisis.bajo.count}
                  </span>
                  <span className="text-xs font-mono font-medium text-rose-700 dark:text-rose-400">
                    {analisis.bajo.porcentaje.toFixed(1)}% del grupo
                  </span>
                </div>

                <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                  Estudiantes Reprobados
                </div>
              </div>

              {/* Lista limpia de estudiantes */}
              <div className="pt-3 border-t border-rose-100 dark:border-rose-900/40">
                <div className="text-[11px] font-semibold text-rose-900 dark:text-rose-300 mb-2">
                  Estudiantes ({analisis.bajo.count}):
                </div>
                {analisis.bajo.count === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                    Sin estudiantes en este rango
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {analisis.bajo.estudiantes.map((est) => (
                      <li
                        key={est.estudianteId}
                        className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/30"
                      >
                        <span className="truncate text-zinc-900 dark:text-zinc-100">
                          {est.nombreCompleto}
                        </span>
                        <span className="font-mono font-bold text-rose-700 dark:text-rose-400 shrink-0">
                          {est.definitiva.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Categoría 2: ACEPTABLE */}
            <div className="bg-white border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-bold text-sm text-amber-950 dark:text-amber-200">
                      Aceptable
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    3.0 a 3.9
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-amber-950 dark:text-amber-100">
                    {analisis.aceptable.count}
                  </span>
                  <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-400">
                    {analisis.aceptable.porcentaje.toFixed(1)}% del grupo
                  </span>
                </div>

                <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                  Estudiantes Aprobados
                </div>
              </div>

              {/* Lista limpia de estudiantes */}
              <div className="pt-3 border-t border-amber-100 dark:border-amber-900/40">
                <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  Estudiantes ({analisis.aceptable.count}):
                </div>
                {analisis.aceptable.count === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                    Sin estudiantes en este rango
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {analisis.aceptable.estudiantes.map((est) => (
                      <li
                        key={est.estudianteId}
                        className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30"
                      >
                        <span className="truncate text-zinc-900 dark:text-zinc-100">
                          {est.nombreCompleto}
                        </span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                          {est.definitiva.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Categoría 3: COMPETENTE */}
            <div className="bg-white border border-sky-200 dark:bg-sky-950/20 dark:border-sky-900/50 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <h4 className="font-bold text-sm text-sky-950 dark:text-sky-200">
                      Competente
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300">
                    4.0 a 4.5
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-sky-950 dark:text-sky-100">
                    {analisis.competente.count}
                  </span>
                  <span className="text-xs font-mono font-medium text-sky-700 dark:text-sky-400">
                    {analisis.competente.porcentaje.toFixed(1)}% del grupo
                  </span>
                </div>

                <div className="text-[11px] text-sky-700 dark:text-sky-400 font-medium mt-1">
                  Estudiantes Aprobados
                </div>
              </div>

              {/* Lista limpia de estudiantes */}
              <div className="pt-3 border-t border-sky-100 dark:border-sky-900/40">
                <div className="text-[11px] font-semibold text-sky-900 dark:text-sky-300 mb-2">
                  Estudiantes ({analisis.competente.count}):
                </div>
                {analisis.competente.count === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                    Sin estudiantes en este rango
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {analisis.competente.estudiantes.map((est) => (
                      <li
                        key={est.estudianteId}
                        className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/30"
                      >
                        <span className="truncate text-zinc-900 dark:text-zinc-100">
                          {est.nombreCompleto}
                        </span>
                        <span className="font-mono font-bold text-sky-700 dark:text-sky-400 shrink-0">
                          {est.definitiva.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Categoría 4: EXCELENTE */}
            <div className="bg-white border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                      Excelente
                    </h4>
                  </div>
                  <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    4.6 a 5.0
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-emerald-950 dark:text-emerald-100">
                    {analisis.excelente.count}
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400">
                    {analisis.excelente.porcentaje.toFixed(1)}% del grupo
                  </span>
                </div>

                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                  Estudiantes Aprobados
                </div>
              </div>

              {/* Lista limpia de estudiantes */}
              <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/40">
                <div className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 mb-2">
                  Estudiantes ({analisis.excelente.count}):
                </div>
                {analisis.excelente.count === 0 ? (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                    Sin estudiantes en este rango
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {analisis.excelente.estudiantes.map((est) => (
                      <li
                        key={est.estudianteId}
                        className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30"
                      >
                        <span className="truncate text-zinc-900 dark:text-zinc-100">
                          {est.nombreCompleto}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {est.definitiva.toFixed(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

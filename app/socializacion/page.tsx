"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Socializacion } from "@/lib/db";
import {
  calcularDefinitivaCorte,
  calcularProyeccionCorte3,
  type ProyeccionCorte3,
} from "@/lib/calculos";
import {
  UserCheck,
  Calendar,
  BookOpen,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calculator,
  MessageSquare,
  Sparkles,
  Users,
  AlertCircle,
  FileText,
  Save,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import Link from "next/link";

interface EstudianteSocializacionData {
  id: number;
  identificacion: string;
  nombreCompleto: string;
  definitivaActual: number | null;
  definitivaC1: number | null;
  proyeccionC3: ProyeccionCorte3 | null;
  socializacion?: Socializacion;
  estaSocializado: boolean;
  anotacion: string;
}

export default function SocializacionPage() {
  // 1. Filtros en cascada
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState<number | null>(null);
  const [selectedNumeroCorte, setSelectedNumeroCorte] = useState<number>(1);

  // Estados locales de la vista Master-Detail
  const [busqueda, setBusqueda] = useState("");
  const [selectedEstudianteId, setSelectedEstudianteId] = useState<number | null>(null);
  const [mostrarLista, setMostrarLista] = useState(true);

  // Estado local para edición rápida del textarea de anotaciones
  const [textoAnotacion, setTextoAnotacion] = useState("");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar periodos desde Dexie
  const periodos = useLiveQuery(() => db.periodos.toArray());

  useEffect(() => {
    if (periodos && periodos.length > 0 && selectedPeriodoId === null) {
      setSelectedPeriodoId(periodos[0].id!);
    }
  }, [periodos, selectedPeriodoId]);

  // Cargar asignaturas del periodo
  const asignaturas = useLiveQuery(
    () =>
      selectedPeriodoId
        ? db.asignaturas.where("periodoId").equals(selectedPeriodoId).toArray()
        : [],
    [selectedPeriodoId]
  );

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

  // 2. Extracción atómica de datos: Asignatura, Cortes, Actividades, Notas y Socializaciones
  const datosCorte = useLiveQuery(async () => {
    if (!selectedAsignaturaId) return null;

    const asignatura = await db.asignaturas.get(selectedAsignaturaId);

    const estudiantes = await db.estudiantes
      .where("asignaturaId")
      .equals(selectedAsignaturaId)
      .toArray();

    const cortes = await db.cortes
      .where("asignaturaId")
      .equals(selectedAsignaturaId)
      .sortBy("numeroCorte");

    const corteActual = cortes.find((c) => c.numeroCorte === selectedNumeroCorte);
    const corte1 = cortes.find((c) => c.numeroCorte === 1);

    const corteIds = cortes.map((c) => c.id!).filter(Boolean);

    // Actividades de los cortes
    const actividades =
      corteIds.length > 0
        ? await db.actividades.where("corteId").anyOf(corteIds).toArray()
        : [];

    const actividadIds = actividades.map((a) => a.id!).filter(Boolean);

    // Notas registradas
    const notas =
      actividadIds.length > 0
        ? await db.notas.where("actividadId").anyOf(actividadIds).toArray()
        : [];

    // Socializaciones de este corte actual
    const socializaciones = corteActual?.id
      ? await db.socializaciones.where("corteId").equals(corteActual.id).toArray()
      : [];

    return {
      asignatura,
      estudiantes,
      cortes,
      corteActual,
      corte1,
      actividades,
      notas,
      socializaciones,
    };
  }, [selectedAsignaturaId, selectedNumeroCorte]);

  // 3. Procesamiento en memoria de notas y estados de socialización
  const { listaEstudiantes, corteActual, corte1, actividadesActuales, notasMap } =
    useMemo(() => {
      if (!datosCorte) {
        return {
          listaEstudiantes: [],
          corteActual: null,
          corte1: null,
          actividadesActuales: [],
          notasMap: new Map<string, number>(),
        };
      }

      const {
        estudiantes,
        corteActual,
        corte1,
        actividades,
        notas,
        socializaciones,
      } = datosCorte;

      const actActuales = corteActual?.id
        ? actividades.filter((a) => a.corteId === corteActual.id)
        : [];

      const actCorte1 = corte1?.id
        ? actividades.filter((a) => a.corteId === corte1.id)
        : [];

      // Mapa rápido de notas: `${estudianteId}_${actividadId}` -> valor
      const nMap = new Map<string, number>();
      for (const n of notas) {
        nMap.set(`${n.estudianteId}_${n.actividadId}`, n.valor);
      }

      // Mapa rápido de socializaciones: estudianteId -> Socializacion
      const socMap = new Map<number, Socializacion>();
      for (const s of socializaciones) {
        socMap.set(s.estudianteId, s);
      }

      const pesoActual = corteActual?.porcentaje ?? (selectedNumeroCorte === 3 ? 30 : 35);
      const pesoC1 = corte1?.porcentaje ?? 35;

      const procesados: EstudianteSocializacionData[] = estudiantes.map((est) => {
        const defActual = calcularDefinitivaCorte(est.id!, actActuales, nMap, pesoActual);
        const soc = socMap.get(est.id!);
        const estaSocializado = soc?.estado === "socializado";

        let defC1: number | null = null;
        let proyC3: ProyeccionCorte3 | null = null;

        // Regla de negocio: Si el corte seleccionado es el 2, calcular la proyección con Corte 1
        if (selectedNumeroCorte === 2) {
          defC1 = calcularDefinitivaCorte(est.id!, actCorte1, nMap, pesoC1);
          proyC3 = calcularProyeccionCorte3(defC1, defActual);
        }

        return {
          id: est.id!,
          identificacion: est.identificacion,
          nombreCompleto: est.nombreCompleto,
          definitivaActual: defActual,
          definitivaC1: defC1,
          proyeccionC3: proyC3,
          socializacion: soc,
          estaSocializado,
          anotacion: soc?.anotacion ?? "",
        };
      });

      return {
        listaEstudiantes: procesados,
        corteActual,
        corte1,
        actividadesActuales: actActuales,
        notasMap: nMap,
      };
    }, [datosCorte, selectedNumeroCorte]);

  // Filtrado de estudiantes por buscador
  const estudiantesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return listaEstudiantes;
    const q = busqueda.toLowerCase().trim();
    return listaEstudiantes.filter(
      (e) =>
        e.nombreCompleto.toLowerCase().includes(q) ||
        e.identificacion.toLowerCase().includes(q)
    );
  }, [listaEstudiantes, busqueda]);

  // Auto-seleccionar primer estudiante si no hay ninguno seleccionado
  useEffect(() => {
    if (estudiantesFiltrados.length > 0) {
      const existe = estudiantesFiltrados.some((e) => e.id === selectedEstudianteId);
      if (!existe) {
        setSelectedEstudianteId(estudiantesFiltrados[0].id);
      }
    } else {
      setSelectedEstudianteId(null);
    }
  }, [estudiantesFiltrados, selectedEstudianteId]);

  // Estudiante actualmente seleccionado para el panel de detalle
  const estudianteSeleccionado = useMemo(() => {
    if (!selectedEstudianteId) return null;
    return (
      listaEstudiantes.find((e) => e.id === selectedEstudianteId) ?? null
    );
  }, [listaEstudiantes, selectedEstudianteId]);

  // Sincronizar el texto del textarea cuando cambia de estudiante seleccionado
  useEffect(() => {
    if (estudianteSeleccionado) {
      setTextoAnotacion(estudianteSeleccionado.anotacion);
    } else {
      setTextoAnotacion("");
    }
  }, [estudianteSeleccionado?.id, estudianteSeleccionado?.anotacion]);

  // Índice para navegación rápida con botones Anterior / Siguiente
  const currentIndex = useMemo(() => {
    if (!selectedEstudianteId) return -1;
    return estudiantesFiltrados.findIndex((e) => e.id === selectedEstudianteId);
  }, [estudiantesFiltrados, selectedEstudianteId]);

  const handleNavegarAnterior = () => {
    if (currentIndex > 0) {
      setSelectedEstudianteId(estudiantesFiltrados[currentIndex - 1].id);
    }
  };

  const handleNavegarSiguiente = () => {
    if (currentIndex >= 0 && currentIndex < estudiantesFiltrados.length - 1) {
      setSelectedEstudianteId(estudiantesFiltrados[currentIndex + 1].id);
    }
  };

  // Guardar cambio de estado de Socialización (Toggle)
  const handleToggleSocializado = async () => {
    if (!estudianteSeleccionado || !corteActual?.id) return;

    const nuevoEstado = estudianteSeleccionado.estaSocializado
      ? "pendiente"
      : "socializado";

    const fechaActual = new Date().toISOString();

    try {
      if (estudianteSeleccionado.socializacion?.id) {
        await db.socializaciones.update(estudianteSeleccionado.socializacion.id, {
          estado: nuevoEstado,
          fechaActualizacion: fechaActual,
        });
      } else {
        await db.socializaciones.add({
          estudianteId: estudianteSeleccionado.id,
          corteId: corteActual.id,
          estado: nuevoEstado,
          anotacion: textoAnotacion,
          fechaActualizacion: fechaActual,
        });
      }
    } catch (err) {
      console.error("Error al actualizar estado de socialización:", err);
      alert("No se pudo actualizar el estado.");
    }
  };

  // Guardar anotaciones / compromisos con auto-guardado en Dexie
  const guardarAnotacionEnBD = async (nuevoTexto: string) => {
    if (!estudianteSeleccionado || !corteActual?.id) return;

    setGuardandoNota(true);
    const fechaActual = new Date().toISOString();

    try {
      if (estudianteSeleccionado.socializacion?.id) {
        await db.socializaciones.update(estudianteSeleccionado.socializacion.id, {
          anotacion: nuevoTexto,
          fechaActualizacion: fechaActual,
        });
      } else {
        await db.socializaciones.add({
          estudianteId: estudianteSeleccionado.id,
          corteId: corteActual.id,
          estado: "pendiente",
          anotacion: nuevoTexto,
          fechaActualizacion: fechaActual,
        });
      }
    } catch (err) {
      console.error("Error al guardar anotación:", err);
    } finally {
      setGuardandoNota(false);
    }
  };

  const handleAnotacionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextoAnotacion(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      guardarAnotacionEnBD(val);
    }, 600);
  };

  // Progreso general de socialización
  const totalSocializados = listaEstudiantes.filter((e) => e.estaSocializado).length;
  const totalAlumnos = listaEstudiantes.length;
  const porcentajeProgreso =
    totalAlumnos > 0 ? (totalSocializados / totalAlumnos) * 100 : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* 1. Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <UserCheck className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Gestión de Acompañamiento 1 a 1</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Socialización de Notas
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Revisión íntima y personalizada de notas por estudiante, registro de compromisos y retroalimentación individual.
        </p>
      </div>

      {/* 2. Top Bar con Filtros en Cascada y Barra de Progreso */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Selector Periodo */}
          <div>
            <label
              htmlFor="soc-periodo"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Periodo Académico</span>
            </label>
            <select
              id="soc-periodo"
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

          {/* Selector Asignatura */}
          <div>
            <label
              htmlFor="soc-asignatura"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Asignatura</span>
            </label>
            <select
              id="soc-asignatura"
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
                    {a.nombre} — {a.programa}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Selector Corte */}
          <div>
            <label
              htmlFor="soc-corte"
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Corte a Socializar</span>
            </label>
            <select
              id="soc-corte"
              value={selectedNumeroCorte}
              onChange={(e) => setSelectedNumeroCorte(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
            >
              <option value={1}>Corte 1 (35%)</option>
              <option value={2}>Corte 2 (35%) + Simulador C3</option>
              <option value={3}>Corte 3 (30%)</option>
            </select>
          </div>
        </div>

        {/* Barra de Progreso de Socializaciones */}
        {totalAlumnos > 0 && (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Progreso de Socialización:
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {totalSocializados} / {totalAlumnos} completados ({porcentajeProgreso.toFixed(0)}%)
              </span>
            </div>

            <div className="w-full sm:w-64 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  totalSocializados === totalAlumnos
                    ? "bg-emerald-500"
                    : "bg-zinc-900 dark:bg-zinc-100"
                }`}
                style={{ width: `${porcentajeProgreso}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Estados Vacíos Previos */}
      {!periodos || periodos.length === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <Calendar className="w-10 h-10 text-zinc-400 mb-3" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No tienes periodos académicos registrados
          </p>
          <Link
            href="/periodos"
            className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
          >
            Crear Periodo
          </Link>
        </div>
      ) : !asignaturas || asignaturas.length === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <BookOpen className="w-10 h-10 text-zinc-400 mb-3" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No hay asignaturas en este periodo
          </p>
          <Link
            href="/asignaturas"
            className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
          >
            Crear Asignatura
          </Link>
        </div>
      ) : listaEstudiantes.length === 0 ? (
        <div className="p-12 bg-white border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center">
          <Users className="w-10 h-10 text-zinc-400 mb-3" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No hay estudiantes matriculados en esta asignatura
          </p>
          {selectedAsignaturaId && (
            <Link
              href={`/asignaturas/${selectedAsignaturaId}`}
              className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg transition-colors"
            >
              Importar Estudiantes
            </Link>
          )}
        </div>
      ) : (
        /* 4. Layout Master-Detail */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* PANEL IZQUIERDO: Lista de Estudiantes (Master) */}
          {mostrarLista && (
            <div className="md:col-span-5 lg:col-span-4 bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden flex flex-col">
              {/* Buscador y Botón de Ocultar Lista */}
              <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante o ID..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:bg-white dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarLista(false)}
                  className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
                  title="Ocultar lista (Modo Privacidad)"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Lista scrollable de estudiantes */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[calc(100vh-320px)] min-h-[400px] overflow-y-auto">
                {estudiantesFiltrados.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No se encontraron estudiantes con &quot;{busqueda}&quot;
                  </div>
                ) : (
                  estudiantesFiltrados.map((est, idx) => {
                    const isSelected = est.id === selectedEstudianteId;

                    return (
                      <button
                        key={est.id}
                        type="button"
                        onClick={() => setSelectedEstudianteId(est.id)}
                        className={`w-full text-left p-3.5 transition-colors flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-zinc-100 border-l-4 border-zinc-900 dark:bg-zinc-800/80 dark:border-zinc-100"
                            : "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-zinc-400">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                              {est.nombreCompleto}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {est.identificacion}
                          </div>

                          {/* Estado Visual de Socialización */}
                          <div className="mt-2 flex items-center gap-2">
                            {est.estaSocializado ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Socializado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                <Clock className="w-3 h-3 text-zinc-400" />
                                <span>Pendiente</span>
                              </span>
                            )}

                            {est.anotacion && (
                              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5" title="Tiene observaciones">
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>Nota</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Calificación Definitiva del Corte */}
                        <div className="text-right shrink-0">
                          {est.definitivaActual !== null ? (
                            <span
                              className={`font-mono text-sm font-bold block ${
                                est.definitivaActual >= 3.0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {est.definitivaActual.toFixed(1)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-zinc-400">—</span>
                          )}
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                            Corte {selectedNumeroCorte}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* PANEL DERECHO: Detalle del Alumno Seleccionado (Detail) */}
          <div
            className={`${
              mostrarLista ? "md:col-span-7 lg:col-span-8" : "md:col-span-12"
            } bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl p-6 space-y-6 transition-all`}
          >
            {!estudianteSeleccionado ? (
              <div className="p-16 text-center text-zinc-400 flex flex-col items-center justify-center">
                <Users className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Selecciona un estudiante de la lista</p>
              </div>
            ) : (
              <>
                {/* Cabecera del Estudiante con Navegación Rápida */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    {!mostrarLista && (
                      <button
                        type="button"
                        onClick={() => setMostrarLista(true)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5 shrink-0"
                        title="Mostrar lista de estudiantes"
                      >
                        <PanelLeft className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        <span>Mostrar Lista</span>
                      </button>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                          {estudianteSeleccionado.nombreCompleto}
                        </h2>
                      </div>
                      <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Identificación: {estudianteSeleccionado.identificacion}
                      </p>
                    </div>
                  </div>

                  {/* Controles de Navegación Anterior / Siguiente */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleNavegarAnterior}
                      disabled={currentIndex <= 0}
                      className="px-2.5 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors flex items-center gap-1"
                      title="Estudiante anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Anterior</span>
                    </button>

                    <span className="text-[11px] font-mono text-zinc-400 px-1">
                      {currentIndex + 1} de {estudiantesFiltrados.length}
                    </span>

                    <button
                      type="button"
                      onClick={handleNavegarSiguiente}
                      disabled={currentIndex >= estudiantesFiltrados.length - 1}
                      className="px-2.5 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors flex items-center gap-1"
                      title="Siguiente estudiante"
                    >
                      <span>Siguiente</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tarjeta de Calificación Definitiva del Corte */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 p-4 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col justify-between">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Definitiva Corte {selectedNumeroCorte}
                    </span>
                    <div className="my-2">
                      <span
                        className={`text-3xl font-extrabold font-mono ${
                          estudianteSeleccionado.definitivaActual !== null &&
                          estudianteSeleccionado.definitivaActual >= 3.0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {estudianteSeleccionado.definitivaActual !== null
                          ? estudianteSeleccionado.definitivaActual.toFixed(1)
                          : "0.0"}
                      </span>
                      <span className="text-xs font-normal text-zinc-400 ml-1">/ 5.0</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Ponderación: {corteActual?.porcentaje ?? 35}% del semestre
                    </span>
                  </div>

                  {/* Estado de Socialización y Botón de Toggle */}
                  <div className="sm:col-span-2 p-4 rounded-xl bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Estado de Socialización
                      </span>
                      {estudianteSeleccionado.socializacion?.fechaActualizacion && (
                        <span className="text-[10px] text-zinc-400">
                          {new Date(
                            estudianteSeleccionado.socializacion.fechaActualizacion
                          ).toLocaleDateString()}{" "}
                          {new Date(
                            estudianteSeleccionado.socializacion.fechaActualizacion
                          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div className="my-2">
                      <button
                        type="button"
                        onClick={handleToggleSocializado}
                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                          estudianteSeleccionado.estaSocializado
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/10"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {estudianteSeleccionado.estaSocializado
                            ? "✓ Socialización Realizada (Clic para desmarcar)"
                            : "Marcar como Socializado"}
                        </span>
                      </button>
                    </div>

                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {estudianteSeleccionado.estaSocializado
                        ? "Las notas han sido revisadas en conjunto con el estudiante."
                        : "Pendiente de mostrar y validar calificaciones con el estudiante."}
                    </span>
                  </div>
                </div>

                {/* Desglose de Actividades del Corte */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Desglose de Calificaciones Evaluativas — Corte {selectedNumeroCorte}</span>
                  </div>

                  {actividadesActuales.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg">
                      No hay actividades configuradas para este corte.
                    </p>
                  ) : (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-medium border-b border-zinc-200 dark:border-zinc-800">
                          <tr>
                            <th className="px-3 py-2">Actividad</th>
                            <th className="px-3 py-2 text-center">Tipo / Peso</th>
                            <th className="px-3 py-2 text-center">Nota Obtenida</th>
                            <th className="px-3 py-2 text-right">Aporte al Corte</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {actividadesActuales.map((act) => {
                            const nota =
                              notasMap.get(
                                `${estudianteSeleccionado.id}_${act.id}`
                              ) ?? null;

                            const isBono = !!act.esBonificacion;
                            const pesoCorteNum = corteActual?.porcentaje ?? 35;
                            const aporte =
                              nota !== null
                                ? isBono
                                  ? `+${nota.toFixed(1)} décimas directas`
                                  : `${((nota * (act.porcentaje / 100)) / (pesoCorteNum / 100)).toFixed(2)} pts`
                                : "0.0 pts";

                            return (
                              <tr
                                key={act.id}
                                className={isBono ? "bg-amber-50/30 dark:bg-amber-950/15" : ""}
                              >
                                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                                  <div className="flex items-center gap-1.5">
                                    {isBono && (
                                      <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                                    )}
                                    <span>{act.nombre}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-[11px] text-zinc-500">
                                  {isBono ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold text-[10px]">
                                      Bonificación
                                    </span>
                                  ) : (
                                    `${act.porcentaje}%`
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center font-mono font-bold">
                                  {nota !== null ? (
                                    <span
                                      className={
                                        nota >= 3.0
                                          ? "text-zinc-900 dark:text-zinc-100"
                                          : "text-rose-600 dark:text-rose-400"
                                      }
                                    >
                                      {nota.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 font-normal">Sin nota</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                                  {aporte}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* REGLA DEL SIMULADOR: Si el corte seleccionado es el 2 */}
                {selectedNumeroCorte === 2 && estudianteSeleccionado.proyeccionC3 && (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                        <h4 className="font-bold text-sm text-amber-950 dark:text-amber-200">
                          Simulación y Proyección — Corte 3 (30%)
                        </h4>
                      </div>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-semibold uppercase">
                        Acumulado 70%
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Acumulado al 70% */}
                      <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/30">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Puntos acumulados al 70%:
                        </span>
                        <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50 mt-1">
                          {estudianteSeleccionado.proyeccionC3.acumulado70.toFixed(2)}
                          <span className="text-xs font-normal text-zinc-400 ml-1">
                            / 3.5 pts
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          C1: {estudianteSeleccionado.definitivaC1?.toFixed(1) ?? "0.0"} (35%) + C2:{" "}
                          {estudianteSeleccionado.definitivaActual?.toFixed(1) ?? "0.0"} (35%)
                        </p>
                      </div>

                      {/* Nota requerida en el Corte 3 */}
                      <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-amber-900/30">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          Nota requerida en Corte 3 (30%):
                        </span>
                        <div className="text-2xl font-bold font-mono mt-1">
                          {estudianteSeleccionado.proyeccionC3.estado === "ya_aprobo" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              0.0
                            </span>
                          ) : (
                            <span
                              className={
                                estudianteSeleccionado.proyeccionC3.notaRequeridaCorte3 <= 3.0
                                  ? "text-sky-600 dark:text-sky-400"
                                  : estudianteSeleccionado.proyeccionC3.notaRequeridaCorte3 <= 5.0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {estudianteSeleccionado.proyeccionC3.notaRequeridaCorte3.toFixed(1)}
                            </span>
                          )}
                          <span className="text-xs font-normal text-zinc-400 ml-1">/ 5.0</span>
                        </div>
                        <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 mt-0.5">
                          {estudianteSeleccionado.proyeccionC3.mensaje}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Zona de Anotaciones / Compromisos */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="anotacion-estudiante"
                      className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Anotaciones / Compromisos de la Socialización</span>
                    </label>

                    {guardandoNota && (
                      <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                        <Save className="w-3 h-3 animate-spin" />
                        <span>Guardando...</span>
                      </span>
                    )}
                  </div>

                  <textarea
                    id="anotacion-estudiante"
                    rows={4}
                    value={textoAnotacion}
                    onChange={handleAnotacionChange}
                    placeholder="Registra compromisos, acuerdos de entrega tardía, aclaraciones de preguntas del examen o reclamos atendidos..."
                    className="w-full p-3 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:ring-zinc-600 dark:focus:border-zinc-600 transition-colors"
                  />
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Los cambios se guardan automáticamente en tu base de datos local al escribir.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

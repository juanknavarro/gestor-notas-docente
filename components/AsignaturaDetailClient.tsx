"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Estudiante } from "@/lib/db";
import { VistaCorte } from "@/components/VistaCorte";
import { VistaConsolidado } from "@/components/VistaConsolidado";
import {
  ArrowLeft,
  BookOpen,
  Users,
  Upload,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Sparkles,
  Search,
  Pencil,
  Check,
  X,
  Layers,
  Calculator,
  UserPlus,
  UserCheck,
} from "lucide-react";

interface ParsedStudent {
  identificacion: string;
  nombreCompleto: string;
}

/**
 * Función robusta para parsear texto copiado de la tabla web de Elysa
 */
function parseElysaText(rawText: string): ParsedStudent[] {
  const lines = rawText.split(/\r?\n/);
  const results: ParsedStudent[] = [];
  const seenIds = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let columns = line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);

    if (columns.length <= 1) {
      if (line.includes(";")) {
        columns = line.split(";").map((c) => c.trim()).filter((c) => c.length > 0);
      } else if (/\s{2,}/.test(line)) {
        columns = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
      }
    }

    if (columns.length === 0) continue;

    const firstColLower = columns[0].toLowerCase();
    if (
      firstColLower.includes("identifica") ||
      firstColLower.includes("cédula") ||
      firstColLower.includes("cedula") ||
      firstColLower.includes("documento") ||
      firstColLower.includes("código") ||
      firstColLower.includes("codigo") ||
      firstColLower.includes("estudiante") ||
      firstColLower.includes("nombre") ||
      firstColLower === "no" ||
      firstColLower === "nº" ||
      firstColLower === "#"
    ) {
      continue;
    }

    let identificacion = "";
    let nombreCompleto = "";

    const numericCols = columns.filter((col) => /^\d{5,15}$/.test(col.replace(/[-.]/g, "")));
    const textCols = columns.filter((col) => !/^\d+$/.test(col.replace(/[-.]/g, "")) && col.length >= 3);

    if (numericCols.length > 0 && textCols.length > 0) {
      identificacion = numericCols[0].replace(/[-.]/g, "").trim();
      const candidateNames = textCols.filter(
        (c) => !["ACTIVO", "INACTIVO", "MATRICULADO", "REGULAR", "SI", "NO"].includes(c.toUpperCase())
      );
      nombreCompleto = candidateNames.length > 0 ? candidateNames[0] : textCols[0];
    } else if (columns.length >= 2) {
      if (/^\d{1,3}$/.test(columns[0]) && columns.length >= 3) {
        identificacion = columns[1].replace(/[-.]/g, "");
        nombreCompleto = columns[2];
      } else if (/^\d+$/.test(columns[0].replace(/[-.]/g, ""))) {
        identificacion = columns[0].replace(/[-.]/g, "");
        nombreCompleto = columns[1];
      } else {
        nombreCompleto = columns[0];
        identificacion = columns[1].replace(/[-.]/g, "");
      }
    }

    identificacion = identificacion.trim();
    nombreCompleto = nombreCompleto.trim();

    if (identificacion && nombreCompleto && !seenIds.has(identificacion)) {
      seenIds.add(identificacion);
      results.push({ identificacion, nombreCompleto });
    }
  }

  return results;
}

interface AsignaturaDetailClientProps {
  asignaturaId: number;
}

type TabType = "estudiantes" | "corte-1" | "corte-2" | "corte-3" | "consolidado";

export function AsignaturaDetailClient({ asignaturaId }: AsignaturaDetailClientProps) {
  // Estado para la navegación por pestañas (Tabs)
  const [activeTab, setActiveTab] = useState<TabType>("estudiantes");

  // Estados para importación Elysa
  const [rawText, setRawText] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para Edición en Línea de Estudiantes
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [editIdentificacion, setEditIdentificacion] = useState("");
  const [editNombre, setEditNombre] = useState("");

  // Estados para Ingreso Manual de Estudiante
  const [manualIdentificacion, setManualIdentificacion] = useState("");
  const [manualNombre, setManualNombre] = useState("");
  const [manualEsAsistente, setManualEsAsistente] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualExito, setManualExito] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Cargas reactivas de Dexie
  const asignatura = useLiveQuery(
    () => (asignaturaId ? db.asignaturas.get(asignaturaId) : undefined),
    [asignaturaId]
  );

  const periodo = useLiveQuery(
    () => (asignatura?.periodoId ? db.periodos.get(asignatura.periodoId) : undefined),
    [asignatura?.periodoId]
  );

  const cortes = useLiveQuery(
    () => (asignaturaId ? db.cortes.where("asignaturaId").equals(asignaturaId).sortBy("numeroCorte") : []),
    [asignaturaId]
  );

  const estudiantes = useLiveQuery(
    () => (asignaturaId ? db.estudiantes.where("asignaturaId").equals(asignaturaId).toArray() : []),
    [asignaturaId]
  );

  // Asegurar que existan los 3 cortes reglamentarios en caso de datos iniciales
  useEffect(() => {
    if (asignatura && cortes && cortes.length === 0) {
      db.cortes.bulkAdd([
        { asignaturaId, numeroCorte: 1, porcentaje: 35 },
        { asignaturaId, numeroCorte: 2, porcentaje: 35 },
        { asignaturaId, numeroCorte: 3, porcentaje: 30 },
      ]);
    }
  }, [asignatura, cortes, asignaturaId]);

  const corte1 = cortes?.find((c) => c.numeroCorte === 1);
  const corte2 = cortes?.find((c) => c.numeroCorte === 2);
  const corte3 = cortes?.find((c) => c.numeroCorte === 3);

  const estudiantesDetectados = useMemo(() => {
    if (!rawText.trim()) return [];
    return parseElysaText(rawText);
  }, [rawText]);

  // Manejadores de Ingesta Masiva Elysa (Upsert Atómico y Seguro)
  const handleProcesarYGuardar = async () => {
    setFeedback(null);

    if (!asignaturaId) {
      setFeedback({ type: "error", message: "Asignatura no válida." });
      return;
    }

    if (estudiantesDetectados.length === 0) {
      setFeedback({
        type: "error",
        message: "No se identificaron estudiantes válidos en el texto pegado. Verifica el formato.",
      });
      return;
    }

    try {
      setIsProcessing(true);

      let nuevosCount = 0;
      let legalizadosCount = 0;
      let actualizadosCount = 0;
      let sinCambiosCount = 0;

      await db.transaction("rw", db.estudiantes, async () => {
        const existentes = await db.estudiantes
          .where("asignaturaId")
          .equals(asignaturaId)
          .toArray();

        const existentesMap = new Map(existentes.map((e) => [e.identificacion, e]));
        const nuevosParaInsertar: Omit<Estudiante, "id">[] = [];

        for (const detectado of estudiantesDetectados) {
          const existente = existentesMap.get(detectado.identificacion);

          if (!existente) {
            // 1. Nuevo estudiante oficial proveniente de Elysa
            nuevosParaInsertar.push({
              asignaturaId,
              identificacion: detectado.identificacion,
              nombreCompleto: detectado.nombreCompleto,
              estadoMatricula: "oficial",
              fechaCambioEstado: new Date().toISOString(),
            });
            nuevosCount++;
          } else {
            // 2. Ya existía en la asignatura
            const eraAsistente = existente.estadoMatricula === "asistente";
            const nombreCambio = existente.nombreCompleto !== detectado.nombreCompleto;

            if (eraAsistente || nombreCambio) {
              await db.estudiantes.update(existente.id!, {
                nombreCompleto: detectado.nombreCompleto,
                estadoMatricula: "oficial",
                ...(eraAsistente ? { fechaCambioEstado: new Date().toISOString() } : {}),
              });

              if (eraAsistente) {
                legalizadosCount++;
              } else if (nombreCambio) {
                actualizadosCount++;
              }
            } else {
              sinCambiosCount++;
            }
          }
        }

        if (nuevosParaInsertar.length > 0) {
          await db.estudiantes.bulkAdd(nuevosParaInsertar);
        }
      });

      const partesMensaje: string[] = [];
      if (nuevosCount > 0) partesMensaje.push(`${nuevosCount} nuevo(s) matriculado(s)`);
      if (legalizadosCount > 0) partesMensaje.push(`${legalizadosCount} legalizado(s) de asistente a oficial`);
      if (actualizadosCount > 0) partesMensaje.push(`${actualizadosCount} nombre(s) actualizado(s)`);
      if (sinCambiosCount > 0) partesMensaje.push(`${sinCambiosCount} sin cambios`);

      const mensajeFinal = `Procesamiento completado: ${partesMensaje.join(", ")}.`;

      setFeedback({ type: "success", message: mensajeFinal });
      setRawText("");
    } catch (err) {
      console.error("Error al procesar estudiantes:", err);
      setFeedback({
        type: "error",
        message: "Ocurrió un error al procesar y guardar los estudiantes en la base de datos local.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Manejador de Ingreso Manual de Estudiante
  const handleAgregarEstudianteManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualExito(null);

    const cleanId = manualIdentificacion.trim();
    const cleanNombre = manualNombre.trim();

    if (!cleanId) {
      setManualError("Ingresa la identificación del estudiante.");
      return;
    }

    if (!cleanNombre) {
      setManualError("Ingresa el nombre completo del estudiante.");
      return;
    }

    try {
      setIsSubmittingManual(true);

      const existente = await db.estudiantes
        .where("asignaturaId")
        .equals(asignaturaId)
        .and((est) => est.identificacion === cleanId)
        .first();

      if (existente) {
        setManualError(`Ya existe un estudiante con la identificación "${cleanId}" en esta asignatura.`);
        return;
      }

      const estadoMatricula = manualEsAsistente ? "asistente" : "oficial";

      await db.estudiantes.add({
        asignaturaId,
        identificacion: cleanId,
        nombreCompleto: cleanNombre,
        estadoMatricula,
        fechaCambioEstado: new Date().toISOString(),
      });

      setManualIdentificacion("");
      setManualNombre("");
      setManualEsAsistente(false);
      setManualExito(
        `Estudiante "${cleanNombre}" agregado exitosamente como ${
          estadoMatricula === "asistente" ? "Asistente" : "Oficial"
        }.`
      );

      setTimeout(() => setManualExito(null), 4000);
    } catch (err) {
      console.error("Error al agregar estudiante manualmente:", err);
      setManualError("Ocurrió un error al guardar el estudiante.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Manejador para Legalizar Matrícula de un Asistente
  const handleLegalizarMatricula = async (estudiante: Estudiante) => {
    if (!estudiante.id) return;
    const confirmacion = window.confirm(
      `¿Deseas legalizar la matrícula de "${estudiante.nombreCompleto}" pasando su estado a Oficial?`
    );
    if (!confirmacion) return;

    try {
      await db.estudiantes.update(estudiante.id, {
        estadoMatricula: "oficial",
        fechaCambioEstado: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error al legalizar matrícula:", err);
      alert("No se pudo legalizar la matrícula del estudiante.");
    }
  };

  // Manejadores de Edición en Línea
  const handleIniciarEdicionEstudiante = (estudiante: Estudiante) => {
    if (!estudiante.id) return;
    setEditingStudentId(estudiante.id);
    setEditIdentificacion(estudiante.identificacion);
    setEditNombre(estudiante.nombreCompleto);
  };

  const handleCancelarEdicionEstudiante = () => {
    setEditingStudentId(null);
    setEditIdentificacion("");
    setEditNombre("");
  };

  const handleGuardarEdicionEstudiante = async (estudianteId: number) => {
    const trimmedIdentificacion = editIdentificacion.trim();
    const trimmedNombre = editNombre.trim();

    if (!trimmedIdentificacion) {
      alert("La identificación no puede estar vacía.");
      return;
    }

    if (!trimmedNombre) {
      alert("El nombre completo no puede estar vacío.");
      return;
    }

    try {
      const existente = await db.estudiantes
        .where("asignaturaId")
        .equals(asignaturaId)
        .and((e) => e.identificacion === trimmedIdentificacion && e.id !== estudianteId)
        .first();

      if (existente) {
        alert(`Ya existe otro estudiante registrado con la identificación "${trimmedIdentificacion}" en esta asignatura.`);
        return;
      }

      await db.estudiantes.update(estudianteId, {
        identificacion: trimmedIdentificacion,
        nombreCompleto: trimmedNombre,
      });

      handleCancelarEdicionEstudiante();
    } catch (err) {
      console.error("Error al actualizar estudiante:", err);
      alert("Ocurrió un error al actualizar los datos del estudiante.");
    }
  };

  const handleEliminarEstudiante = async (estudiante: Estudiante) => {
    if (!estudiante.id) return;
    const confirmacion = window.confirm(
      `¿Deseas eliminar a "${estudiante.nombreCompleto}" (${estudiante.identificacion}) de esta asignatura?`
    );
    if (!confirmacion) return;

    try {
      if (editingStudentId === estudiante.id) {
        handleCancelarEdicionEstudiante();
      }

      await db.transaction("rw", db.estudiantes, db.notas, async () => {
        await db.notas.where("estudianteId").equals(estudiante.id!).delete();
        await db.estudiantes.delete(estudiante.id!);
      });
    } catch (err) {
      console.error("Error al eliminar estudiante:", err);
      alert("No se pudo eliminar al estudiante.");
    }
  };

  const estudiantesFiltrados = useMemo(() => {
    if (!estudiantes) return [];
    if (!searchTerm.trim()) return estudiantes;
    const term = searchTerm.toLowerCase();
    return estudiantes.filter(
      (e) =>
        e.nombreCompleto.toLowerCase().includes(term) ||
        e.identificacion.includes(term)
    );
  }, [estudiantes, searchTerm]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Botón Volver y Cabecera de Asignatura */}
      <div>
        <div className="mb-3">
          <Link
            href="/asignaturas"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Asignaturas</span>
          </Link>
        </div>

        {asignatura ? (
          <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
                <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>{asignatura.programa}</span>
              </div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                {asignatura.nombre}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs mt-1">
                Periodo: <span className="text-zinc-900 dark:text-zinc-200 font-medium">{periodo?.nombre || "Cargando..."}</span>
              </p>
            </div>

            {/* Badges de ponderación general */}
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 dark:bg-zinc-950/80 dark:border-zinc-800 p-1.5 rounded-lg shrink-0">
              <div className="px-3 py-1.5 bg-white border border-zinc-200 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-none rounded-md text-center">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Corte 1
                </p>
                <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                  {corte1?.porcentaje ?? 35}%
                </p>
              </div>
              <div className="px-3 py-1.5 bg-white border border-zinc-200 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-none rounded-md text-center">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Corte 2
                </p>
                <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                  {corte2?.porcentaje ?? 35}%
                </p>
              </div>
              <div className="px-3 py-1.5 bg-white border border-zinc-200 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800 dark:shadow-none rounded-md text-center">
                <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Corte 3
                </p>
                <p className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                  {corte3?.porcentaje ?? 30}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white border border-zinc-200 dark:bg-zinc-900/50 dark:border-zinc-800 rounded-xl text-sm text-zinc-500">
            Cargando información de la asignatura...
          </div>
        )}
      </div>

      {/* 2. Sistema de Pestañas (Tabs) */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("estudiantes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "estudiantes"
              ? "border-zinc-900 text-zinc-900 bg-white dark:border-zinc-100 dark:text-zinc-50 dark:bg-zinc-900/40"
              : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Estudiantes</span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400">
            {estudiantes ? estudiantes.length : 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corte-1")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "corte-1"
              ? "border-zinc-900 text-zinc-900 bg-white dark:border-zinc-100 dark:text-zinc-50 dark:bg-zinc-900/40"
              : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Corte 1 (35%)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corte-2")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "corte-2"
              ? "border-zinc-900 text-zinc-900 bg-white dark:border-zinc-100 dark:text-zinc-50 dark:bg-zinc-900/40"
              : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Corte 2 (35%)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corte-3")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "corte-3"
              ? "border-zinc-900 text-zinc-900 bg-white dark:border-zinc-100 dark:text-zinc-50 dark:bg-zinc-900/40"
              : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Corte 3 (30%)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("consolidado")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 -mb-px shrink-0 ${
            activeTab === "consolidado"
              ? "border-zinc-900 text-zinc-900 bg-white dark:border-zinc-100 dark:text-zinc-50 dark:bg-zinc-900/40"
              : "border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Consolidado & Simulador</span>
        </button>
      </div>

      {/* 3. Contenido según la pestaña activa */}
      {activeTab === "estudiantes" && (
        <div className="space-y-8">
          {/* Módulo de Ingesta Elysa (Card) */}
          <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700/60 dark:text-zinc-200 rounded-lg">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Importar estudiantes desde Elysa
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Copia las filas directamente desde la tabla de estudiantes del portal Elysa y pégalas en el recuadro.
                  </p>
                </div>
              </div>

              {estudiantesDetectados.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  {estudiantesDetectados.length} detectado(s)
                </span>
              )}
            </div>

            <textarea
              rows={6}
              placeholder={`Pega aquí el contenido copiado de la tabla de Elysa...\nEjemplo:\n1003456789\tPEREZ GOMEZ JUAN CARLOS\n1007890123\tRODRIGUEZ DIAZ MARIA`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full p-4 text-xs font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
            />

            {/* Acciones y feedback */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                El analizador extrae automáticamente la <strong>Identificación</strong> y el <strong>Nombre Completo</strong>, descartando encabezados y estados.
              </p>

              <button
                type="button"
                onClick={handleProcesarYGuardar}
                disabled={isProcessing || estudiantesDetectados.length === 0}
                className="w-full sm:w-auto px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-zinc-900/10 dark:shadow-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? "Guardando..."
                    : estudiantesDetectados.length > 0
                    ? `Procesar y Guardar (${estudiantesDetectados.length})`
                    : "Procesar y Guardar"}
                </span>
              </button>
            </div>

            {feedback && (
              <div
                className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg border ${
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50"
                    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>

          {/* Formulario de Ingreso Manual de Estudiante */}
          <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700/60 dark:text-zinc-200 rounded-lg">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Agregar Estudiante Manualmente
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Registra estudiantes de forma individual o añádelos temporalmente como asistentes.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAgregarEstudianteManual} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label
                    htmlFor="manual-identificacion"
                    className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Identificación
                  </label>
                  <input
                    id="manual-identificacion"
                    type="text"
                    placeholder="Ej. 1003456789"
                    value={manualIdentificacion}
                    onChange={(e) => setManualIdentificacion(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label
                    htmlFor="manual-nombre"
                    className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Nombre Completo
                  </label>
                  <input
                    id="manual-nombre"
                    type="text"
                    placeholder="Ej. PEREZ GOMEZ JUAN CARLOS"
                    value={manualNombre}
                    onChange={(e) => setManualNombre(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={isSubmittingManual}
                    className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Agregar Estudiante</span>
                  </button>
                </div>
              </div>

              {/* Checkbox Asistente */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={manualEsAsistente}
                    onChange={(e) => setManualEsAsistente(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <span>Ingresar como Asistente (Pendiente de Matrícula)</span>
                </label>
                <span className="text-[11px] text-zinc-400">
                  {manualEsAsistente ? "Se marcará como Asistente con badge ámbar" : "Se registrará con matrícula Oficial"}
                </span>
              </div>

              {manualError && (
                <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              {manualExito && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900/50 px-3 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{manualExito}</span>
                </div>
              )}
            </form>
          </div>

          {/* Lista de estudiantes matriculados (Card) */}
          <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
                  Estudiantes Matriculados
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-800/80 dark:border-zinc-700/60 dark:text-zinc-300">
                  {estudiantes ? estudiantes.length : 0}
                </span>
              </div>

              {/* Buscador */}
              {estudiantes && estudiantes.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por cédula o nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  />
                </div>
              )}
            </div>

            {estudiantes === undefined ? (
              <div className="p-8 text-center text-sm text-zinc-500">
                Cargando lista de estudiantes desde IndexedDB...
              </div>
            ) : estudiantes.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">No hay estudiantes en esta asignatura</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Utiliza el recuadro superior para pegar e importar el listado de estudiantes proveniente de Elysa.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50/80 text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400 text-xs uppercase font-medium border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3 w-16">#</th>
                      <th className="px-6 py-3 w-44">Identificación</th>
                      <th className="px-6 py-3">Nombre Completo</th>
                      <th className="px-6 py-3 w-40 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {estudiantesFiltrados.map((estudiante, index) => {
                      const isEditing = estudiante.id === editingStudentId;
                      const esAsistente = estudiante.estadoMatricula === "asistente";

                      return (
                        <tr
                          key={estudiante.id}
                          className={`transition-colors ${
                            isEditing
                              ? "bg-zinc-100/70 dark:bg-zinc-800/40"
                              : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30"
                          }`}
                        >
                          <td className="px-6 py-3.5 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
                            {index + 1}
                          </td>

                          {/* Celda Identificación */}
                          <td className="px-6 py-3.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editIdentificacion}
                                onChange={(e) => setEditIdentificacion(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleGuardarEdicionEstudiante(estudiante.id!);
                                  if (e.key === "Escape") handleCancelarEdicionEstudiante();
                                }}
                                placeholder="Identificación..."
                                autoFocus
                                className="w-full px-2.5 py-1 text-xs font-mono rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-500 transition-colors"
                              />
                            ) : (
                              <span className="font-mono text-xs text-zinc-800 dark:text-zinc-300">
                                {estudiante.identificacion}
                              </span>
                            )}
                          </td>

                          {/* Celda Nombre Completo con Badge de Asistente/Oficial */}
                          <td className="px-6 py-3.5">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editNombre}
                                onChange={(e) => setEditNombre(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleGuardarEdicionEstudiante(estudiante.id!);
                                  if (e.key === "Escape") handleCancelarEdicionEstudiante();
                                }}
                                placeholder="Nombre completo..."
                                className="w-full px-2.5 py-1 text-xs font-medium rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-500 transition-colors"
                              />
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {estudiante.nombreCompleto}
                                </span>
                                {esAsistente ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-800/60">
                                    <span>Asistente</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="text-zinc-400 dark:text-zinc-500">Oficial</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-6 py-3.5 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleGuardarEdicionEstudiante(estudiante.id!)}
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40 p-1.5 rounded-lg transition-colors"
                                  title="Guardar cambios (Enter)"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleCancelarEdicionEstudiante}
                                  className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800/50 p-1.5 rounded-lg transition-colors"
                                  title="Cancelar edición (Esc)"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {esAsistente && (
                                  <button
                                    type="button"
                                    onClick={() => handleLegalizarMatricula(estudiante)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/60 rounded-md transition-colors mr-1"
                                    title="Legalizar matrícula: pasar a Oficial"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Legalizar</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleIniciarEdicionEstudiante(estudiante)}
                                  className="text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 p-1.5 rounded-lg transition-colors"
                                  title="Editar estudiante"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEliminarEstudiante(estudiante)}
                                  className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                                  title="Eliminar de la asignatura"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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
      )}

      {/* Renderizado de Corte 1 */}
      {activeTab === "corte-1" && corte1?.id && (
        <VistaCorte
          asignaturaId={asignaturaId}
          corteId={corte1.id}
          pesoCorte={corte1.porcentaje}
          numeroCorte={1}
        />
      )}

      {/* Renderizado de Corte 2 */}
      {activeTab === "corte-2" && corte2?.id && (
        <VistaCorte
          asignaturaId={asignaturaId}
          corteId={corte2.id}
          pesoCorte={corte2.porcentaje}
          numeroCorte={2}
        />
      )}

      {/* Renderizado de Corte 3 */}
      {activeTab === "corte-3" && corte3?.id && (
        <VistaCorte
          asignaturaId={asignaturaId}
          corteId={corte3.id}
          pesoCorte={corte3.porcentaje}
          numeroCorte={3}
        />
      )}

      {/* Renderizado de Consolidado y Simulador */}
      {activeTab === "consolidado" && (
        <VistaConsolidado asignaturaId={asignaturaId} />
      )}
    </div>
  );
}

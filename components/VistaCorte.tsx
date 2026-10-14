"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Actividad } from "@/lib/db";
import {
  calcularDefinitivaCorte,
  calcularDetalleDefinitivaCorte,
  obtenerClasesSemaforoNota,
  type DetalleDefinitivaCorte,
} from "@/lib/calculos";
import {
  generarPlantillaExcelCorte,
  procesarExcelNotas,
  type ResultadoImportacionExcel,
} from "@/lib/excel-corte";
import {
  prepararDatosInformeCorte,
  prepararDatosPlanMejoramiento,
} from "@/lib/reportes";
import { generarExcelMortalidad } from "@/lib/generadorMortalidad";
import { generarExcelMejoramiento } from "@/lib/generadorMejoramiento";
import {
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Calculator,
  CheckCircle2,
  Check,
  X,
  Sparkles,
  Download,
  FileUp,
  Target,
  ChevronDown,
  FileText,
  BarChart3,
  FileCheck2,
  Loader2,
} from "lucide-react";

interface VistaCorteProps {
  asignaturaId: number;
  corteId: number;
  pesoCorte: number; // Ej. 35 o 30
  numeroCorte: number; // Ej. 1, 2 o 3
}

export function VistaCorte({
  asignaturaId,
  corteId,
  pesoCorte,
  numeroCorte,
}: VistaCorteProps) {
  // Estados para formulario de nueva actividad
  const [nombreActividad, setNombreActividad] = useState("");
  const [porcentajeActividad, setPorcentajeActividad] = useState<string>("");
  const [errorActividad, setErrorActividad] = useState<string | null>(null);
  const [isSubmittingActividad, setIsSubmittingActividad] = useState(false);
  const [isSubmittingBono, setIsSubmittingBono] = useState(false);

  // Estados para Edición de Actividad existente (Mejora 1)
  const [editingActividadId, setEditingActividadId] = useState<number | null>(null);
  const [editActividadNombre, setEditActividadNombre] = useState("");
  const [editActividadPorcentaje, setEditActividadPorcentaje] = useState("");
  const [editActividadError, setEditActividadError] = useState<string | null>(null);

  // Estados locales temporales para celdas de notas mientras el usuario tipea
  const [editingNotas, setEditingNotas] = useState<Record<string, string>>({});

  // Estados para importación y exportación de plantillas Excel (.xlsx)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [modalImportacionAbierto, setModalImportacionAbierto] = useState(false);
  const [resultadoModal, setResultadoModal] = useState<ResultadoImportacionExcel | null>(null);

  // Estados para Menú Desplegable de Informes Institucionales
  const [dropdownInformesAbierto, setDropdownInformesAbierto] = useState(false);
  const [isGenerandoMortalidad, setIsGenerandoMortalidad] = useState(false);
  const [isGenerandoMejoramiento, setIsGenerandoMejoramiento] = useState(false);
  const dropdownInformesRef = useRef<HTMLDivElement | null>(null);

  // Cerrar menú desplegable al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownInformesRef.current &&
        !dropdownInformesRef.current.contains(event.target as Node)
      ) {
        setDropdownInformesAbierto(false);
      }
    }
    if (dropdownInformesAbierto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownInformesAbierto]);

  // Estados y consultas para Resultados de Aprendizaje (RAP)
  const [modalRAsAbierto, setModalRAsAbierto] = useState(false);

  const corteActual = useLiveQuery(
    () => db.cortes.get(corteId),
    [corteId]
  );

  const rasAsignatura = useLiveQuery(
    () => db.resultados_aprendizaje.where("asignaturaId").equals(asignaturaId).toArray(),
    [asignaturaId]
  );

  const rasEvaluadosEnEsteCorte = useMemo(() => {
    if (!rasAsignatura || !corteActual?.rasEvaluados) return [];
    return rasAsignatura.filter((ra) => corteActual.rasEvaluados?.includes(ra.id!));
  }, [rasAsignatura, corteActual?.rasEvaluados]);

  const handleToggleRA = async (raId: number) => {
    const actuales = corteActual?.rasEvaluados || [];
    const nuevos = actuales.includes(raId)
      ? actuales.filter((id) => id !== raId)
      : [...actuales, raId];

    await db.cortes.update(corteId, { rasEvaluados: nuevos });
  };

  // 1. Actividades asociadas a este corte
  const actividades = useLiveQuery(
    () => db.actividades.where("corteId").equals(corteId).toArray(),
    [corteId]
  );

  // 2. Estudiantes de la asignatura
  const estudiantes = useLiveQuery(
    () => db.estudiantes.where("asignaturaId").equals(asignaturaId).toArray(),
    [asignaturaId]
  );

  // 3. Notas asociadas a las actividades de este corte
  const notas = useLiveQuery(async () => {
    if (!actividades || actividades.length === 0) return [];
    const actividadIds = actividades.map((a) => a.id!).filter(Boolean);
    return db.notas.where("actividadId").anyOf(actividadIds).toArray();
  }, [actividades]);

  // Mapa rápido de notas: key = `${estudianteId}_${actividadId}` -> valor
  const notasMap = useMemo(() => {
    const map = new Map<string, number>();
    if (notas) {
      for (const n of notas) {
        map.set(`${n.estudianteId}_${n.actividadId}`, n.valor);
      }
    }
    return map;
  }, [notas]);

  // Suma total de porcentajes configurados en el corte (excluyendo bonificaciones)
  const totalPorcentajeAsignado = useMemo(() => {
    if (!actividades) return 0;
    return actividades
      .filter((act) => !act.esBonificacion)
      .reduce((acc, act) => acc + act.porcentaje, 0);
  }, [actividades]);

  const porcentajeDisponible = Math.max(0, pesoCorte - totalPorcentajeAsignado);
  const porcentajeCompleto = totalPorcentajeAsignado === pesoCorte;

  // Manejar creación de actividad regular
  const handleCrearActividad = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorActividad(null);

    const trimmedNombre = nombreActividad.trim();
    const parsedPorcentaje = parseFloat(porcentajeActividad);

    if (!trimmedNombre) {
      setErrorActividad("Ingresa un nombre para la actividad (ej. Quiz 1, Parcial).");
      return;
    }

    if (isNaN(parsedPorcentaje) || parsedPorcentaje <= 0) {
      setErrorActividad("El porcentaje debe ser un valor numérico mayor a 0.");
      return;
    }

    // Regla de negocio estricta: No superar el peso del corte
    if (totalPorcentajeAsignado + parsedPorcentaje > pesoCorte) {
      setErrorActividad(
        `El porcentaje (${parsedPorcentaje}%) excede el límite del Corte ${numeroCorte} (${pesoCorte}%). Disponible: ${porcentajeDisponible}%.`
      );
      return;
    }

    try {
      setIsSubmittingActividad(true);
      await db.actividades.add({
        corteId,
        nombre: trimmedNombre,
        porcentaje: parsedPorcentaje,
      });

      setNombreActividad("");
      setPorcentajeActividad("");
    } catch (err) {
      console.error("Error al crear actividad:", err);
      setErrorActividad("No se pudo registrar la actividad en la base de datos.");
    } finally {
      setIsSubmittingActividad(false);
    }
  };

  // Manejar creación de actividad de bonificación directa
  const handleCrearBonificacion = async () => {
    try {
      setIsSubmittingBono(true);
      await db.actividades.add({
        corteId,
        nombre: "Bonificación Extra",
        porcentaje: 0,
        esBonificacion: true,
      });
    } catch (err) {
      console.error("Error al crear bonificación:", err);
      alert("No se pudo registrar la columna de bonificación.");
    } finally {
      setIsSubmittingBono(false);
    }
  };

  // Iniciar edición de actividad existente (Mejora 1)
  const handleIniciarEdicionActividad = (act: Actividad) => {
    if (!act.id) return;
    setEditingActividadId(act.id);
    setEditActividadNombre(act.nombre);
    setEditActividadPorcentaje(String(act.porcentaje));
    setEditActividadError(null);
  };

  const handleCancelarEdicionActividad = () => {
    setEditingActividadId(null);
    setEditActividadNombre("");
    setEditActividadPorcentaje("");
    setEditActividadError(null);
  };

  // Guardar edición de actividad existente (Mejora 1)
  const handleGuardarEdicionActividad = async (actividadId: number) => {
    setEditActividadError(null);
    const trimmedNombre = editActividadNombre.trim();

    if (!trimmedNombre) {
      setEditActividadError("El nombre no puede estar vacío.");
      return;
    }

    const actividadActual = actividades?.find((a) => a.id === actividadId);

    // Si es bonificación, sólo se actualiza el nombre
    if (actividadActual?.esBonificacion) {
      try {
        await db.actividades.update(actividadId, {
          nombre: trimmedNombre,
        });
        handleCancelarEdicionActividad();
      } catch (err) {
        console.error("Error al actualizar bonificación:", err);
        setEditActividadError("Error al guardar.");
      }
      return;
    }

    const parsedPorcentaje = parseFloat(editActividadPorcentaje);
    if (isNaN(parsedPorcentaje) || parsedPorcentaje <= 0) {
      setEditActividadError("Porcentaje inválido.");
      return;
    }

    // Validar que la suma de las OTRAS actividades regulares + el nuevo porcentaje no supere pesoCorte
    const sumaOtras =
      actividades
        ?.filter((a) => a.id !== actividadId && !a.esBonificacion)
        .reduce((acc, a) => acc + a.porcentaje, 0) ?? 0;

    if (sumaOtras + parsedPorcentaje > pesoCorte) {
      const disponibleOtras = Math.max(0, pesoCorte - sumaOtras);
      setEditActividadError(`Máximo permitido: ${disponibleOtras}%.`);
      return;
    }

    try {
      await db.actividades.update(actividadId, {
        nombre: trimmedNombre,
        porcentaje: parsedPorcentaje,
      });
      handleCancelarEdicionActividad();
    } catch (err) {
      console.error("Error al actualizar actividad:", err);
      setEditActividadError("Error al guardar.");
    }
  };

  // Eliminar actividad y sus notas
  const handleEliminarActividad = async (actividad: Actividad) => {
    if (!actividad.id) return;
    const tipo = actividad.esBonificacion ? "la bonificación" : "la actividad";
    const infoPeso = actividad.esBonificacion ? "(Bono Directo)" : `(${actividad.porcentaje}%)`;
    const confirmacion = window.confirm(
      `¿Deseas eliminar ${tipo} "${actividad.nombre}" ${infoPeso}? También se borrarán las calificaciones ingresadas para esta columna.`
    );
    if (!confirmacion) return;

    try {
      if (editingActividadId === actividad.id) {
        handleCancelarEdicionActividad();
      }

      await db.transaction("rw", db.actividades, db.notas, async () => {
        await db.notas.where("actividadId").equals(actividad.id!).delete();
        await db.actividades.delete(actividad.id!);
      });
    } catch (err) {
      console.error("Error al eliminar actividad:", err);
      alert("No se pudo eliminar la actividad.");
    }
  };

  // Auto-guardado en tiempo real de la nota de un estudiante (Mejora 3)
  const handleGuardarNota = async (
    estudianteId: number,
    actividadId: number,
    nuevoValorStr: string
  ) => {
    const trimmed = nuevoValorStr.trim();

    if (trimmed === "") {
      try {
        const notaExistente = await db.notas
          .where("estudianteId")
          .equals(estudianteId)
          .and((n) => n.actividadId === actividadId)
          .first();

        if (notaExistente?.id) {
          await db.notas.delete(notaExistente.id);
        }
      } catch (err) {
        console.error("Error al limpiar nota:", err);
      }
      return;
    }

    const valorNum = parseFloat(trimmed);
    if (isNaN(valorNum) || valorNum < 0 || valorNum > 5) {
      return;
    }

    try {
      const notaExistente = await db.notas
        .where("estudianteId")
        .equals(estudianteId)
        .and((n) => n.actividadId === actividadId)
        .first();

      if (notaExistente?.id) {
        await db.notas.update(notaExistente.id, { valor: valorNum });
      } else {
        await db.notas.add({
          estudianteId,
          actividadId,
          valor: valorNum,
        });
      }
    } catch (err) {
      console.error("Error al auto-guardar nota:", err);
    }
  };

  // Manejador de cambio estricto de notas: Coma por punto y solo números válidos (Mejora 3)
  const handleNotaInputChange = (
    cellKey: string,
    rawInput: string,
    estudianteId: number,
    actividadId: number
  ) => {
    // Interceptar coma por punto
    let sanitized = rawInput.replace(/,/g, ".");

    // Permitir solo números y como máximo un punto decimal
    if (sanitized !== "" && !/^\d*\.?\d*$/.test(sanitized)) {
      return; // Carácter no permitido, ignorar
    }

    // Si tiene un número completo y supera 5.0, topar a 5.0
    if (sanitized !== "" && sanitized !== "." && !sanitized.endsWith(".")) {
      const numVal = parseFloat(sanitized);
      if (!isNaN(numVal) && numVal > 5) {
        sanitized = "5.0";
      }
    }

    // Actualizar buffer local de edición inmediato
    setEditingNotas((prev) => ({
      ...prev,
      [cellKey]: sanitized,
    }));

    // Si no termina en punto (o está vacío), guardar en BD
    if (sanitized === "" || (!sanitized.endsWith(".") && sanitized !== ".")) {
      handleGuardarNota(estudianteId, actividadId, sanitized);
    }
  };

  // Navegación vertical con tecla ENTER (Mejora 2)
  const handleNotaKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIndex: number,
    actividadId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextIndex = studentIndex + 1;
      const nextInputId = `nota-cell-${nextIndex}-${actividadId}`;
      const nextInput = document.getElementById(nextInputId) as HTMLInputElement | null;

      if (nextInput) {
        nextInput.focus();
        nextInput.select?.();
      }
    }
  };

  // Cálculo matemático de la definitiva del corte mediante módulo centralizado lib/calculos.ts
  const getDetalleDefinitivaEstudiante = (
    estudianteId: number
  ): DetalleDefinitivaCorte | null => {
    return calcularDetalleDefinitivaCorte(
      estudianteId,
      actividades,
      notasMap,
      pesoCorte
    );
  };

  const getDefinitivaEstudiante = (estudianteId: number): number | null => {
    return calcularDefinitivaCorte(estudianteId, actividades, notasMap, pesoCorte);
  };

  // Descargar plantilla Excel (.xlsx) con actividades del corte actual y estudiantes
  const handleDescargarPlantillaExcel = async () => {
    if (!actividades || actividades.length === 0) {
      alert("Debes crear al menos una actividad en este corte para generar la plantilla.");
      return;
    }

    try {
      const { buffer, filename } = await generarPlantillaExcelCorte(
        estudiantes || [],
        actividades,
        notasMap,
        numeroCorte
      );

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al exportar plantilla Excel:", err);
      alert("Ocurrió un error al generar la plantilla de Excel.");
    }
  };

  // Leer e importar notas desde un archivo Excel (.xlsx) seleccionado
  const handleSeleccionarExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImportingExcel(true);
      const reader = new FileReader();

      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        const res = await procesarExcelNotas(buffer, corteId, asignaturaId);
        setResultadoModal(res);
        setModalImportacionAbierto(true);
        setIsImportingExcel(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      reader.onerror = () => {
        alert("No se pudo leer el archivo Excel seleccionado.");
        setIsImportingExcel(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error al procesar archivo Excel:", err);
      alert("Ocurrió un error inesperado al procesar el archivo Excel.");
      setIsImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Descarga del Informe Oficial en Excel: Mortalidad Académica Parcial
  const handleDescargarMortalidad = async () => {
    try {
      setIsGenerandoMortalidad(true);
      setDropdownInformesAbierto(false);
      const datos = await prepararDatosInformeCorte(corteId);
      if (!datos) {
        alert("No se pudieron cargar los datos del corte para generar el informe.");
        return;
      }
      await generarExcelMortalidad(datos);
    } catch (error) {
      console.error("Error al generar el informe de mortalidad:", error);
      alert("Ocurrió un error al generar el informe de mortalidad académica.");
    } finally {
      setIsGenerandoMortalidad(false);
    }
  };

  // Descarga del Informe Oficial en Excel: Plan de Mejoramiento del Desempeño Académico
  const handleDescargarPlanMejoramiento = async () => {
    if (numeroCorte === 3) {
      alert("El plan de mejoramiento solo aplica para los cortes 1 y 2.");
      return;
    }

    try {
      setIsGenerandoMejoramiento(true);
      setDropdownInformesAbierto(false);

      // Obtener la asignatura para conocer su periodoId
      const asig = await db.asignaturas.get(asignaturaId);
      if (!asig) {
        alert("No se pudo identificar la asignatura actual.");
        return;
      }

      const datos = await prepararDatosPlanMejoramiento(asig.periodoId, numeroCorte);
      if (!datos) {
        alert("No se pudieron recopilar los datos del Plan de Mejoramiento para este periodo.");
        return;
      }

      await generarExcelMejoramiento(datos);
    } catch (error) {
      console.error("Error al generar el Plan de Mejoramiento:", error);
      alert("Ocurrió un error inesperado al generar el Plan de Mejoramiento.");
    } finally {
      setIsGenerandoMejoramiento(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header del Corte e Indicador Visual de Porcentajes */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>Configuración de Calificaciones</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Corte {numeroCorte} ({pesoCorte}% del Semestre)
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Define las actividades evaluativas y sus ponderaciones para este periodo parcial.
            </p>
          </div>

          {/* Indicador de Porcentaje Asignado */}
          <div className="bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 p-4 rounded-xl min-w-[260px]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Porcentaje asignado:
              </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {totalPorcentajeAsignado}% / {pesoCorte}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  porcentajeCompleto
                    ? "bg-emerald-500"
                    : "bg-zinc-900 dark:bg-zinc-100"
                }`}
                style={{
                  width: `${Math.min(100, (totalPorcentajeAsignado / pesoCorte) * 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] mt-2 text-zinc-500 dark:text-zinc-400">
              {porcentajeCompleto ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  100% de la capacidad completada
                </span>
              ) : (
                <span>Disponible para asignar: {porcentajeDisponible}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Sección Compacta: Resultados de Aprendizaje Evaluados en este Corte */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shrink-0">
              <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Resultados de Aprendizaje (RAP):</span>
            </div>

            {rasEvaluadosEnEsteCorte.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {rasEvaluadosEnEsteCorte.map((ra) => (
                  <span
                    key={ra.id}
                    title={ra.descripcion}
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 cursor-help transition-transform hover:scale-105"
                  >
                    {ra.codigo}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                Sin RAs vinculados a este corte
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setModalRAsAbierto(true)}
            className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto shadow-2xs"
          >
            <Target className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Vincular RAs</span>
          </button>
        </div>

        {/* Formulario para Crear Nueva Actividad */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <form onSubmit={handleCrearActividad} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label
                  htmlFor={`actividad-nombre-${corteId}`}
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Nombre de la Actividad
                </label>
                <input
                  id={`actividad-nombre-${corteId}`}
                  type="text"
                  placeholder="Ej. Quiz 1, Taller de Algoritmos, Parcial 20%"
                  value={nombreActividad}
                  onChange={(e) => setNombreActividad(e.target.value)}
                  disabled={porcentajeCompleto}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="w-full sm:w-36">
                <label
                  htmlFor={`actividad-peso-${corteId}`}
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Porcentaje (%)
                </label>
                <input
                  id={`actividad-peso-${corteId}`}
                  type="text"
                  inputMode="decimal"
                  placeholder={`Máx ${porcentajeDisponible}%`}
                  value={porcentajeActividad}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/,/g, ".");
                    if (clean === "" || /^\d*\.?\d*$/.test(clean)) {
                      setPorcentajeActividad(clean);
                    }
                  }}
                  disabled={porcentajeCompleto}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 disabled:opacity-50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmittingActividad || porcentajeCompleto}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm shadow-zinc-900/10 dark:shadow-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Actividad</span>
                </button>

                <button
                  type="button"
                  onClick={handleCrearBonificacion}
                  disabled={isSubmittingBono}
                  className="px-3.5 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 dark:text-amber-300 disabled:opacity-50 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                  title="Añadir columna para sumar décimas directas a la definitiva"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Añadir Columna de Bonificación</span>
                </button>
              </div>
            </div>

            {errorActividad && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50 px-3 py-1.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorActividad}</span>
              </div>
            )}
          </form>

          {/* Lista de Actividades Registradas (Chips con Edición - Mejora 1) */}
          {actividades && actividades.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                <span>Actividades ({actividades.length}):</span>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">
                  (Haz clic en el lápiz para editar nombre y peso)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {actividades.map((act) => {
                  const isEditingThisAct = editingActividadId === act.id;
                  const isBono = !!act.esBonificacion;

                  if (isEditingThisAct) {
                    return (
                      <div
                        key={act.id}
                        className={`inline-flex items-center gap-1.5 p-1.5 rounded-lg border shadow-sm ${
                          isBono
                            ? "bg-amber-50/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700"
                            : "bg-zinc-100 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700"
                        }`}
                      >
                        <input
                          type="text"
                          value={editActividadNombre}
                          onChange={(e) => setEditActividadNombre(e.target.value)}
                          placeholder="Nombre..."
                          className="px-2 py-0.5 text-xs rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 w-32 focus:outline-none"
                          autoFocus
                        />
                        {!isBono ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editActividadPorcentaje}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/,/g, ".");
                              if (clean === "" || /^\d*\.?\d*$/.test(clean)) {
                                setEditActividadPorcentaje(clean);
                              }
                            }}
                            placeholder="%"
                            className="px-1.5 py-0.5 text-xs font-mono rounded bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 w-14 text-center focus:outline-none"
                          />
                        ) : (
                          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                            + Bono
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleGuardarEdicionActividad(act.id!)}
                          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Guardar cambios"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelarEdicionActividad}
                          className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                          title="Cancelar edición"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  if (isBono) {
                    return (
                      <div
                        key={act.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-300 text-xs shadow-2xs group hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span
                          onClick={() => handleIniciarEdicionActividad(act)}
                          className="font-medium cursor-pointer hover:underline"
                          title="Haz clic para editar nombre"
                        >
                          {act.nombre}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-semibold uppercase tracking-wider">
                          Bono Directo
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicionActividad(act)}
                          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 p-0.5 rounded transition-colors ml-0.5"
                          title="Editar nombre"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarActividad(act)}
                          className="text-amber-600 hover:text-rose-500 dark:text-amber-400 dark:hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="Eliminar bonificación y sus registros"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={act.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800 dark:bg-zinc-800/80 dark:border-zinc-700/60 dark:text-zinc-200 text-xs shadow-2xs group hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
                    >
                      <span
                        onClick={() => handleIniciarEdicionActividad(act)}
                        className="font-medium cursor-pointer hover:underline"
                        title="Haz clic para editar"
                      >
                        {act.nombre}
                      </span>
                      <span className="font-mono text-[11px] px-1 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 font-semibold">
                        {act.porcentaje}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleIniciarEdicionActividad(act)}
                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded transition-colors ml-0.5"
                        title="Editar nombre y porcentaje"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarActividad(act)}
                        className="text-zinc-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                        title="Eliminar actividad y sus notas"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {editActividadError && (
                <div className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{editActividadError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Cuadrícula de Notas con Columnas Sticky (Mejoras 2, 3 y 4) */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <FileSpreadsheet className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
              Cuadrícula de Calificaciones — Corte {numeroCorte}
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50 px-2 py-0.5 rounded">
              {estudiantes ? estudiantes.length : 0} estudiante(s)
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Input oculto para carga de archivo Excel (.xlsx) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleSeleccionarExcel}
              className="hidden"
            />

            {/* Botón Descargar Plantilla Excel */}
            <button
              type="button"
              onClick={handleDescargarPlantillaExcel}
              disabled={!actividades || actividades.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:border-zinc-700/60 dark:text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
              title="Descargar plantilla Excel (.xlsx) con encabezados de actividades de este corte"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Descargar Plantilla Excel</span>
            </button>

            {/* Botón Importar Notas Excel */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImportingExcel || !actividades || actividades.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:border-zinc-700/60 dark:text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
              title="Importar calificaciones masivamente desde un archivo Excel (.xlsx)"
            >
              <FileUp className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>{isImportingExcel ? "Importando..." : "Importar Notas Excel"}</span>
            </button>

            {/* Menú Desplegable: Generar Informes Institucionales */}
            <div className="relative" ref={dropdownInformesRef}>
              <button
                type="button"
                onClick={() => setDropdownInformesAbierto((prev) => !prev)}
                disabled={isGenerandoMortalidad || !estudiantes || estudiantes.length === 0}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-40"
                title="Generar informes institucionales oficiales en Excel"
              >
                {isGenerandoMortalidad ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>
                  {isGenerandoMortalidad
                    ? "Generando..."
                    : "Generar Informes Institucionales"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${dropdownInformesAbierto ? "rotate-180" : ""}`} />
              </button>

              {dropdownInformesAbierto && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1">
                  <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Informes Oficiales de Corte
                  </div>

                  <button
                    type="button"
                    onClick={handleDescargarMortalidad}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-2.5"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                        Mortalidad Académica Parcial
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Formato oficial con cálculo de reprobados, aprobados y promedio.
                      </p>
                    </div>
                  </button>

                  {numeroCorte === 3 ? (
                    <div
                      title="El plan de mejoramiento solo aplica para los cortes 1 y 2"
                      className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-400 dark:text-zinc-500 opacity-60 cursor-not-allowed flex items-start gap-2.5 bg-zinc-50/50 dark:bg-zinc-900/50 select-none"
                    >
                      <FileCheck2 className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-zinc-500 dark:text-zinc-400 leading-tight">
                            Plan de Mejoramiento
                          </p>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                            Cortes 1 y 2
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          El plan de mejoramiento solo aplica para los cortes 1 y 2
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDescargarPlanMejoramiento}
                      disabled={isGenerandoMejoramiento}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-start gap-2.5 group disabled:opacity-50"
                    >
                      {isGenerandoMejoramiento ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin mt-0.5 shrink-0" />
                      ) : (
                        <FileCheck2 className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                            Plan de Mejoramiento
                          </p>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                            Global
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Consolidado de todas las asignaturas de este corte y periodo.
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="hidden xl:flex items-center gap-1 text-[11px] text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-3 font-mono">
              <Calculator className="w-3 h-3" />
              <span>Auto-guardado activo</span>
            </div>
          </div>
        </div>

        {/* Contenido de la Tabla con Columnas Sticky */}
        {!estudiantes || estudiantes.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
              No hay estudiantes matriculados
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Pasa a la pestaña &quot;Estudiantes&quot; para importar la lista mediante el módulo Elysa.
            </p>
          </div>
        ) : !actividades || actividades.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
              No hay actividades registradas en este corte
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Agrega una o más actividades arriba (ej. Quiz 1 10%, Parcial 25%) para habilitar la cuadrícula de calificaciones.
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

                  {/* Columnas dinámicas de actividades (con scroll libre) */}
                  {actividades.map((act) => {
                    const isBono = !!act.esBonificacion;
                    return (
                      <th
                        key={act.id}
                        className={`px-3 py-2.5 min-w-[130px] text-center border-r border-zinc-200 dark:border-zinc-800/60 ${
                          isBono
                            ? "bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                            : "bg-zinc-50/70 dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isBono && (
                            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          )}
                          <span className="truncate font-semibold">{act.nombre}</span>
                        </div>
                        <div
                          className={`font-mono text-[10px] ${
                            isBono
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-zinc-500 dark:text-zinc-400 lowercase"
                          }`}
                        >
                          {isBono ? "+ décimas directas" : `peso: ${act.porcentaje}%`}
                        </div>
                      </th>
                    );
                  })}

                  {/* Sticky 4: Definitiva Corte (Sticky a la derecha) */}
                  <th className="sticky right-0 z-20 w-36 min-w-[130px] px-4 py-3 text-center bg-zinc-100 dark:bg-zinc-950 font-bold text-zinc-900 dark:text-zinc-50 border-l border-zinc-200 dark:border-zinc-800 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <div>Definitiva Corte</div>
                    <div className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 lowercase">
                      (sobre 5.0)
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {estudiantes.map((estudiante, studentIndex) => {
                  const detalleDef = getDetalleDefinitivaEstudiante(estudiante.id!);
                  const definitiva = detalleDef?.definitiva ?? null;

                  return (
                    <tr
                      key={estudiante.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20 transition-colors group"
                    >
                      {/* Sticky 1: # */}
                      <td className="sticky left-0 z-10 w-12 min-w-[48px] max-w-[48px] px-3 py-2.5 text-center font-mono text-zinc-400 dark:text-zinc-500 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800">
                        {studentIndex + 1}
                      </td>

                      {/* Sticky 2: Identificación */}
                      <td className="sticky left-[48px] z-10 w-36 min-w-[130px] max-w-[130px] px-4 py-2.5 font-mono text-zinc-700 dark:text-zinc-300 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800">
                        {estudiante.identificacion}
                      </td>

                      {/* Sticky 3: Nombre Completo */}
                      <td className="sticky left-[178px] z-10 min-w-[200px] px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 bg-white group-hover:bg-zinc-50/60 dark:bg-zinc-900 dark:group-hover:bg-zinc-800/40 border-r border-zinc-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        <span className="truncate block max-w-[220px]">
                          {estudiante.nombreCompleto}
                        </span>
                      </td>

                      {/* Celdas de Calificación por Actividad (Mejoras 2 y 3) */}
                      {actividades.map((act) => {
                        const cellKey = `${estudiante.id}_${act.id}`;
                        const valorBD = notasMap.get(cellKey);
                        const displayValue =
                          cellKey in editingNotas
                            ? editingNotas[cellKey]
                            : valorBD !== undefined
                            ? Number(valorBD).toFixed(1)
                            : "";
                        const isBono = !!act.esBonificacion;

                        return (
                          <td
                            key={act.id}
                            className={`p-1 border-r border-zinc-200 dark:border-zinc-800/60 text-center ${
                              isBono ? "bg-amber-50/30 dark:bg-amber-950/15" : ""
                            }`}
                          >
                            <input
                              id={`nota-cell-${studentIndex}-${act.id}`}
                              type="text"
                              inputMode="decimal"
                              placeholder={isBono ? "+0.0" : "0.0"}
                              value={displayValue}
                              onChange={(e) =>
                                handleNotaInputChange(
                                  cellKey,
                                  e.target.value,
                                  estudiante.id!,
                                  act.id!
                                )
                              }
                              onKeyDown={(e) =>
                                handleNotaKeyDown(e, studentIndex, act.id!)
                              }
                              onBlur={() => {
                                // Normalizar en blur si termina en "."
                                if (displayValue.endsWith(".")) {
                                  const normalized = displayValue.slice(0, -1);
                                  handleNotaInputChange(
                                    cellKey,
                                    normalized,
                                    estudiante.id!,
                                    act.id!
                                  );
                                }
                                // Limpiar buffer de edición temporal
                                setEditingNotas((prev) => {
                                  const next = { ...prev };
                                  delete next[cellKey];
                                  return next;
                                });
                              }}
                              className={`w-full text-center px-2 py-1.5 font-mono text-xs rounded border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:outline-none transition-colors ${
                                isBono
                                  ? "text-amber-900 dark:text-amber-200 font-semibold focus:border-amber-400 dark:focus:border-amber-500 bg-amber-50/20 focus:bg-amber-50/60 dark:focus:bg-amber-950/40"
                                  : "text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 dark:focus:border-zinc-400 bg-transparent focus:bg-white dark:focus:bg-zinc-950"
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Sticky 4: Definitiva del Corte (Sticky a la derecha) */}
                      <td className="sticky right-0 z-10 w-36 min-w-[130px] px-4 py-2.5 text-center font-mono font-bold bg-zinc-50 group-hover:bg-zinc-100 dark:bg-zinc-950 dark:group-hover:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        {detalleDef !== null ? (
                          <span
                            title={
                              detalleDef.esArrastre
                                ? `Aprobado por aproximación decimal (${detalleDef.definitivaExacta.toFixed(2)} → ${detalleDef.definitiva.toFixed(1)})`
                                : detalleDef.aprobado
                                ? "Aprobado sólido (≥ 3.0)"
                                : "Reprobado (< 3.0)"
                            }
                            className={`inline-block px-2.5 py-0.5 rounded font-bold ${obtenerClasesSemaforoNota(
                              detalleDef.definitiva,
                              detalleDef.definitivaExacta,
                              "badge"
                            )}`}
                          >
                            {detalleDef.definitiva.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
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

      {/* 3. Modal de Resumen de Importación CSV (Paso 4) */}
      {modalImportacionAbierto && resultadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
                    Resultado de la Importación
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Procesamiento de calificaciones Excel (.xlsx)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalImportacionAbierto(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Métricas de Importación */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Notas Guardadas
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                  {resultadoModal.notasProcesadas}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Estudiantes Afectados
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
                  {resultadoModal.estudiantesActualizados}
                </div>
              </div>
            </div>

            {/* Advertencias y filas omitidas */}
            {resultadoModal.advertencias.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    Observaciones y avisos ({resultadoModal.advertencias.length})
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-amber-50/60 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 font-mono space-y-1">
                  {resultadoModal.advertencias.map((adv, idx) => (
                    <div key={idx} className="leading-relaxed">
                      • {adv}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de Confirmación */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setModalImportacionAbierto(false)}
                className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium text-sm rounded-xl transition-colors shadow-sm"
              >
                Aceptar y Ver Calificaciones
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal para Vincular Resultados de Aprendizaje (Paso 4) */}
      {modalRAsAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 text-base">
                    Vincular RAs — Corte {numeroCorte}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Selecciona los Resultados de Aprendizaje evaluados en este corte
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRAsAbierto(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de Checkboxes */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {rasAsignatura && rasAsignatura.length > 0 ? (
                rasAsignatura.map((ra) => {
                  const estaSeleccionado = corteActual?.rasEvaluados?.includes(ra.id!) ?? false;
                  return (
                    <label
                      key={ra.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        estaSeleccionado
                          ? "bg-blue-50/60 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/60"
                          : "bg-zinc-50/60 border-zinc-200/80 hover:bg-zinc-100/60 dark:bg-zinc-950/40 dark:border-zinc-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={estaSeleccionado}
                        onChange={() => handleToggleRA(ra.id!)}
                        className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 mr-2">
                          {ra.codigo}
                        </span>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mt-0.5">
                          {ra.descripcion}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-zinc-500 space-y-1">
                  <p className="font-medium text-zinc-700 dark:text-zinc-300">
                    Esta asignatura no tiene Resultados de Aprendizaje registrados.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Agrégalos en la pestaña &quot;Resultados (RAP)&quot; de la asignatura.
                  </p>
                </div>
              )}
            </div>

            {/* Pie del Modal */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-mono">
                {corteActual?.rasEvaluados?.length ?? 0} RA(s) asignado(s)
              </span>
              <button
                type="button"
                onClick={() => setModalRAsAbierto(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium text-xs rounded-xl transition-colors shadow-2xs"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

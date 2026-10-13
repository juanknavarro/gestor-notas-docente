"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Asignatura } from "@/lib/db";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  AlertCircle,
  FolderOpen,
  GraduationCap,
  CalendarDays,
  X,
  Check,
} from "lucide-react";

export default function AsignaturasPage() {
  const [periodoId, setPeriodoId] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [numeroClase, setNumeroClase] = useState("");
  const [numeroCatalogo, setNumeroCatalogo] = useState("");
  const [programa, setPrograma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para el Modal Flotante de Edición
  const [asignaturaAEditar, setAsignaturaAEditar] = useState<Asignatura | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editPrograma, setEditPrograma] = useState("");
  const [editNumeroClase, setEditNumeroClase] = useState("");
  const [editNumeroCatalogo, setEditNumeroCatalogo] = useState("");
  const [editPeriodoId, setEditPeriodoId] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Obtener periodos, asignaturas y programas de forma reactiva
  const periodos = useLiveQuery(() => db.periodos.orderBy("nombre").toArray(), []);
  const asignaturas = useLiveQuery(() => db.asignaturas.toArray(), []);
  const programas = useLiveQuery(() => db.programas.orderBy("nombre").toArray(), []);

  // Mapeo rápido de periodoId -> nombre de periodo
  const periodosMap = new Map<number, string>(
    periodos?.map((p) => [p.id!, p.nombre]) || []
  );

  const handleAbrirModalEdicion = (asig: Asignatura) => {
    if (!asig.id) return;
    setAsignaturaAEditar(asig);
    setEditNombre(asig.nombre);
    setEditPrograma(asig.programa);
    setEditNumeroClase(asig.numeroClase || "");
    setEditNumeroCatalogo(asig.numeroCatalogo || "");
    setEditPeriodoId(String(asig.periodoId));
    setEditError(null);
  };

  const handleCerrarModalEdicion = () => {
    setAsignaturaAEditar(null);
    setEditNombre("");
    setEditPrograma("");
    setEditNumeroClase("");
    setEditNumeroCatalogo("");
    setEditPeriodoId("");
    setEditError(null);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignaturaAEditar?.id) return;

    const trimmedNombre = editNombre.trim();
    const trimmedPrograma = editPrograma.trim();
    const trimmedNumeroClase = editNumeroClase.trim();
    const trimmedNumeroCatalogo = editNumeroCatalogo.trim();

    if (!editPeriodoId) {
      setEditError("Por favor selecciona un periodo académico.");
      return;
    }

    if (!trimmedNombre) {
      setEditError("Por favor ingresa el nombre de la asignatura.");
      return;
    }

    if (!trimmedPrograma) {
      setEditError("Por favor ingresa el programa académico.");
      return;
    }

    try {
      setIsSavingEdit(true);
      await db.asignaturas.update(asignaturaAEditar.id, {
        periodoId: Number(editPeriodoId),
        nombre: trimmedNombre,
        programa: trimmedPrograma,
        numeroClase: trimmedNumeroClase || undefined,
        numeroCatalogo: trimmedNumeroCatalogo || undefined,
      });

      handleCerrarModalEdicion();
    } catch (err) {
      console.error("Error al actualizar asignatura:", err);
      setEditError("Ocurrió un error al actualizar la asignatura.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleGuardarAsignatura = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedNombre = nombre.trim();
    const trimmedPrograma = programa.trim();
    const trimmedNumeroClase = numeroClase.trim();
    const trimmedNumeroCatalogo = numeroCatalogo.trim();

    if (!periodoId) {
      setError("Por favor selecciona un periodo académico.");
      return;
    }

    if (!trimmedNombre) {
      setError("Por favor ingresa el nombre de la asignatura.");
      return;
    }

    if (!trimmedPrograma) {
      setError("Por favor ingresa el programa académico.");
      return;
    }

    try {
      setIsSubmitting(true);
      const pId = Number(periodoId);

      // Modo Creación: Transacción atómica creando asignatura y sus 3 cortes reglamentarios
      await db.transaction("rw", db.asignaturas, db.cortes, async () => {
        const newAsignaturaId = await db.asignaturas.add({
          periodoId: pId,
          nombre: trimmedNombre,
          programa: trimmedPrograma,
          numeroClase: trimmedNumeroClase || undefined,
          numeroCatalogo: trimmedNumeroCatalogo || undefined,
        });

        // Insertar automáticamente los 3 cortes reglamentarios (35%, 35%, 30%)
        await db.cortes.bulkAdd([
          {
            asignaturaId: Number(newAsignaturaId),
            numeroCorte: 1,
            porcentaje: 35,
          },
          {
            asignaturaId: Number(newAsignaturaId),
            numeroCorte: 2,
            porcentaje: 35,
          },
          {
            asignaturaId: Number(newAsignaturaId),
            numeroCorte: 3,
            porcentaje: 30,
          },
        ]);
      });

      setNombre("");
      setPrograma("");
      setNumeroClase("");
      setNumeroCatalogo("");
      setPeriodoId("");
    } catch (err) {
      console.error("Error al guardar asignatura:", err);
      setError("Ocurrió un error al guardar la asignatura.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminarAsignatura = async (asignatura: Asignatura) => {
    if (!asignatura.id) return;
    const confirmacion = window.confirm(
      `¿Deseas eliminar la asignatura "${asignatura.nombre}"? Esto eliminará sus cortes y estudiantes asociados.`
    );
    if (!confirmacion) return;

    try {
      if (asignaturaAEditar?.id === asignatura.id) {
        handleCerrarModalEdicion();
      }

      await db.transaction(
        "rw",
        db.asignaturas,
        db.cortes,
        db.actividades,
        db.notas,
        db.estudiantes,
        async () => {
          const asigId = asignatura.id!;
          const cortesAsociados = await db.cortes.where("asignaturaId").equals(asigId).toArray();
          const corteIds = cortesAsociados.map((c) => c.id!).filter(Boolean);

          const estudiantesAsociados = await db.estudiantes
            .where("asignaturaId")
            .equals(asigId)
            .toArray();
          const estudianteIds = estudiantesAsociados.map((e) => e.id!).filter(Boolean);

          if (estudianteIds.length > 0) {
            await db.notas.where("estudianteId").anyOf(estudianteIds).delete();
          }

          if (corteIds.length > 0) {
            await db.actividades.where("corteId").anyOf(corteIds).delete();
          }

          await db.estudiantes.where("asignaturaId").equals(asigId).delete();
          await db.cortes.where("asignaturaId").equals(asigId).delete();
          await db.asignaturas.delete(asigId);
        }
      );
    } catch (err) {
      console.error("Error al eliminar asignatura:", err);
      alert("Error al eliminar la asignatura.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mb-1">
          <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          <span>Gestión Académica</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
          Asignaturas
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
          Administra tus materias y programas. Al crear una asignatura se configuran automáticamente los 3 cortes reglamentarios (35%, 35%, 30%).
        </p>
      </div>

      {/* Alerta si no hay periodos */}
      {periodos && periodos.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              No tienes periodos académicos registrados
            </p>
            <p className="text-amber-800 dark:text-amber-300/80 mt-0.5">
              Antes de registrar una asignatura necesitas al menos un periodo activo.{" "}
              <Link
                href="/periodos"
                className="font-medium underline hover:text-amber-950 dark:hover:text-amber-100 inline-flex items-center gap-1"
              >
                Crear un periodo ahora &rarr;
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Formulario de registro (Card) */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl transition-all">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Plus className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span>Registrar Nueva Asignatura</span>
          </h2>
        </div>

        <form onSubmit={handleGuardarAsignatura} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
            {/* 1. Selector de Periodo */}
            <div>
              <label
                htmlFor="periodoSelect"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                title="Periodo Académico"
              >
                Periodo Académico <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <select
                id="periodoSelect"
                value={periodoId}
                onChange={(e) => setPeriodoId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              >
                <option value="" className="bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                  Selecciona un periodo...
                </option>
                {periodos?.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Nombre de la asignatura */}
            <div>
              <label
                htmlFor="nombreAsignatura"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                title="Nombre de la Asignatura"
              >
                Nombre de Asignatura <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <input
                id="nombreAsignatura"
                type="text"
                placeholder="Ej. Programación de Computadores"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              />
            </div>

            {/* 3. Número de Clase */}
            <div>
              <label
                htmlFor="numeroClase"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                title="Número de Clase (Opcional)"
              >
                Número de Clase <span className="text-zinc-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="numeroClase"
                type="text"
                placeholder="Ej. 3688"
                value={numeroClase}
                onChange={(e) => setNumeroClase(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              />
            </div>

            {/* 4. N° de Catálogo */}
            <div>
              <label
                htmlFor="numeroCatalogo"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                title="N° de Catálogo (Opcional)"
              >
                N° de Catálogo <span className="text-zinc-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="numeroCatalogo"
                type="text"
                placeholder="Ej. 396CBASM"
                value={numeroCatalogo}
                onChange={(e) => setNumeroCatalogo(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              />
            </div>

            {/* 5. Programa Académico */}
            <div>
              <div className="flex items-center justify-between h-5 mb-1.5">
                <label
                  htmlFor="programa"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate"
                  title="Programa Académico"
                >
                  Programa Académico <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                {programas && programas.length === 0 && (
                  <Link
                    href="/configuracion"
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 shrink-0 ml-1"
                  >
                    Crear &rarr;
                  </Link>
                )}
              </div>
              <select
                id="programa"
                value={programa}
                onChange={(e) => setPrograma(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
              >
                <option value="">Selecciona un programa académico...</option>
                {programas?.map((p) => (
                  <option key={p.id} value={p.nombre}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {programas && programas.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  No hay programas registrados aún.{" "}
                  <Link href="/configuracion" className="underline font-medium">
                    Configúralos aquí
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:emerald-400"></span>
              Crea automáticamente: Corte 1 (35%), Corte 2 (35%), Corte 3 (30%)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !periodos || periodos.length === 0}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm shadow-zinc-900/10 dark:shadow-none"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? "Creando..." : "Crear Asignatura"}</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50 px-3.5 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>

      {/* Lista de asignaturas (Card) */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            Asignaturas Registradas
          </h2>
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/50 px-2 py-0.5 rounded">
            Total: {asignaturas ? asignaturas.length : 0}
          </span>
        </div>

        {asignaturas === undefined ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Cargando asignaturas desde IndexedDB...
          </div>
        ) : asignaturas.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 dark:bg-zinc-800/80 dark:border-zinc-700/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-300">No hay asignaturas registradas</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Registra tu primera asignatura arriba para comenzar a gestionar estudiantes y calificaciones.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/80 text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400 text-xs uppercase font-medium border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 w-20">ID</th>
                  <th className="px-6 py-3">Asignatura</th>
                  <th className="px-6 py-3">Programa</th>
                  <th className="px-6 py-3">Periodo</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {asignaturas.map((asig) => (
                  <tr
                    key={asig.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                      #{asig.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {asig.nombre}
                        </span>
                        {asig.numeroClase && (
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700/60">
                            Clase {asig.numeroClase}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        <GraduationCap className="w-3.5 h-3.5 text-zinc-400" />
                        <span>3 cortes (35%, 35%, 30%)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300 text-xs">
                      {asig.programa}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-800/80 dark:border-zinc-700/60 dark:text-zinc-300">
                        <CalendarDays className="w-3 h-3 text-zinc-400" />
                        {periodosMap.get(asig.periodoId) || `ID #${asig.periodoId}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/asignaturas/${asig.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 dark:text-zinc-200 dark:border-zinc-700/60 text-xs font-medium rounded-lg transition-colors"
                        >
                          <span>Estudiantes</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                        </Link>
                        <button
                          onClick={() => handleAbrirModalEdicion(asig)}
                          className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/50 p-1.5 rounded-lg transition-colors"
                          title="Editar asignatura"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminarAsignatura(asig)}
                          className="text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                          title="Eliminar asignatura"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Flotante de Edición de Asignatura */}
      {asignaturaAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl max-w-lg w-full overflow-hidden transition-all">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700/60 rounded-lg text-zinc-900 dark:text-zinc-100">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                    Editar Asignatura
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                    ID #{asignaturaAEditar.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCerrarModalEdicion}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                {/* 1. Periodo Académico */}
                <div>
                  <label
                    htmlFor="editPeriodoSelect"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                    title="Periodo Académico"
                  >
                    Periodo Académico <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <select
                    id="editPeriodoSelect"
                    value={editPeriodoId}
                    onChange={(e) => setEditPeriodoId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  >
                    <option value="">Selecciona un periodo...</option>
                    {periodos?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Nombre de la Asignatura */}
                <div>
                  <label
                    htmlFor="editNombreAsignatura"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                    title="Nombre de la Asignatura"
                  >
                    Nombre de la Asignatura <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="editNombreAsignatura"
                    type="text"
                    placeholder="Ej. Programación de Computadores"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  />
                </div>

                {/* 3. Número de Clase */}
                <div>
                  <label
                    htmlFor="editNumeroClase"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                    title="Número de Clase (Opcional)"
                  >
                    Número de Clase <span className="text-zinc-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="editNumeroClase"
                    type="text"
                    placeholder="Ej. 3688"
                    value={editNumeroClase}
                    onChange={(e) => setEditNumeroClase(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  />
                </div>

                {/* 4. N° de Catálogo */}
                <div>
                  <label
                    htmlFor="editNumeroCatalogo"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 h-5 mb-1.5 truncate"
                    title="N° de Catálogo (Opcional)"
                  >
                    N° de Catálogo <span className="text-zinc-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    id="editNumeroCatalogo"
                    type="text"
                    placeholder="Ej. 396CBASM"
                    value={editNumeroCatalogo}
                    onChange={(e) => setEditNumeroCatalogo(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  />
                </div>

                {/* 5. Programa Académico (ancho completo en dos columnas) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <label
                      htmlFor="editPrograma"
                      className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate"
                      title="Programa Académico"
                    >
                      Programa Académico <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    {programas && programas.length === 0 && (
                      <Link
                        href="/configuracion"
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 shrink-0 ml-1"
                      >
                        Crear programas &rarr;
                      </Link>
                    )}
                  </div>
                  <select
                    id="editPrograma"
                    value={editPrograma}
                    onChange={(e) => setEditPrograma(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                  >
                    <option value="">Selecciona un programa académico...</option>
                    {editPrograma && !programas?.some((p) => p.nombre === editPrograma) && (
                      <option value={editPrograma}>{editPrograma} (Actual)</option>
                    )}
                    {programas?.map((p) => (
                      <option key={p.id} value={p.nombre}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editError && (
                <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50 px-3.5 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleCerrarModalEdicion}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

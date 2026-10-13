"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ResultadoAprendizaje } from "@/lib/db";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Layers,
  BookOpen,
} from "lucide-react";

interface VistaRAPProps {
  asignaturaId: number;
}

export function VistaRAP({ asignaturaId }: VistaRAPProps) {
  // Carga reactiva de los RAs de la asignatura
  const resultados = useLiveQuery(
    () => db.resultados_aprendizaje.where("asignaturaId").equals(asignaturaId).toArray(),
    [asignaturaId]
  );

  // Carga reactiva de los cortes de la asignatura para saber dónde se evalúa cada RA
  const cortes = useLiveQuery(
    () => db.cortes.where("asignaturaId").equals(asignaturaId).toArray(),
    [asignaturaId]
  );

  // Estados para formulario de nuevo RA
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCodigo, setEditCodigo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sugerencia de siguiente código (ej. RA1, RA2, ...)
  const siguienteCodigoSugerido = useMemo(() => {
    if (!resultados || resultados.length === 0) return "RA1";
    const numeros = resultados
      .map((r) => {
        const match = r.codigo.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => n > 0);
    const maxNum = numeros.length > 0 ? Math.max(...numeros) : resultados.length;
    return `RA${maxNum + 1}`;
  }, [resultados]);

  // Manejador para registrar nuevo RA
  const handleCrearRA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    setExitoMsg(null);

    const trimmedCodigo = (codigo || siguienteCodigoSugerido).trim().toUpperCase();
    const trimmedDescripcion = descripcion.trim();

    if (!trimmedCodigo) {
      setErrorForm("Por favor ingresa o confirma el código del RA.");
      return;
    }

    if (!trimmedDescripcion) {
      setErrorForm("Por favor ingresa la descripción del Resultado de Aprendizaje.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Validar si el código ya existe en esta asignatura
      const existente = await db.resultados_aprendizaje
        .where("asignaturaId")
        .equals(asignaturaId)
        .and((r) => r.codigo.toUpperCase() === trimmedCodigo)
        .first();

      if (existente) {
        setErrorForm(`El código "${trimmedCodigo}" ya está registrado en esta asignatura.`);
        return;
      }

      await db.resultados_aprendizaje.add({
        asignaturaId,
        codigo: trimmedCodigo,
        descripcion: trimmedDescripcion,
      });

      setCodigo("");
      setDescripcion("");
      setExitoMsg(`Resultado de aprendizaje "${trimmedCodigo}" registrado con éxito.`);
    } catch (err) {
      console.error("Error al registrar RA:", err);
      setErrorForm("Ocurrió un error al guardar el resultado de aprendizaje.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Iniciar edición de un RA
  const handleIniciarEdicion = (ra: ResultadoAprendizaje) => {
    if (!ra.id) return;
    setEditingId(ra.id);
    setEditCodigo(ra.codigo);
    setEditDescripcion(ra.descripcion);
    setEditError(null);
    setErrorForm(null);
    setExitoMsg(null);
  };

  const handleCancelarEdicion = () => {
    setEditingId(null);
    setEditCodigo("");
    setEditDescripcion("");
    setEditError(null);
  };

  // Guardar edición
  const handleGuardarEdicion = async (id: number) => {
    const trimmedCodigo = editCodigo.trim().toUpperCase();
    const trimmedDescripcion = editDescripcion.trim();

    if (!trimmedCodigo) {
      setEditError("El código no puede estar vacío.");
      return;
    }

    if (!trimmedDescripcion) {
      setEditError("La descripción no puede estar vacía.");
      return;
    }

    try {
      setIsSavingEdit(true);
      setEditError(null);

      // Validar unicidad del código en la misma asignatura (excluyendo el actual)
      const colision = await db.resultados_aprendizaje
        .where("asignaturaId")
        .equals(asignaturaId)
        .and((r) => r.codigo.toUpperCase() === trimmedCodigo && r.id !== id)
        .first();

      if (colision) {
        setEditError(`Ya existe otro RA con el código "${trimmedCodigo}".`);
        return;
      }

      await db.resultados_aprendizaje.update(id, {
        codigo: trimmedCodigo,
        descripcion: trimmedDescripcion,
      });

      handleCancelarEdicion();
      setExitoMsg(`Resultado de aprendizaje "${trimmedCodigo}" actualizado.`);
    } catch (err) {
      console.error("Error al actualizar RA:", err);
      setEditError("Ocurrió un error al actualizar el resultado de aprendizaje.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Eliminar un RA (removiéndolo también de los cortes si estaba asignado)
  const handleEliminarRA = async (ra: ResultadoAprendizaje) => {
    if (!ra.id) return;

    // Verificar en qué cortes está asignado
    const cortesAsignados = cortes?.filter((c) => c.rasEvaluados?.includes(ra.id!)) || [];
    const mensajeAdvertencia =
      cortesAsignados.length > 0
        ? `"${ra.codigo}" está vinculado a ${cortesAsignados.length} corte(s) evaluativo(s). Al eliminarlo se desvinculará automáticamente de esos cortes. ¿Deseas continuar?`
        : `¿Deseas eliminar el resultado de aprendizaje "${ra.codigo}"?`;

    if (!window.confirm(mensajeAdvertencia)) return;

    try {
      await db.transaction("rw", db.resultados_aprendizaje, db.cortes, async () => {
        // 1. Desvincular de los cortes
        for (const c of cortesAsignados) {
          const actualizados = (c.rasEvaluados || []).filter((raId) => raId !== ra.id);
          await db.cortes.update(c.id!, { rasEvaluados: actualizados });
        }
        // 2. Eliminar el RA
        await db.resultados_aprendizaje.delete(ra.id!);
      });

      setExitoMsg(`Resultado de aprendizaje "${ra.codigo}" eliminado.`);
    } catch (err) {
      console.error("Error al eliminar RA:", err);
      alert("No se pudo eliminar el resultado de aprendizaje.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header explicativo */}
      <div className="bg-white border border-zinc-200 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800 dark:shadow-none p-6 rounded-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
              <Target className="w-3.5 h-3.5" />
              <span>Resultados de Aprendizaje (RAP)</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Catálogo de Resultados de Aprendizaje
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Define los logros y competencias que los estudiantes deben alcanzar en esta asignatura. Luego podrás vincularlos a cada corte evaluativo.
            </p>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 p-3.5 rounded-xl min-w-[200px] text-center">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              Total Registrados
            </span>
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5 block">
              {resultados ? resultados.length : 0}
            </span>
          </div>
        </div>

        {/* Formulario de Registro */}
        <form onSubmit={handleCrearRA} className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label
                htmlFor="codigoRA"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Código <span className="text-rose-500">*</span>
              </label>
              <input
                id="codigoRA"
                type="text"
                placeholder={siguienteCodigoSugerido}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-sm font-mono font-semibold rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors uppercase"
              />
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Sugerido: {siguienteCodigoSugerido}
              </span>
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="descripcionRA"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Descripción del Resultado de Aprendizaje <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="descripcionRA"
                  type="text"
                  placeholder="Ej. Modela y diseña bases de datos relacionales eficientes..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-sm rounded-lg bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmitting ? "Guardando..." : "Agregar RA"}</span>
                </button>
              </div>
            </div>
          </div>

          {errorForm && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/60 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorForm}</span>
            </div>
          )}

          {exitoMsg && (
            <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{exitoMsg}</span>
            </div>
          )}
        </form>
      </div>

      {/* 2. Catálogo de Tarjetas de RAs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-zinc-500" />
            <span>Resultados Configurados para esta Asignatura</span>
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {resultados ? resultados.length : 0} elemento(s)
          </span>
        </div>

        {resultados && resultados.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resultados.map((ra) => {
              const isEditing = editingId === ra.id;
              // Determinar en qué cortes se evalúa
              const cortesDondeSeEvalua =
                cortes?.filter((c) => c.rasEvaluados?.includes(ra.id!)) || [];

              return (
                <div
                  key={ra.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing
                      ? "bg-white border-zinc-400 dark:bg-zinc-900 dark:border-zinc-600 shadow-md ring-1 ring-zinc-300 dark:ring-zinc-700"
                      : "bg-white border-zinc-200/90 shadow-2xs dark:bg-zinc-900/50 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editCodigo}
                          onChange={(e) => setEditCodigo(e.target.value.toUpperCase())}
                          placeholder="Código"
                          className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 uppercase dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-100"
                        />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          Editando resultado
                        </span>
                      </div>

                      <textarea
                        rows={2}
                        value={editDescripcion}
                        onChange={(e) => setEditDescripcion(e.target.value)}
                        placeholder="Descripción del resultado"
                        className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 border border-zinc-300 text-zinc-900 dark:bg-zinc-950 dark:border-zinc-700 dark:text-zinc-100 resize-none"
                      />

                      {editError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{editError}</span>
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={handleCancelarEdicion}
                          disabled={isSavingEdit}
                          className="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGuardarEdicion(ra.id!)}
                          disabled={isSavingEdit}
                          className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold rounded-lg flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between h-full gap-3">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60 shadow-2xs">
                            {ra.codigo}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleIniciarEdicion(ra)}
                              className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                              title={`Editar ${ra.codigo}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarRA(ra)}
                              className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                              title={`Eliminar ${ra.codigo}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                          {ra.descripcion}
                        </p>
                      </div>

                      {/* Cortes donde se evalúa actualmente */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>Evaluación:</span>
                        </span>
                        {cortesDondeSeEvalua.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {cortesDondeSeEvalua.map((c) => (
                              <span
                                key={c.id}
                                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40 font-medium"
                              >
                                Corte {c.numeroCorte}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">No asignado a cortes</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 space-y-2">
            <Target className="w-8 h-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              No hay Resultados de Aprendizaje registrados
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Utiliza el formulario superior para registrar las competencias del syllabus de esta materia (ej. RA1, RA2...). Luego podrás vincularlos a cada uno de los 3 cortes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

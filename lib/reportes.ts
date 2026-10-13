import { db, type ResultadoAprendizaje } from "./db";
import {
  calcularDefinitivaCorte,
  clasificarResultadoAprendizaje,
  type CategoriaDesempeno,
} from "./calculos";

export interface EstudianteReporteCorte {
  estudianteId: number;
  identificacion: string;
  nombreCompleto: string;
  estadoMatricula?: "oficial" | "asistente";
  definitiva: number | null;
  definitivaNumero: number;
  aprobado: boolean;
  categoria: CategoriaDesempeno;
}

export interface DatosInformeCorte {
  asignatura: {
    id: number;
    nombre: string;
    programa: string;
    numeroClase?: string;
    numeroCatalogo?: string;
    periodoNombre: string;
  };
  docenteNombre: string;
  corte: {
    id: number;
    numeroCorte: number;
    porcentaje: number;
  };
  resultadosAprendizaje: ResultadoAprendizaje[];
  estudiantes: EstudianteReporteCorte[];
  metricas: {
    totalMatriculados: number;
    totalCalificados: number;
    totalAprobados: number;
    totalReprobados: number;
    inferiorA2: number;        // definitivaNumero < 2.0
    entre2y29: number;          // 2.0 <= definitivaNumero < 3.0
    porcentajeReprobados: number;
    porcentajeAprobados: number;
    textoMortalidad: string;    // Ej. "19 DE 43, 44%"
    promedioCorte: number;
  };
}

/**
 * Consulta de forma atómica y consolida todos los datos requeridos
 * para la generación de los reportes institucionales en Excel de un corte dado.
 */
export async function prepararDatosInformeCorte(
  corteId: number
): Promise<DatosInformeCorte | null> {
  // 1. Obtener Corte
  const corte = await db.cortes.get(corteId);
  if (!corte) return null;

  // 2. Obtener Asignatura y Periodo
  const asignatura = await db.asignaturas.get(corte.asignaturaId);
  if (!asignatura) return null;

  const periodo = await db.periodos.get(asignatura.periodoId);
  const periodoNombre = periodo?.nombre || "Sin Periodo";

  // 3. Obtener Configuración Global del Docente
  const configDocente = await db.configuracion.get(1);
  const docenteNombre = configDocente?.nombreDocente?.trim() || "Docente Sin Asignar";

  // 4. Obtener RAs cruzados desde rasEvaluados
  const rasIds = corte.rasEvaluados || [];
  let resultadosAprendizaje: ResultadoAprendizaje[] = [];
  if (rasIds.length > 0) {
    resultadosAprendizaje = await db.resultados_aprendizaje
      .where("id")
      .anyOf(rasIds)
      .toArray();
    resultadosAprendizaje.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  // 4. Obtener Actividades del corte
  const actividades = await db.actividades
    .where("corteId")
    .equals(corteId)
    .toArray();
  const actividadIds = actividades.map((a) => a.id!).filter(Boolean);

  // 5. Obtener Notas de las actividades
  const notas =
    actividadIds.length > 0
      ? await db.notas.where("actividadId").anyOf(actividadIds).toArray()
      : [];

  const notasMap = new Map<string, number>();
  for (const n of notas) {
    notasMap.set(`${n.estudianteId}_${n.actividadId}`, n.valor);
  }

  // 6. Obtener Estudiantes de la Asignatura
  const estudiantesList = await db.estudiantes
    .where("asignaturaId")
    .equals(corte.asignaturaId)
    .toArray();

  estudiantesList.sort((a, b) =>
    a.nombreCompleto.localeCompare(b.nombreCompleto, "es", { sensitivity: "base" })
  );

  // 7. Calcular Definitivas, Aprobación, Rangos y Métricas
  let sumaNotas = 0;
  let totalCalificados = 0;
  let totalAprobados = 0;
  let totalReprobados = 0;
  let inferiorA2 = 0;
  let entre2y29 = 0;

  const estudiantesReporte: EstudianteReporteCorte[] = [];

  for (const est of estudiantesList) {
    const definitiva = calcularDefinitivaCorte(
      est.id!,
      actividades,
      notasMap,
      corte.porcentaje
    );

    const notaEfectiva = definitiva ?? 0;
    const aprobado = notaEfectiva >= 3.0;
    const categoria = clasificarResultadoAprendizaje(notaEfectiva);

    if (definitiva !== null) {
      sumaNotas += definitiva;
      totalCalificados++;
    }

    if (aprobado) {
      totalAprobados++;
    } else {
      totalReprobados++;
      if (notaEfectiva < 2.0) {
        inferiorA2++;
      } else {
        entre2y29++;
      }
    }

    estudiantesReporte.push({
      estudianteId: est.id!,
      identificacion: est.identificacion,
      nombreCompleto: est.nombreCompleto,
      estadoMatricula: est.estadoMatricula,
      definitiva,
      definitivaNumero: notaEfectiva,
      aprobado,
      categoria,
    });
  }

  // 8. Métricas Consolidadas
  const totalMatriculados = estudiantesList.length;
  const porcentajeReprobados =
    totalMatriculados > 0
      ? Number(((totalReprobados / totalMatriculados) * 100).toFixed(1))
      : 0;
  const porcentajeAprobados =
    totalMatriculados > 0
      ? Number(((totalAprobados / totalMatriculados) * 100).toFixed(1))
      : 0;

  const textoMortalidad = `${totalReprobados} DE ${totalMatriculados}, ${Math.round(
    porcentajeReprobados
  )}%`;
  const promedioCorte =
    totalCalificados > 0 ? Number((sumaNotas / totalCalificados).toFixed(2)) : 0;

  return {
    asignatura: {
      id: asignatura.id!,
      nombre: asignatura.nombre,
      programa: asignatura.programa,
      numeroClase: asignatura.numeroClase,
      numeroCatalogo: asignatura.numeroCatalogo,
      periodoNombre,
    },
    docenteNombre,
    corte: {
      id: corte.id!,
      numeroCorte: corte.numeroCorte,
      porcentaje: corte.porcentaje,
    },
    resultadosAprendizaje,
    estudiantes: estudiantesReporte,
    metricas: {
      totalMatriculados,
      totalCalificados,
      totalAprobados,
      totalReprobados,
      inferiorA2,
      entre2y29,
      porcentajeReprobados,
      porcentajeAprobados,
      textoMortalidad,
      promedioCorte,
    },
  };
}

export interface FilaPlanMejoramiento {
  asignaturaId: number;
  programa: string;
  asignaturaNombre: string;
  numeroCatalogo?: string;
  numeroClase?: string;
  docenteNombre: string;
  totalMatriculados: number;
  totalReprobados: number;
  porcentajeReprobados: number;
  textoInformacionGeneral: string; // ej. "19 DE 43\n44%"
}

export interface DatosPlanMejoramiento {
  periodo: {
    id: number;
    nombre: string;
  };
  numeroCorte: number;
  pesoCorte: number;
  docenteNombre: string;
  filas: FilaPlanMejoramiento[];
}

/**
 * Consulta y consolida todas las asignaturas de un periodo académico dado para un corte específico,
 * calculando la mortalidad académica de cada una para el reporte institucional "Plan de Mejoramiento".
 */
export async function prepararDatosPlanMejoramiento(
  periodoId: number,
  numeroCorte: number
): Promise<DatosPlanMejoramiento | null> {
  const configDocente = await db.configuracion.get(1);
  const docenteNombre = configDocente?.nombreDocente?.trim() || "Docente Sin Asignar";

  const periodo = await db.periodos.get(periodoId);
  if (!periodo) return null;

  const asignaturas = await db.asignaturas.where("periodoId").equals(periodoId).toArray();
  if (asignaturas.length === 0) {
    return {
      periodo: { id: periodo.id!, nombre: periodo.nombre },
      numeroCorte,
      pesoCorte: numeroCorte === 3 ? 30 : 35,
      docenteNombre,
      filas: [],
    };
  }

  // Ordenar asignaturas alfabéticamente por programa y luego nombre
  asignaturas.sort((a, b) => {
    const compProg = a.programa.localeCompare(b.programa);
    if (compProg !== 0) return compProg;
    return a.nombre.localeCompare(b.nombre);
  });

  let pesoCorteDefecto = numeroCorte === 3 ? 30 : 35;

  const filas = await Promise.all(
    asignaturas.map(async (asig) => {
      // Buscar el corte correspondiente de esta asignatura
      const corte = await db.cortes
        .where("asignaturaId")
        .equals(asig.id!)
        .filter((c) => c.numeroCorte === numeroCorte)
        .first();

      let totalMatriculados = 0;
      let totalReprobados = 0;
      let porcentajeReprobados = 0;
      let textoInformacionGeneral = "0 DE 0\n0%";

      if (corte && corte.id) {
        pesoCorteDefecto = corte.porcentaje;
        const datosCorte = await prepararDatosInformeCorte(corte.id);
        if (datosCorte) {
          totalMatriculados = datosCorte.metricas.totalMatriculados;
          totalReprobados = datosCorte.metricas.totalReprobados;
          porcentajeReprobados = Math.round(datosCorte.metricas.porcentajeReprobados);
          textoInformacionGeneral = `${totalReprobados} DE ${totalMatriculados}\n${porcentajeReprobados}%`;
        }
      } else {
        // Si no existe corte, contar estudiantes matriculados
        const totalEst = await db.estudiantes.where("asignaturaId").equals(asig.id!).count();
        totalMatriculados = totalEst;
        textoInformacionGeneral = `0 DE ${totalEst}\n0%`;
      }

      return {
        asignaturaId: asig.id!,
        programa: asig.programa,
        asignaturaNombre: asig.nombre,
        numeroCatalogo: asig.numeroCatalogo,
        numeroClase: asig.numeroClase,
        docenteNombre,
        totalMatriculados,
        totalReprobados,
        porcentajeReprobados,
        textoInformacionGeneral,
      };
    })
  );

  return {
    periodo: {
      id: periodo.id!,
      nombre: periodo.nombre,
    },
    numeroCorte,
    pesoCorte: pesoCorteDefecto,
    docenteNombre,
    filas,
  };
}

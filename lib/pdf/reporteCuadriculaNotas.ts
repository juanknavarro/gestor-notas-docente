import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Actividad, Estudiante, EscalaCalificaciones } from "@/lib/db";
import { calcularDefinitivaCorte } from "@/lib/calculos";

export interface DatosPDFCuadriculaNotas {
  asignatura: {
    nombre: string;
    programa?: string;
    numeroClase?: string;
    numeroCatalogo?: string;
  };
  periodoNombre: string;
  numeroCorte: number;
  pesoCorte: number;
  docenteNombre: string;
  escala: EscalaCalificaciones;
  actividades: Actividad[];
  estudiantes: Estudiante[];
  notasMap: Map<string, number>;
}

/**
 * Genera y descarga de forma 100% nativa (client-side) la Cuadrícula de Calificaciones
 * de un corte específico en formato PDF Horizontal (Landscape A4) con textos seleccionables y alta fidelidad vectorial.
 *
 * Cumple con:
 * - Orientación Landscape (A4).
 * - Tabla horizontal dinámica con encabezados de actividades y porcentajes.
 * - Celdas de la columna "Definitiva" coloreadas (rojo si reprobó, verde si aprobó) según la escala.
 * - Fila de pie con el Promedio del Grupo por actividad y promedio general del corte.
 * - Caracteres ASCII estándar para evitar corrupción en fuentes jsPDF.
 */
export async function generarPDFCuadriculaNotas(
  datos: DatosPDFCuadriculaNotas
): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const marginLeft = 12;
  const marginRight = 12;
  const contentWidth = pageWidth - marginLeft - marginRight; // 273 mm

  let currentY = 12;

  // 1. ENCABEZADO INSTITUCIONAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("GESTOR ACADEMICO DOCENTE - CUADRICULA DE CALIFICACIONES", marginLeft, currentY);

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(
    `Cuadricula de Notas - Corte ${datos.numeroCorte} (${datos.pesoCorte}%)`,
    marginLeft,
    currentY
  );

  currentY += 4;

  // 2. METADATOS EN TABLA COMPACTA
  const fechaEmision = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    theme: "plain",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 22, fillColor: [248, 250, 252] },
      1: { cellWidth: 78 },
      2: { fontStyle: "bold", cellWidth: 22, fillColor: [248, 250, 252] },
      3: { cellWidth: 68 },
      4: { fontStyle: "bold", cellWidth: 18, fillColor: [248, 250, 252] },
      5: { cellWidth: 65 },
    },
    body: [
      [
        "Asignatura:",
        datos.asignatura.nombre,
        "Programa:",
        datos.asignatura.programa || "No especificado",
        "Periodo:",
        datos.periodoNombre,
      ],
      [
        "Docente:",
        datos.docenteNombre,
        "Clase / Cat:",
        `Clase: ${datos.asignatura.numeroClase || "-"} | Cat: ${
          datos.asignatura.numeroCatalogo || "-"
        }`,
        "Fecha:",
        fechaEmision,
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 3;

  // 3. CÁLCULO DE RESUMEN EJECUTIVO (KPIs DEL CORTE)
  const estudiantesConDefinitiva = datos.estudiantes.map((est) => {
    const def = calcularDefinitivaCorte(
      est.id!,
      datos.actividades,
      datos.notasMap,
      datos.pesoCorte
    );
    return { estudiante: est, definitiva: def };
  });

  const evaluados = estudiantesConDefinitiva.filter((e) => e.definitiva !== null);
  const totalEvaluados = evaluados.length;
  const aprobados = evaluados.filter((e) => (e.definitiva as number) >= 3.0);
  const reprobados = evaluados.filter((e) => (e.definitiva as number) < 3.0);
  const totalAprobados = aprobados.length;
  const totalReprobados = reprobados.length;
  const tasaAprobacion = totalEvaluados > 0 ? (totalAprobados / totalEvaluados) * 100 : 0;
  const tasaReprobacion = totalEvaluados > 0 ? (totalReprobados / totalEvaluados) * 100 : 0;
  const promedioGeneral =
    totalEvaluados > 0
      ? evaluados.reduce((acc, curr) => acc + (curr.definitiva as number), 0) / totalEvaluados
      : 0;

  // Cintillo de KPIs en formato tarjeta compacta
  const kpiRow = [
    [
      `Total Estudiantes: ${datos.estudiantes.length} | Evaluados: ${totalEvaluados}`,
      `Aprobados: ${totalAprobados} (${tasaAprobacion.toFixed(1)}%)`,
      `Reprobados: ${totalReprobados} (${tasaReprobacion.toFixed(1)}%)`,
      `Promedio Corte: ${promedioGeneral.toFixed(1)} / 5.0`,
      `Criterio Aprobatorio: >= 3.0`,
    ],
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    body: kpiRow,
    theme: "plain",
    styles: {
      fontSize: 7.2,
      cellPadding: 1.8,
      fillColor: [248, 250, 252], // Slate-50
      textColor: [51, 65, 85],    // Slate-700
      halign: "center",
      fontStyle: "bold",
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 4. PREPARACIÓN DE LA TABLA DE CALIFICACIONES (HORIZONTAL LANDSCAPE)
  const defColIndex = 3 + datos.actividades.length;

  const head = [
    [
      "#",
      "Identificacion",
      "Estudiante",
      ...datos.actividades.map((act) => {
        const pesoLabel = act.esBonificacion ? "+Bono" : `${act.porcentaje}%`;
        return `${act.nombre}\n(${pesoLabel})`;
      }),
      "Definitiva",
    ],
  ];

  const body = datos.estudiantes.map((est, index) => {
    const fila: string[] = [
      String(index + 1),
      est.identificacion,
      est.nombreCompleto,
    ];

    for (const act of datos.actividades) {
      const nota = datos.notasMap.get(`${est.id}_${act.id}`);
      fila.push(nota !== undefined && nota !== null ? nota.toFixed(1) : "-");
    }

    const def = calcularDefinitivaCorte(
      est.id!,
      datos.actividades,
      datos.notasMap,
      datos.pesoCorte
    );
    fila.push(def !== null ? def.toFixed(1) : "-");

    return fila;
  });

  // Fila de Promedios al pie de la tabla (foot)
  const footRow: string[] = ["", "", "Promedio del Grupo"];

  for (const act of datos.actividades) {
    const notasAct = datos.estudiantes
      .map((e) => datos.notasMap.get(`${e.id}_${act.id}`))
      .filter((n): n is number => n !== undefined && n !== null);

    if (notasAct.length > 0) {
      const promAct = notasAct.reduce((acc, val) => acc + val, 0) / notasAct.length;
      footRow.push(promAct.toFixed(1));
    } else {
      footRow.push("-");
    }
  }

  if (evaluados.length > 0) {
    footRow.push(promedioGeneral.toFixed(1));
  } else {
    footRow.push("-");
  }

  const foot = [footRow];

  // Configuración de anchos de columna y alineaciones
  const columnStylesConfig: Record<number, { cellWidth?: number | "auto"; halign?: "left" | "center" | "right"; fontStyle?: "normal" | "bold" }> = {
    0: { cellWidth: 8, halign: "center" },
    1: { cellWidth: 26, halign: "center" },
    2: { cellWidth: 52, halign: "left" },
    [defColIndex]: { cellWidth: 22, halign: "center", fontStyle: "bold" },
  };

  // Asignar alineación centrada para todas las columnas de actividades
  for (let i = 0; i < datos.actividades.length; i++) {
    columnStylesConfig[3 + i] = { halign: "center" };
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    head,
    body,
    foot,
    theme: "striped",
    headStyles: {
      fillColor: [24, 24, 27], // Zinc-900
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50
    },
    footStyles: {
      fillColor: [241, 245, 249], // Slate-100
      textColor: [15, 23, 42],     // Slate-900
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: 2,
    },
    columnStyles: columnStylesConfig,
    didParseCell: (data) => {
      const colIdx = data.column.index;

      // 1. Estilo especial para columnas de bonificación en la cabecera
      if (data.section === "head") {
        if (colIdx >= 3 && colIdx < defColIndex) {
          const act = datos.actividades[colIdx - 3];
          if (act && act.esBonificacion) {
            data.cell.styles.fillColor = [217, 119, 6]; // Amber-600
          }
        }
      }

      // 2. Coloreado condicional de la Definitiva en el cuerpo de la tabla
      if (data.section === "body") {
        if (colIdx === defColIndex) {
          const rawVal = parseFloat(String(data.cell.raw));
          if (!isNaN(rawVal)) {
            if (rawVal <= datos.escala.bajoMax) {
              // Reprobado: Rojo (Rose-600)
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = "bold";
            } else {
              // Aprobado: Verde (Emerald-600)
              data.cell.styles.textColor = [16, 149, 93];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      }

      // 3. Estilo para la fila de pie (Promedio)
      if (data.section === "foot") {
        if (colIdx === 2) {
          data.cell.styles.halign = "right";
        }
        if (colIdx === defColIndex) {
          const rawVal = parseFloat(String(data.cell.raw));
          if (!isNaN(rawVal)) {
            if (rawVal <= datos.escala.bajoMax) {
              data.cell.styles.textColor = [225, 29, 72];
            } else {
              data.cell.styles.textColor = [16, 149, 93];
            }
          }
        }
      }
    },
  });

  // 5. NUMERACIÓN DE PÁGINAS EN EL PIE (Pagina X de Y)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 9, pageWidth - marginRight, pageHeight - 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      "Documento academico emitido por Gestor de Notas Docente - Local-First Data Protection",
      marginLeft,
      pageHeight - 5
    );

    const paginaTexto = `Pagina ${i} de ${totalPages}`;
    const paginaAncho = doc.getTextWidth(paginaTexto);
    doc.text(paginaTexto, pageWidth - marginRight - paginaAncho, pageHeight - 5);
  }

  // 6. DESCARGA AUTOMÁTICA EN EL NAVEGADOR
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, "_");
  const nombreLimpio = sanitize(datos.asignatura.nombre || "Asignatura");
  const filename = `Cuadricula_Notas_${nombreLimpio}_Corte${datos.numeroCorte}.pdf`;
  doc.save(filename);
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { EscalaCalificaciones } from "@/lib/db";
import type { EstudianteConNota } from "@/lib/calculos";

export interface DatosPDFResultadosAprendizaje {
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
  analisis: {
    totalEvaluados: number;
    promedioGrupo: number;
    tasaAprobacion: number;
    tasaReprobacion: number;
    totalAprobados: number;
    totalReprobados: number;
    bajo: {
      count: number;
      porcentaje: number;
      estudiantes: EstudianteConNota[];
    };
    aceptable: {
      count: number;
      porcentaje: number;
      estudiantes: EstudianteConNota[];
    };
    competente: {
      count: number;
      porcentaje: number;
      estudiantes: EstudianteConNota[];
    };
    excelente: {
      count: number;
      porcentaje: number;
      estudiantes: EstudianteConNota[];
    };
  };
}

/**
 * Genera y descarga de forma 100% nativa y client-side el reporte institucional en PDF
 * de Evaluación de Resultados de Aprendizaje (RAP) con textos seleccionables y alta calidad vectorial.
 */
export async function generarPDFResultadosAprendizaje(
  datos: DatosPDFResultadosAprendizaje
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let currentY = 14;

  // 1. ENCABEZADO INSTITUCIONAL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text("GESTOR ACADÉMICO DOCENTE - INFORME INSTITUCIONAL", marginLeft, currentY);

  currentY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text("Evaluación de Resultados de Aprendizaje", marginLeft, currentY);

  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const fechaGeneracion = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Emisión oficial: ${fechaGeneracion}`, marginLeft, currentY);

  currentY += 5;

  // 2. TABLA DE METADATOS DEL CURSO
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26, fillColor: [248, 250, 252] },
      1: { cellWidth: 65 },
      2: { fontStyle: "bold", cellWidth: 26, fillColor: [248, 250, 252] },
      3: { cellWidth: "auto" },
    },
    body: [
      [
        "Asignatura:",
        datos.asignatura.nombre,
        "Periodo / Corte:",
        `${datos.periodoNombre} - Corte ${datos.numeroCorte} (${datos.pesoCorte}%)`,
      ],
      [
        "Programa:",
        datos.asignatura.programa || "Sin asignar",
        "Docente:",
        datos.docenteNombre || "Docente sin asignar",
      ],
      [
        "No. Catálogo / Clase:",
        `${datos.asignatura.numeroCatalogo || "N/A"} / ${datos.asignatura.numeroClase || "N/A"}`,
        "Criterio Escala:",
        `Bajo <= ${datos.escala.bajoMax.toFixed(1)} | Sobresaliente >= ${datos.escala.umbralSobresaliente.toFixed(1)}`,
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3. BLOQUE DE RESUMEN EJECUTIVO (4 KPIs)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Resumen Ejecutivo de Rendimiento", marginLeft, currentY);
  currentY += 3;

  const kpis = [
    {
      titulo: "Total Evaluados",
      valor: `${datos.analisis.totalEvaluados}`,
      detalle: `${datos.analisis.totalAprobados} aprob. | ${datos.analisis.totalReprobados} reprob.`,
    },
    {
      titulo: "Tasa de Reprobados",
      valor: `${datos.analisis.tasaReprobacion.toFixed(1)}%`,
      detalle: `${datos.analisis.totalReprobados} de ${datos.analisis.totalEvaluados} estudiantes`,
    },
    {
      titulo: "Tasa de Aprobación",
      valor: `${datos.analisis.tasaAprobacion.toFixed(1)}%`,
      detalle: `${datos.analisis.totalAprobados} de ${datos.analisis.totalEvaluados} estudiantes`,
    },
    {
      titulo: "Promedio del Grupo",
      valor: `${datos.analisis.promedioGrupo.toFixed(1)} / 5.0`,
      detalle:
        datos.analisis.promedioGrupo >= 3.0
          ? "Rendimiento promedio aprobatorio"
          : "Rendimiento promedio reprobatorio",
    },
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    theme: "plain",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    head: [[kpis[0].titulo, kpis[1].titulo, kpis[2].titulo, kpis[3].titulo]],
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    body: [
      [
        { content: kpis[0].valor, styles: { halign: "center", fontStyle: "bold", fontSize: 11, textColor: [15, 23, 42] } },
        { content: kpis[1].valor, styles: { halign: "center", fontStyle: "bold", fontSize: 11, textColor: [225, 29, 72] } },
        { content: kpis[2].valor, styles: { halign: "center", fontStyle: "bold", fontSize: 11, textColor: [5, 150, 105] } },
        {
          content: kpis[3].valor,
          styles: {
            halign: "center",
            fontStyle: "bold",
            fontSize: 11,
            textColor: datos.analisis.promedioGrupo >= 3.0 ? [5, 150, 105] : [225, 29, 72],
          },
        },
      ],
      [
        { content: kpis[0].detalle, styles: { halign: "center", fontSize: 7, textColor: [100, 116, 139] } },
        { content: kpis[1].detalle, styles: { halign: "center", fontSize: 7, textColor: [100, 116, 139] } },
        { content: kpis[2].detalle, styles: { halign: "center", fontSize: 7, textColor: [100, 116, 139] } },
        { content: kpis[3].detalle, styles: { halign: "center", fontSize: 7, textColor: [100, 116, 139] } },
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 4. TABLAS SEPARADAS POR NIVEL DE DESEMPEÑO
  interface CategoriaConfig {
    titulo: string;
    rangoTexto: string;
    estadoTexto: string;
    estudiantes: EstudianteConNota[];
    count: number;
    porcentaje: number;
    colorCabecera: [number, number, number];
    colorFondoBanner: [number, number, number];
    colorTextoBanner: [number, number, number];
  }

  const categorias: CategoriaConfig[] = [
    {
      titulo: "1. Nivel Bajo",
      rangoTexto: `0.0 a ${datos.escala.bajoMax.toFixed(1)}`,
      estadoTexto: "Reprobado",
      estudiantes: datos.analisis.bajo.estudiantes,
      count: datos.analisis.bajo.count,
      porcentaje: datos.analisis.bajo.porcentaje,
      colorCabecera: [190, 18, 60], // Rose-700
      colorFondoBanner: [255, 241, 242], // Rose-50
      colorTextoBanner: [159, 18, 57], // Rose-800
    },
    {
      titulo: "2. Nivel Aceptable",
      rangoTexto: `${datos.escala.aceptableMin.toFixed(1)} a ${datos.escala.aceptableMax.toFixed(1)}`,
      estadoTexto: "Aprobado",
      estudiantes: datos.analisis.aceptable.estudiantes,
      count: datos.analisis.aceptable.count,
      porcentaje: datos.analisis.aceptable.porcentaje,
      colorCabecera: [180, 83, 9], // Amber-700
      colorFondoBanner: [254, 243, 199], // Amber-50
      colorTextoBanner: [146, 64, 14], // Amber-800
    },
    {
      titulo: "3. Nivel Competente",
      rangoTexto: `${datos.escala.competenteMin.toFixed(1)} a ${datos.escala.competenteMax.toFixed(1)}`,
      estadoTexto: "Aprobado",
      estudiantes: datos.analisis.competente.estudiantes,
      count: datos.analisis.competente.count,
      porcentaje: datos.analisis.competente.porcentaje,
      colorCabecera: [2, 132, 199], // Sky-600
      colorFondoBanner: [224, 242, 254], // Sky-50
      colorTextoBanner: [3, 105, 161], // Sky-800
    },
    {
      titulo: "4. Nivel Excelente",
      rangoTexto: `${datos.escala.excelenteMin.toFixed(1)} a 5.0`,
      estadoTexto: "Aprobado",
      estudiantes: datos.analisis.excelente.estudiantes,
      count: datos.analisis.excelente.count,
      porcentaje: datos.analisis.excelente.porcentaje,
      colorCabecera: [4, 120, 87], // Emerald-700
      colorFondoBanner: [236, 253, 245], // Emerald-50
      colorTextoBanner: [6, 95, 70], // Emerald-800
    },
  ];

  for (const cat of categorias) {
    // Si queda poco espacio en la página actual, pasar a una nueva
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 16;
    }

    // Banner de la Categoría
    doc.setFillColor(cat.colorFondoBanner[0], cat.colorFondoBanner[1], cat.colorFondoBanner[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginLeft, currentY, contentWidth, 7.5, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(cat.colorTextoBanner[0], cat.colorTextoBanner[1], cat.colorTextoBanner[2]);
    doc.text(
      `${cat.titulo} (${cat.estadoTexto}) - Rango: [ ${cat.rangoTexto} ]`,
      marginLeft + 3,
      currentY + 5
    );

    const textoResumen = `${cat.count} estudiante(s) (${cat.porcentaje.toFixed(1)}%)`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const anchoResumen = doc.getTextWidth(textoResumen);
    doc.text(textoResumen, marginLeft + contentWidth - anchoResumen - 3, currentY + 5);

    currentY += 9;

    // Tabla de estudiantes en esta categoría
    if (cat.estudiantes.length === 0) {
      autoTable(doc, {
        startY: currentY,
        margin: { left: marginLeft, right: marginRight },
        theme: "plain",
        styles: {
          fontSize: 7.5,
          fontStyle: "italic",
          textColor: [148, 163, 184],
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          halign: "center",
        },
        body: [["Sin estudiantes registrados en este nivel de logro"]],
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    } else {
      const filasTabla = cat.estudiantes.map((est, idx) => [
        idx + 1,
        est.identificacion,
        est.nombreCompleto,
        est.definitiva.toFixed(1),
      ]);

      autoTable(doc, {
        startY: currentY,
        margin: { left: marginLeft, right: marginRight },
        theme: "striped",
        head: [["#", "Identificación", "Nombre del Estudiante", "Definitiva"]],
        body: filasTabla,
        headStyles: {
          fillColor: cat.colorCabecera,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
          cellPadding: 1.8,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 32, fontStyle: "bold" },
          2: { cellWidth: "auto" },
          3: { cellWidth: 24, halign: "center", fontStyle: "bold" },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // 5. NUMERACIÓN DE PÁGINAS EN EL PIE (Página X de Y)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 11, pageWidth - marginRight, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      "Documento académico emitido por Gestor de Notas Docente - Local-First Data Protection",
      marginLeft,
      pageHeight - 6.5
    );

    const paginaTexto = `Página ${i} de ${totalPages}`;
    const paginaAncho = doc.getTextWidth(paginaTexto);
    doc.text(paginaTexto, pageWidth - marginRight - paginaAncho, pageHeight - 6.5);
  }

  // 6. DESCARGA AUTOMÁTICA EN EL NAVEGADOR
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, "_");
  const nombreLimpio = sanitize(datos.asignatura.nombre || "Asignatura");
  const filename = `Reporte_RAP_${nombreLimpio}_Corte${datos.numeroCorte}.pdf`;
  doc.save(filename);
}

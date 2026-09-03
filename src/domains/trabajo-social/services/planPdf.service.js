const fs = require('fs/promises');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

const planTemplatePath = path.join(
  __dirname,
  '../../../templates/trabajo-social/plan-servicio-social.hbs'
);

const cronogramaTemplatePath = path.join(
  __dirname,
  '../../../templates/trabajo-social/cronograma-servicio-social.hbs'
);
const anexosTemplatePath = path.join(
  __dirname,
  '../../../templates/trabajo-social/anexos-servicio-social.hbs'
);
const logoPath = path.join(
  __dirname,
  '../../../../images/logonuevo.png'
);

const fileToDataUri = async (filePath, mimeType) => {
  const file = await fs.readFile(filePath);
  return `data:${mimeType};base64,${file.toString('base64')}`;
};

const renderTemplate = async (templatePath, data) => {
  const source = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(source);
  return template(data);
};

const generarPdfDesdeHtml = async (browser, html) => {
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    await page.emulateMediaType('print');

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
};

const normalizarActividades = (actividades = []) => {
  return actividades.map((actividad) => ({
    actividad: actividad.actividad || '',
    justificacion: actividad.justificacion || '',
    fecha: actividad.fecha || '',
    fechaFin:
      actividad.fechaFin ||
      actividad.fecha_fin_primero ||
      actividad.fecha_fin ||
      '',
    resultados: actividad.resultados || '',
  }));
};

const unirPdfs = async (pdfs) => {
  const documentoFinal = await PDFDocument.create();

  for (const pdfBuffer of pdfs) {
    if (!pdfBuffer) continue;

    const documento = await PDFDocument.load(pdfBuffer);

    const paginas = await documentoFinal.copyPages(
      documento,
      documento.getPageIndices()
    );

    paginas.forEach((pagina) => documentoFinal.addPage(pagina));
  }

  const resultado = await documentoFinal.save();

  return Buffer.from(resultado);
};

const generarPlanServicioSocialPdf = async (
  data,
  anexosPdf = []
) => {
  let browser;

  try {
    const actividades = normalizarActividades(data.actividades);

    if (actividades.length === 0) {
      const error = new Error(
        'El plan debe contener al menos una actividad'
      );
      error.status = 400;
      throw error;
    }

    const logoDataUri = await fileToDataUri(
      logoPath,
      'image/png'
    );

        const [htmlPlan, htmlCronograma, htmlAnexos] = await Promise.all([
        renderTemplate(planTemplatePath, {
            ...data,
            logoDataUri,
            anio: data.anio || new Date().getFullYear(),
        }),
        renderTemplate(cronogramaTemplatePath, {
            actividades,
        }),
        renderTemplate(anexosTemplatePath, {}),
        ]);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

const [pdfPlan, pdfCronograma, pdfAnexos] = await Promise.all([
  generarPdfDesdeHtml(browser, htmlPlan),
  generarPdfDesdeHtml(browser, htmlCronograma),
  generarPdfDesdeHtml(browser, htmlAnexos),
]);

return await unirPdfs([
  pdfPlan,
  pdfCronograma,
  pdfAnexos,
  ...anexosPdf,
]);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  generarPlanServicioSocialPdf,
};
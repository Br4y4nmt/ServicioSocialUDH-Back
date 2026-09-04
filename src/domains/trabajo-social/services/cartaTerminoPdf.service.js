const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

const templatePath = path.join(
  __dirname,
  '../../../templates/trabajo-social/carta-termino.hbs'
);

const backendRoot = path.join(__dirname, '../../../..');

const firmasPath = path.join(
  backendRoot,
  'uploads',
  'firmas'
);

const logoPrincipalPath = path.join(
  backendRoot,
  'images',
  'logonuevo.png'
);

const logoAlternativoPath = path.join(
  backendRoot,
  'images',
  'logoudh.png'
);

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

function archivoADataUri(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function obtenerLogoDataUri() {
  if (fs.existsSync(logoPrincipalPath)) {
    return archivoADataUri(logoPrincipalPath);
  }

  if (fs.existsSync(logoAlternativoPath)) {
    return archivoADataUri(logoAlternativoPath);
  }

  throw new Error(
    'No se encontró el logo institucional'
  );
}

function obtenerFirmaDataUri(firmaDigital) {
  if (!firmaDigital) {
    throw new Error(
      'El docente no tiene una firma digital registrada'
    );
  }

  const nombreArchivo = path.basename(firmaDigital);

  const rutaFirma = path.join(
    firmasPath,
    nombreArchivo
  );

  if (!fs.existsSync(rutaFirma)) {
    throw new Error(
      'El archivo de firma digital del docente no existe'
    );
  }

  return archivoADataUri(rutaFirma);
}

function formatearFecha(fecha = new Date()) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}

async function generarQrDataUri(url) {
  if (!url) {
    throw new Error(
      'La URL de verificación es obligatoria'
    );
  }

  return QRCode.toDataURL(url, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

async function renderTemplate(data) {
  const templateSource =
    await fs.promises.readFile(
      templatePath,
      'utf8'
    );

  const template =
    Handlebars.compile(templateSource);

  return template(data);
}

async function generarPdfDesdeHtml(html) {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '3mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generarCartaTerminoPdf({
  nombreEstudiante,
  nombrePrograma,
  nombreFacultad,
  nombreLabor,
  nombreDocente,
  firmaDigital,
  urlVerificacion,
  fecha = new Date(),
}) {
  if (!nombreEstudiante) {
    throw new Error(
      'El nombre del estudiante es obligatorio'
    );
  }

  if (!nombrePrograma) {
    throw new Error(
      'El programa académico es obligatorio'
    );
  }

  if (!nombreFacultad) {
    throw new Error(
      'La facultad es obligatoria'
    );
  }

  if (!nombreLabor) {
    throw new Error(
      'La labor social es obligatoria'
    );
  }

  if (!nombreDocente) {
    throw new Error(
      'El nombre del docente es obligatorio'
    );
  }

  const [
    qrDataUri,
    logoDataUri,
    firmaDataUri,
  ] = await Promise.all([
    generarQrDataUri(urlVerificacion),
    Promise.resolve(obtenerLogoDataUri()),
    Promise.resolve(obtenerFirmaDataUri(firmaDigital)),
  ]);

  const html = await renderTemplate({
    logoDataUri,
    firmaDataUri,
    qrDataUri,
    nombreEstudiante,
    nombrePrograma,
    nombreFacultad,
    nombreLabor,
    nombreDocente,
    fechaFormateada: formatearFecha(fecha),
    urlVerificacion,
  });

  return generarPdfDesdeHtml(html);
}

module.exports = {
  generarCartaTerminoPdf,
};
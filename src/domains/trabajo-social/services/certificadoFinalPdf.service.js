const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

const templatePath = path.join(
  __dirname,
  '../../../templates/trabajo-social/certificado-final.hbs'
);

const backendRoot = path.join(__dirname, '../../../..');

// Logo de la Oficina de Servicio Social. Si no existe, cae al logo
// institucional general que ya usan las otras cartas.
const logoServicioSocialPath = path.join(
  backendRoot,
  'images',
  'logoSS.png'
);

const logoPrincipalPath = path.join(
  backendRoot,
  'images',
  'logoudh.png'
);

const logoAlternativoPath = path.join(
  backendRoot,
  'images',
  'logonuevo.png'
);


const firmaInstitucionalPath = path.join(
  backendRoot,
  'images',
  'firma.png'
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

function obtenerLogoServicioSocialUri() {
  if (fs.existsSync(logoServicioSocialPath)) {
    return archivoADataUri(logoServicioSocialPath);
  }

  if (fs.existsSync(logoPrincipalPath)) {
    return archivoADataUri(logoPrincipalPath);
  }

  if (fs.existsSync(logoAlternativoPath)) {
    return archivoADataUri(logoAlternativoPath);
  }

  throw new Error(
    'No se encontró ningún logo institucional en la carpeta images'
  );
}

function obtenerFirmaInstitucionalUri() {
  if (!fs.existsSync(firmaInstitucionalPath)) {
    throw new Error(
      'No se encontró la firma institucional (firma.png) en la carpeta images'
    );
  }

  return archivoADataUri(firmaInstitucionalPath);
}

const DIAS = [
  'domingo', 'lunes', 'martes', 'miércoles',
  'jueves', 'viernes', 'sábado',
];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatearFechaCertificado(fecha = new Date()) {
  const diaSemana = DIAS[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = MESES[fecha.getMonth()];
  const anio = fecha.getFullYear();

  return `Huánuco, ${diaSemana} ${dia} de ${mes} del ${anio}`;
}

async function generarQrDataUri(url) {
  if (!url) {
    throw new Error('La URL de verificación es obligatoria');
  }

  return QRCode.toDataURL(url, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

async function renderTemplate(templateData) {
  const templateSource = await fs.promises.readFile(
    templatePath,
    'utf8'
  );

  const template = Handlebars.compile(templateSource);

  return template(templateData);
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
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generarCertificadoFinalPdf({
  nombreEstudiante,
  nombrePrograma,
  urlVerificacion,
  fecha = new Date(),
}) {
  if (!nombreEstudiante) {
    throw new Error('El nombre del estudiante es obligatorio');
  }

  if (!nombrePrograma) {
    throw new Error('El programa académico es obligatorio');
  }

  const [
    qrDataUri,
    logoDataUri,
    firmaDataUri,
  ] = await Promise.all([
    generarQrDataUri(urlVerificacion),
    Promise.resolve(obtenerLogoServicioSocialUri()),
    Promise.resolve(obtenerFirmaInstitucionalUri()),
  ]);

  const html = await renderTemplate({
    logoDataUri,
    firmaDataUri,
    qrDataUri,
    nombreEstudiante: String(nombreEstudiante).toUpperCase(),
    nombrePrograma: String(nombrePrograma).toUpperCase(),
    fechaExtendida: formatearFechaCertificado(fecha),
    urlVerificacion,
  });

  return generarPdfDesdeHtml(html);
}

module.exports = {
  generarCertificadoFinalPdf,
};
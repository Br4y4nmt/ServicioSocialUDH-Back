const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { TrabajoComunitario, Usuario } = require('../models');

router.post('/trabajo/:id_trabajo', async (req, res) => {
  const { id_trabajo } = req.params;
  const { usuario_id } = req.body;

  try {
    const trabajo = await TrabajoComunitario.findByPk(id_trabajo);
    if (!trabajo) return res.status(404).json({ message: 'Trabajo no encontrado' });

    const usuario = await Usuario.findByPk(usuario_id);
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const doc = new PDFDocument({ margin: 50 });
    const nombreArchivo = `comprobante_trabajo_${id_trabajo}.pdf`;
    const rutaComprobante = path.join(__dirname, '../uploads', nombreArchivo);

    if (!fs.existsSync(path.dirname(rutaComprobante))) {
      fs.mkdirSync(path.dirname(rutaComprobante), { recursive: true });
    }

    const stream = fs.createWriteStream(rutaComprobante);
    doc.pipe(stream);

    // Marco decorativo
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke();

    // Logo
    const logoPath = path.join(__dirname, '../images/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 40, { width: 100 });
    }

    // Título
    doc.font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#0d6efd')
      .text('CERTIFICADO DE TRABAJO COMUNITARIO', 0, 80, { align: 'center' });

    // Subtítulo
    doc.moveDown();
    doc.font('Helvetica-Oblique')
      .fontSize(14)
      .fillColor('black')
      .text('Se certifica que el siguiente ciudadano ha cumplido satisfactoriamente su labor comunitaria:', {
        align: 'center'
      });

    doc.moveDown(2);

    // Datos principales
    doc.font('Helvetica')
      .fontSize(12)
      .fillColor('black')
      .text(`Nombre del Transportista: ${usuario.nombre} ${usuario.apellido}`, { align: 'left' })
      .moveDown(0.5)
      .text(`Trabajo Realizado: ${trabajo.nombre}`, { align: 'left' })
      .moveDown(0.5)
      .text(`Descripción: ${trabajo.descripcion}`, { align: 'left' })
      .moveDown(0.5)
      .text(`Ubicación: ${trabajo.ubicacion}`, { align: 'left' })
      .moveDown(0.5)
      .text(`Monto Asignado: S/. ${parseFloat(trabajo.monto).toFixed(2)}`, { align: 'left' })
      .moveDown(0.5)
      .text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, { align: 'left' });

    // Simulación de área de firma
    doc.moveDown(4);
    doc.font('Helvetica-Oblique')
      .fontSize(11)
      .fillColor('black')
      .text('_____________________________', 400, doc.y, { align: 'center' });
    doc.text('Firma Responsable', 400, doc.y, { align: 'center' });

    // Pie de página
    const bottom = doc.page.height - 40;
    doc.fontSize(9)
       .fillColor('gray')
       .text('Gracias por contribuir al bienestar de nuestra comunidad | Sistema de Gestión Municipal', 50, bottom, {
         align: 'center',
         width: 500,
       });

    doc.end();

    stream.on('finish', async () => {
      await trabajo.update({ comprobante_pdf: nombreArchivo });
      return res.status(200).json({ message: 'Comprobante tipo diploma generado exitosamente.', nombreArchivo });
    });

  } catch (error) {
    console.error('Error generando comprobante:', error);
    res.status(500).json({ message: 'Error generando comprobante.' });
  }
});

module.exports = router;

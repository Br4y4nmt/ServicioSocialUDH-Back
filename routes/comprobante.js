const express = require('express');
const PDFDocument = require('pdfkit');
const Usuario = require('../models/Usuario');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/:id_multa', async (req, res) => {
  try {
    const { id_multa } = req.params;

    // Buscar la multa con los datos del usuario
    const multa = await Multa.findByPk(id_multa, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['nombre', 'apellido', 'email'],
        },
      ],
    });

    if (!multa) {
      return res.status(404).json({ error: 'Multa no encontrada.' });
    }

    // Ruta del logo en el backend
    const logoPath = path.join(__dirname, '../images/logo.png');
    if (!fs.existsSync(logoPath)) {
      console.error('El archivo del logo no existe en la ruta:', logoPath);
      return res.status(500).json({ error: 'Logo no encontrado en el servidor.' });
    }

    // Crear el PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=comprobante_${id_multa}.pdf`);

    // Aumentar el tamaño del logo
    doc.image(logoPath, 50, 40, { width: 150 }) // Logo más grande (150 píxeles de ancho)
      .fillColor('#444444')
      .fontSize(22)
      .text('Municipalidad de Huanuco', 210, 60) // Ajustar posición del texto del encabezado
      .fontSize(10)
      .text('Dirección: Av. Principal 123, Ciudad', 200, 90, { align: 'right' })
      .text('Teléfono: (01) 123-4567', 200, 105, { align: 'right' })
      .moveDown();

    // Título principal centrado encima de la línea negra
    doc.moveDown()
      .fontSize(20)
      .text('Comprobante de Pago', { align: 'center' })
      .moveDown()
      .moveTo(50, doc.y - 5) // Ajustar posición para que la línea esté debajo del texto
      .lineTo(550, doc.y - 5)
      .stroke();

    // Información de la multa
    doc
      .fontSize(14)
      .fillColor('#000000')
      .text(`Número de PIT: ${multa.numero_pit || 'N/A'}`)
      .text(`Infracción: ${multa.tipo_infraccion}`)
      .text(`Monto Pagado: S/. ${multa.monto.toFixed(2)}`)
      .text(`Fecha de Pago: ${new Date().toLocaleDateString()}`)
      .moveDown();

    // Información del usuario
    doc
      .fillColor('#444444')
      .fontSize(14)
      .text('Datos del Usuario:', { underline: true })
      .text(`Nombre: ${multa.usuario.nombre} ${multa.usuario.apellido}`)
      .text(`Correo Electrónico: ${multa.usuario.email}`)
      .moveDown();

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Error al generar el comprobante de pago:', error);
    res.status(500).json({ error: 'Error al generar el comprobante de pago.' });
  }
});

module.exports = router;

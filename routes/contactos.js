const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();


const Contactos = require('../models/Contactos');


router.post('/contacto', async (req, res) => {
  try {
    const {
      nombre_completo,
      correo_electronico,
      tipo_usuario,
      mensaje
    } = req.body;

    if (
      !nombre_completo ||
      !correo_electronico ||
      !tipo_usuario ||
      !mensaje
    ) {
      return res.status(400).json({
        message: 'Todos los campos son obligatorios'
      });
    }

    const nuevoContacto = await Contactos.create({
      nombre_completo,
      correo_electronico,
      tipo_usuario,
      mensaje
    });

    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
    });

    await transporter.sendMail({
      from: `"Portal SSU" <${process.env.EMAIL_USER}>`,
      to: 'servicio.social@udh.edu.pe',
      subject: 'Nuevo mensaje desde la plataforma SSU',

      html: `
        <div style="font-family: Arial; padding:20px;">
          <h2 style="color:#0F2F54;">Nuevo mensaje recibido</h2>

          <p><strong>Nombre:</strong> ${nombre_completo}</p>
          <p><strong>Correo:</strong> ${correo_electronico}</p>
          <p><strong>Tipo usuario:</strong> ${tipo_usuario}</p>

          <hr/>

          <p><strong>Mensaje:</strong></p>
          <p>${mensaje}</p>
        </div>
      `
    });

    return res.status(201).json({
      message: 'Mensaje enviado correctamente',
      data: nuevoContacto
    });

  } catch (error) {
    console.error('Error en contacto:', error);

    return res.status(500).json({
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

module.exports = router;
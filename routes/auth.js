const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/database').sequelize;
const { ProgramasAcademicos, Estudiantes, Facultades, Usuario, Docentes, Roles} = require('../models');
const { Op } = require('sequelize'); 
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();
const SystemConfig = require('../models/SystemConfig');
const authMiddleware = require('../middlewares/authMiddleware'); 
const verificarRol = require('../middlewares/verificarRol');  
const axios = require('axios');
const { getDatosAcademicosUDH } = require('../services/udhservicenuevo');


// Registro de estudiantes con código universitario, DNI y WhatsApp
router.post('/register', async (req, res) => {
  const { codigo, dni, whatsapp } = req.body;

  try {
    if (!codigo || !dni || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }
    const config = await SystemConfig.findByPk(1);

    if (!config || Number(config.registro_habilitado) === 0) {
      console.log('REGISTRO BLOQUEADO POR CONFIG');
      return res.status(403).json({
        message: 'El registro de estudiantes está deshabilitado temporalmente'
      });
    }

    let data = await getDatosAcademicosUDH(codigo);
    if (!data) {
      return res.status(400).json({ message: 'Código inválido o no encontrado' });
    }

    const udhDni = data.dni || (data.raw && data.raw.stu_dni);
    if (dni !== udhDni) {
      return res.status(400).json({ message: 'El DNI ingresado no coincide con el DNI del estudiante' });
    }

    const udhCiclo = data.ciclo || (data.raw && data.raw.stu_ciclo);
    if (udhCiclo !== null && udhCiclo !== undefined && Number(udhCiclo) < 7) {
      return res.status(400).json({ message: 'Solo pueden registrarse estudiantes del ciclo 7 o superior' });
    }

    const existingUser = await Usuario.findOne({ where: { email: `${codigo}@udh.edu.pe` } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const facultadNombre = (data.facultad || (data.raw && data.raw.stu_facultad) || '').trim();
    const facultad = await Facultades.findOne({
      where: { nombre_facultad: facultadNombre }
    });

    if (!facultad) {
      return res.status(400).json({ message: 'Facultad no encontrada' });
    }

    const programaNombre = (data.programa || (data.raw && data.raw.stu_programa) || '').trim();
    const programa = await ProgramasAcademicos.findOne({
      where: { nombre_programa: programaNombre, id_facultad: facultad.id_facultad }
    });

    if (!programa) {
      return res.status(400).json({ message: 'Programa académico no encontrado' });
    }

    const nuevoUsuario = await Usuario.create({
      email: `${codigo}@udh.edu.pe`,
      dni,
      whatsapp,
      password: '', 
      rol_id: 3 
    });

    const nombreCompleto = data.nombre_completo || ((data.raw && `${data.raw.stu_nombres || ''} ${data.raw.stu_apellido_paterno || ''} ${data.raw.stu_apellido_materno || ''}`).trim());
    await Estudiantes.create({
      nombre_estudiante: nombreCompleto,
      dni,
      email: `${codigo}@udh.edu.pe`,
      celular: whatsapp,
      facultad_id: facultad.id_facultad,
      programa_academico_id: programa.id_programa,
      id_usuario: nuevoUsuario.id_usuario,
      codigo: data.codigo || codigo
    });

    res.status(201).json({ message: 'Usuario y estudiante registrados correctamente' });

  } catch (error) {
    console.error('Error registrando usuario y estudiante:', error);
    res.status(500).json({ message: 'Error registrando usuario y estudiante', error: error.message });
  }
});



//registro de estudiantes con código universitario (desde gestor)
router.post('/register-codigo', authMiddleware, async (req, res) => {
  const { codigo, whatsapp } = req.body;

  try {
    if (!codigo || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    if (codigo.length !== 10) {
      return res.status(400).json({ message: 'El código debe tener exactamente 10 dígitos' });
    }

    let data = await getDatosAcademicosUDH(codigo);
    if (!data) {
      return res.status(400).json({ message: 'Código inválido o no encontrado en UDH' });
    }
    const email = `${codigo}@udh.edu.pe`;
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const facultadNombre = (data.facultad || (data.raw && data.raw.stu_facultad) || '').trim();
    const facultad = await Facultades.findOne({
      where: { nombre_facultad: facultadNombre }
    });
    if (!facultad) {
      return res.status(400).json({ message: 'Facultad no encontrada' });
    }

    const programaNombre = (data.programa || (data.raw && data.raw.stu_programa) || '').trim();
    const programa = await ProgramasAcademicos.findOne({
      where: {
        nombre_programa: programaNombre,
        id_facultad: facultad.id_facultad
      }
    });
    if (!programa) {
      return res.status(400).json({ message: 'Programa académico no encontrado' });
    }

    const udhDni = data.dni || (data.raw && data.raw.stu_dni);
    const nombreCompleto = data.nombre_completo || ((data.raw && `${data.raw.stu_nombres || ''} ${data.raw.stu_apellido_paterno || ''} ${data.raw.stu_apellido_materno || ''}`).trim());

    const nuevoUsuario = await Usuario.create({
      email,
      dni: udhDni,
      whatsapp,
      password: '',
      rol_id: 3
    });

    await Estudiantes.create({
      nombre_estudiante: nombreCompleto,
      dni: udhDni,
      email,
      celular: whatsapp,
      facultad_id: facultad.id_facultad,
      programa_academico_id: programa.id_programa,
      id_usuario: nuevoUsuario.id_usuario,
      codigo: data.codigo || (data.raw && data.raw.stu_codigo) || codigo
    });

    res.status(201).json({ message: 'Estudiante registrado correctamente' });

  } catch (error) {
    console.error('Error registrando estudiante:', error);
    res.status(500).json({ message: 'Error registrando estudiante', error: error.message });
  }
});

/// Login con Google
router.post('/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();


    const { email, name, picture } = payload;
    const nombre_completo = name || '';
    const codigo_estudiante = email.split('@')[0];



    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Roles }]
    });

    if (!usuario) {
      console.warn('[Google Login] Usuario no encontrado en la base de datos.');
      return res.status(401).json({ message: 'Este correo no está registrado. Debes registrarte primero.' });
    }

    let programa_academico_id = null;
    let facultad_id = null;

    if (usuario.rol_id === 4) { 
      const { ProgramasAcademicos } = require('../models');
      const programa = await ProgramasAcademicos.findOne({
        where: { usuario_id: usuario.id_usuario },
      });

      if (programa) {
        programa_academico_id = programa.id_programa;
        facultad_id = programa.id_facultad;
      }
    }

    const jwtToken = jwt.sign(
      {
        id: usuario.id_usuario,
        rol: usuario.Role.nombre_rol,
        programa_academico_id,
        facultad_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token: jwtToken,
      rol: usuario.Role.nombre_rol,
      id_usuario: usuario.id_usuario,
      nombre_completo,
      foto_perfil: picture,
      codigo_estudiante,
      email,
      programa_academico_id,
      facultad_id
    });

  } catch (error) {
    console.error(' [Google Login] Error autenticando con Google:', error);
    res.status(401).json({
      message: 'Token de Google inválido',
      error: error.message,
    });
  }
});

// Registro de docentes con datos completos (desde gestor)
router.post('/registrar-docente-completo', async (req, res) => {
  const { email, dni, whatsapp, facultad_id, programa_academico_id } = req.body;

  try {
    if (!email || !whatsapp || !facultad_id || !programa_academico_id) {
        return res.status(400).json({ message: 'Faltan campos requeridos' });
      }
    const existente = await Usuario.findOne({ where: { email } });
    if (existente) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const rolDocente = await Roles.findOne({ where: { nombre_rol: 'docente supervisor' } });
    if (!rolDocente) {
      return res.status(500).json({ message: 'No se encontró el rol de docente' });
    }

    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      rol_id: rolDocente.id_rol,
      password: '',
      primera_vez: true
    });

    const nuevoDocente = await Docentes.create({
      email,
      dni,
      celular: whatsapp,
      facultad_id,
      programa_academico_id,
      id_usuario: nuevoUsuario.id_usuario
    });

    res.status(201).json({
      message: 'Docente y usuario creados correctamente',
      docente: nuevoDocente,
      usuario: nuevoUsuario
    });

  } catch (error) {
    console.error('Error creando docente y usuario:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
});


module.exports = router;

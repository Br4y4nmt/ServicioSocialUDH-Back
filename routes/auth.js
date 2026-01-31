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

    let data;
    try {
      const resUDH = await axios.get(`http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigo}`, { timeout: 7000 });
      data = resUDH.data[0];
    } catch (error) {
      console.error('Error conectando con la API de UDH:', error.message);
      return res.status(503).json({ message: 'El servidor de UDH no está disponible. Intenta más tarde.' });
    }

    if (!data) {
      return res.status(400).json({ message: 'Código inválido o no encontrado' });
    }
    
    if (dni !== data.stu_dni) {
    return res.status(400).json({ message: 'El DNI ingresado no coincide con el DNI del estudiante' });
  }
    if (data.stu_ciclo < 7) {
      return res.status(400).json({ message: 'Solo pueden registrarse estudiantes del ciclo 7 o superior' });
    }

    const existingUser = await Usuario.findOne({ where: { email: `${codigo}@udh.edu.pe` } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const facultad = await Facultades.findOne({
      where: { nombre_facultad: data.stu_facultad.trim() } 
    });

    if (!facultad) {
      return res.status(400).json({ message: 'Facultad no encontrada' });
    }

    const programa = await ProgramasAcademicos.findOne({
      where: { nombre_programa: data.stu_programa.trim(), id_facultad: facultad.id_facultad } 
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

    await Estudiantes.create({
      nombre_estudiante: `${data.stu_nombres} ${data.stu_apellido_paterno} ${data.stu_apellido_materno}`,
      dni,
      email: `${codigo}@udh.edu.pe`,
      celular: whatsapp,
      facultad_id: facultad.id_facultad,  
      programa_academico_id: programa.id_programa,  
      id_usuario: nuevoUsuario.id_usuario,
      codigo: data.stu_codigo
    });

    res.status(201).json({ message: 'Usuario y estudiante registrados correctamente' });

  } catch (error) {
    console.error('Error registrando usuario y estudiante:', error);
    res.status(500).json({ message: 'Error registrando usuario y estudiante', error: error.message });
  }
});




router.post('/register-codigo', authMiddleware, async (req, res) => {
  const { codigo, whatsapp } = req.body;

  try {
    // 1. Validar entrada
    if (!codigo || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    if (codigo.length !== 10) {
      return res.status(400).json({ message: 'El código debe tener exactamente 10 dígitos' });
    }

    // 2. Consultar API externa UDH
    let data;
    try {
      const resUDH = await axios.get(
        `http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigo}`,
        { timeout: 7000 }
      );
      data = resUDH.data[0];
    } catch (error) {
      console.error('❌ Error conectando con API UDH:', error.message);
      return res.status(503).json({ message: 'Servidor UDH no disponible. Intenta más tarde.' });
    }

    if (!data) {
      return res.status(400).json({ message: 'Código inválido o no encontrado en UDH' });
    }

    // 🔴 Antes estaba aquí la validación del ciclo, ya no se usa
    // if (data.stu_ciclo < 7) { ... }

    // 3. Validar que el correo no exista
    const email = `${codigo}@udh.edu.pe`;
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // 4. Buscar facultad
    const facultad = await Facultades.findOne({
      where: { nombre_facultad: data.stu_facultad.trim() }
    });
    if (!facultad) {
      return res.status(400).json({ message: 'Facultad no encontrada' });
    }

    // 5. Buscar programa
    const programa = await ProgramasAcademicos.findOne({
      where: {
        nombre_programa: data.stu_programa.trim(),
        id_facultad: facultad.id_facultad
      }
    });
    if (!programa) {
      return res.status(400).json({ message: 'Programa académico no encontrado' });
    }

    // 6. Crear usuario
    const nuevoUsuario = await Usuario.create({
      email,
      dni: data.stu_dni,
      whatsapp,
      password: '', // Opcional
      rol_id: 3
    });

    // 7. Crear estudiante
    await Estudiantes.create({
      nombre_estudiante: `${data.stu_nombres} ${data.stu_apellido_paterno} ${data.stu_apellido_materno}`,
      dni: data.stu_dni,
      email,
      celular: whatsapp,
      facultad_id: facultad.id_facultad,
      programa_academico_id: programa.id_programa,
      id_usuario: nuevoUsuario.id_usuario,
      codigo: data.stu_codigo
    });

    res.status(201).json({ message: 'Estudiante registrado correctamente' });

  } catch (error) {
    console.error('❌ Error registrando estudiante:', error);
    res.status(500).json({ message: 'Error registrando estudiante', error: error.message });
  }
});





router.post('/register-docente-nuevo', authMiddleware, async (req, res) => {
  const { email, dni, whatsapp } = req.body;

  try {
    // Obtener el programa académico y facultad del usuario autenticado
    const { ProgramasAcademicos } = require('../models');
    const programa = await ProgramasAcademicos.findOne({
      where: { usuario_id: req.user.id }  // Usamos el id del usuario autenticado para obtener el programa académico
    });

    if (!programa) {
      return res.status(404).json({ message: 'No se encontró el programa académico para este usuario' });
    }

    // Verificar campos
    if (!email || !dni || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // Verificar si el email ya existe
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // Verificar si el DNI ya está registrado
    const existingDni = await Usuario.findOne({ where: { dni } });
    if (existingDni) {
      return res.status(409).json({ message: 'El DNI ya está registrado' });
    }

    // Buscar rol docente
    const rolDocente = await Roles.findOne({ where: { nombre_rol: 'docente supervisor' } });
    if (!rolDocente) {
      return res.status(500).json({ message: 'No se encontró el rol de docente' });
    }

    // Crear el usuario docente
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      password: '',  // Contraseña vacía
      rol_id: rolDocente.id_rol
    });

    if (!nuevoUsuario.id_usuario) {
      return res.status(500).json({ message: 'No se pudo obtener el id_usuario del docente' });
    }

    // Verificación explícita del id_usuario
    const idUsuario = nuevoUsuario.id_usuario;
    // Verificar que el id_usuario sea un valor válido antes de crear el docente
    if (!idUsuario || typeof idUsuario !== 'number') {
      return res.status(400).json({ message: 'id_usuario no válido' });
    }

    // Crear el docente y asociar el id_usuario del nuevoUsuario
    const nuevoDocente = await Docentes.create({
      id_usuario: idUsuario,  // Aseguramos que el id_usuario se pase correctamente
      nombre_docente: null,  // Lo puedes actualizar luego
      facultad_id: programa.id_facultad,
      programa_academico_id: programa.id_programa,
      email,
      dni,
      celular: whatsapp,
      firma_digital: ''
    });

    res.status(201).json({
      message: 'Docente registrado correctamente',
      email: nuevoUsuario.email,
      id_docente: nuevoDocente.id_docente,
    });

  } catch (error) {
    console.error('Error registrando docente:', error);
    res.status(500).json({ message: 'Error registrando docente', error: error.message });
  }
});


router.post('/crear-docente', authMiddleware, async (req, res) => {
  const { email, dni, whatsapp } = req.body;

  try {
    // Crear el usuario para el nuevo docente
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      password: '',  // Contraseña vacía
      rol_id: 2      // ID para rol de docente supervisor
    });

    // Verificar que el id_usuario fue creado correctamente
    if (!nuevoUsuario.id_usuario) {
      console.error('⚠️ Error: id_usuario no encontrado.');
      return res.status(500).json({ message: 'No se pudo obtener el id_usuario del docente' });
    }

    // Obtener el programa académico y la facultad del usuario autenticado
    const { ProgramasAcademicos, Facultades } = require('../models');
    const programa = await ProgramasAcademicos.findOne({
      where: { usuario_id: req.user.id }  // Usamos el id del usuario autenticado para obtener el programa académico
    });

    if (!programa) {
      console.error('⚠️ Error: No se encontró el programa académico para este usuario');
      return res.status(404).json({ message: 'No se encontró el programa académico para este usuario' });
    }
    const facultad = await Facultades.findOne({
      where: { id_facultad: programa.id_facultad }
    });

    if (!facultad) {
      console.error('⚠️ Error: No se encontró la facultad asociada al programa académico');
      return res.status(404).json({ message: 'No se encontró la facultad asociada al programa académico' });
    }
    const nuevoDocente = await Docentes.create({
      usuario_id: nuevoUsuario.id_usuario,  // Aseguramos que el id_usuario se pase correctamente
      facultad_id: programa.id_facultad,    // Asociamos la facultad del programa académico
      programa_academico_id: programa.id_programa, // Asociamos el programa académico
      email,
      dni,
      celular: whatsapp,
      firma_digital: ''  // Puedes actualizar este campo luego
    });

    res.status(201).json({
      message: 'Docente registrado correctamente',
      email: nuevoUsuario.email,
      id_docente: nuevoDocente.id_docente,
    });

  } catch (error) {
    console.error('❌ Error registrando docente:', error);
    res.status(500).json({ message: 'Error registrando docente', error: error.message });
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
      console.warn('🚫 [Google Login] Usuario no encontrado en la base de datos.');
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
    console.error('❌ [Google Login] Error autenticando con Google:', error);
    res.status(401).json({
      message: 'Token de Google inválido',
      error: error.message,
    });
  }
});

// Registro de docentes
router.post('/register-docente', async (req, res) => {
  const { email, dni, whatsapp } = req.body;

  try {
    // Verificar que todos los campos estén presentes
    if (!email || !dni || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // Verificar si el email ya está registrado
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // Asignar rol 2 (Docente)
    const rolDocente = await Roles.findOne({ where: { nombre_rol: 'docente supervisor' } });

    if (!rolDocente) {
      return res.status(500).json({ message: 'No se encontró el rol de docente' });
    }

    // Crear el usuario con rol_id 2 (Docente)
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      password: '', // vacío si no se usa en este flujo
      rol_id: rolDocente.id_rol // Asignamos el rol de docente
    });

    // Responder con éxito
    res.status(201).json({
      message: 'Docente registrado correctamente',
      id_usuario: nuevoUsuario.id_usuario,
      email: nuevoUsuario.email
    });

  } catch (error) {
    console.error('Error registrando docente:', error);
    res.status(500).json({ message: 'Error registrando docente', error: error.message });
  }
});

router.post('/registrar-docente-completo', async (req, res) => {
  const { email, dni, whatsapp, facultad_id, programa_academico_id } = req.body;

  try {
    if (!email || !whatsapp || !facultad_id || !programa_academico_id) {
        return res.status(400).json({ message: 'Faltan campos requeridos' });
      }
    // Verificar si el email ya está registrado
    const existente = await Usuario.findOne({ where: { email } });
    if (existente) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // Buscar el rol de docente supervisor
    const rolDocente = await Roles.findOne({ where: { nombre_rol: 'docente supervisor' } });
    if (!rolDocente) {
      return res.status(500).json({ message: 'No se encontró el rol de docente' });
    }

    // Crear usuario
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      rol_id: rolDocente.id_rol,
      password: '',
      primera_vez: true
    });

    // Crear docente
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

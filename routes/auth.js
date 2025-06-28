const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/database').sequelize;
const { ProgramasAcademicos, Estudiantes, Facultades, Usuario, Docentes, Roles } = require('../models');
const { Op } = require('sequelize'); 
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware'); 
const verificarRol = require('../middlewares/verificarRol');  
const axios = require('axios');

router.post('/register', async (req, res) => {
  const { codigo, dni, whatsapp } = req.body;

  try {
    if (!codigo || !dni || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // 1. Consultar la API externa para obtener los datos del estudiante
    const resUDH = await axios.get(`http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigo}`);
    const data = resUDH.data[0];

    if (!data) {
      return res.status(400).json({ message: 'Código inválido o no encontrado' });
    }

    // 2. Verificar si el estudiante está en el ciclo 7 o superior
    if (data.stu_ciclo < 7) {
      return res.status(400).json({ message: 'Solo pueden registrarse estudiantes del ciclo 7 o superior' });
    }

    // 3. Verificar si el correo ya está registrado
    const existingUser = await Usuario.findOne({ where: { email: `${codigo}@udh.edu.pe` } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // 4. Obtener el ID de la facultad por nombre
    const facultad = await Facultades.findOne({
      where: { nombre_facultad: data.stu_facultad.trim() } // Comparando el nombre de la facultad
    });

    if (!facultad) {
      return res.status(400).json({ message: 'Facultad no encontrada' });
    }

    // 5. Obtener el ID del programa académico por nombre
    const programa = await ProgramasAcademicos.findOne({
      where: { nombre_programa: data.stu_programa.trim(), id_facultad: facultad.id_facultad } // Comparando el nombre del programa y facultad
    });

    if (!programa) {
      return res.status(400).json({ message: 'Programa académico no encontrado' });
    }

    // 6. Crear el usuario en la tabla Usuario
    const nuevoUsuario = await Usuario.create({
      email: `${codigo}@udh.edu.pe`,
      dni,
      whatsapp,
      password: '', // Vacío si no se usa
      rol_id: 3 // Asignando rol por defecto (ajustar según sea necesario)
    });

    // 7. Crear el registro en la tabla Estudiantes
    await Estudiantes.create({
      nombre_estudiante: `${data.stu_nombres} ${data.stu_apellido_paterno} ${data.stu_apellido_materno}`,
      dni,
      email: `${codigo}@udh.edu.pe`,
      celular: whatsapp,
      facultad_id: facultad.id_facultad,  // Asignando el ID de la facultad
      programa_academico_id: programa.id_programa,  // Asignando el ID del programa académico
      id_usuario: nuevoUsuario.id_usuario,
      codigo: data.stu_codigo
    });

    res.status(201).json({ message: 'Usuario y estudiante registrados correctamente' });

  } catch (error) {
    console.error('Error registrando usuario y estudiante:', error);
    res.status(500).json({ message: 'Error registrando usuario y estudiante', error: error.message });
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

    if (usuario.rol_id === 4) { // Si es responsable académico
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






module.exports = router;

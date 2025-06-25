const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/database').sequelize;
const { ProgramasAcademicos, Facultades, Usuario, Docentes, Roles } = require('../models');
const { Op } = require('sequelize'); // Asegúrate de importar esto para las consultas de Sequelize
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');  // Middleware de autenticación
const verificarRol = require('../middlewares/verificarRol');  // Middleware de verificación de rol

// Registro de usuarios
router.post('/register', async (req, res) => {
  console.log('🔍 Datos recibidos en /register:', req.body);
  const { email, dni, whatsapp } = req.body;

  try {
    if (!email || !dni || !whatsapp) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // Verificar si el email ya está registrado
    const existingUser = await Usuario.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    // Asignar rol por defecto si existe "transportista"
    const rolAlumno = await Roles.findOne({ where: { nombre_rol: 'alumno' } });
      if (!rolAlumno) {
        return res.status(500).json({ message: 'No se encontró el rol de alumno' });
      }

    // Crear el usuario
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      password: '', // vacío si no se usa en este flujo
      rol_id: rolAlumno.id_rol
    });

    res.status(201).json({
      message: 'Usuario registrado correctamente',
      id_usuario: nuevoUsuario.id_usuario,
      email: nuevoUsuario.email
    });

  } catch (error) {
    console.error('Error registrando usuario:', error);
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
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

    console.log('Nuevo Usuario:', nuevoUsuario);  // Verifica que id_usuario esté presente

    if (!nuevoUsuario.id_usuario) {
      return res.status(500).json({ message: 'No se pudo obtener el id_usuario del docente' });
    }

    // Verificación explícita del id_usuario
    const idUsuario = nuevoUsuario.id_usuario;
    console.log('ID Usuario:', idUsuario);  // Verifica que id_usuario no sea null o undefined

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

    console.log('Docente creado con id_docente:', nuevoDocente.id_docente);

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

  console.log('🔍 Datos recibidos:', req.body);

  try {
    // Crear el usuario para el nuevo docente
    console.log('🔨 Creando usuario...');
    const nuevoUsuario = await Usuario.create({
      email,
      dni,
      whatsapp,
      password: '',  // Contraseña vacía
      rol_id: 2      // ID para rol de docente supervisor
    });

    console.log('Nuevo Usuario creado:', nuevoUsuario);

    // Verificar que el id_usuario fue creado correctamente
    if (!nuevoUsuario.id_usuario) {
      console.error('⚠️ Error: id_usuario no encontrado.');
      return res.status(500).json({ message: 'No se pudo obtener el id_usuario del docente' });
    }

    console.log('✅ id_usuario obtenido:', nuevoUsuario.id_usuario);

    // Obtener el programa académico y la facultad del usuario autenticado
    const { ProgramasAcademicos, Facultades } = require('../models');
    console.log('🔍 Buscando programa académico asociado al usuario autenticado...');
    const programa = await ProgramasAcademicos.findOne({
      where: { usuario_id: req.user.id }  // Usamos el id del usuario autenticado para obtener el programa académico
    });

    if (!programa) {
      console.error('⚠️ Error: No se encontró el programa académico para este usuario');
      return res.status(404).json({ message: 'No se encontró el programa académico para este usuario' });
    }

    console.log('✅ Programa académico encontrado:', programa);

    console.log('🔍 Buscando facultad asociada al programa académico...');
    const facultad = await Facultades.findOne({
      where: { id_facultad: programa.id_facultad }
    });

    if (!facultad) {
      console.error('⚠️ Error: No se encontró la facultad asociada al programa académico');
      return res.status(404).json({ message: 'No se encontró la facultad asociada al programa académico' });
    }

    console.log('✅ Facultad encontrada:', facultad);

    // Crear el docente asociado al id_usuario y al programa académico
    console.log('🔨 Creando docente...');
    const nuevoDocente = await Docentes.create({
      usuario_id: nuevoUsuario.id_usuario,  // Aseguramos que el id_usuario se pase correctamente
      facultad_id: programa.id_facultad,    // Asociamos la facultad del programa académico
      programa_academico_id: programa.id_programa, // Asociamos el programa académico
      email,
      dni,
      celular: whatsapp,
      firma_digital: ''  // Puedes actualizar este campo luego
    });

    console.log('Docente creado con id_docente:', nuevoDocente.id_docente);

    // Devolver la respuesta con el nuevo docente creado
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



// Login de usuarios
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Incluye el modelo Roles para obtener el nombre del rol
    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Roles, as: 'rol' }]
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(password, usuario.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    // Incluye el nombre del rol en el token
    const token = jwt.sign(
      {
        id: usuario.id_usuario,
        rol: usuario.rol.nombre_rol // 👈 aquí va el nombre del rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('🔐 Usuario logueado:', usuario.email);
    console.log('📦 Token generado:', token);

    // Devolver el token, el nombre del rol, y el id_usuario
    res.json({
      token,
      rol: usuario.rol.nombre_rol, // 👈 ahora es el nombre del rol
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ message: 'Error en el login' });
  }
});

// Ruta para solicitar el restablecimiento de contraseña
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    const usuario = await Usuario.findOne({ where: { email } });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Generar un token de restablecimiento
    const token = crypto.randomBytes(20).toString('hex');
    const tokenExpiration = Date.now() + 3600000; // El token expira en 1 hora

    // Guardar el token y su vencimiento en la base de datos del usuario
    usuario.reset_password_token = token;
    usuario.reset_password_expires = tokenExpiration;
    await usuario.save();

    // Configurar el transporte de nodemailer para enviar el correo
    const transporter = nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',  // Host de Mailtrap
      port: 2525,  // Puerto de Mailtrap
      auth: {
        user: process.env.EMAIL_USER,  // Define en tu archivo .env el correo que usas
        pass: process.env.EMAIL_PASS,  // Define en tu archivo .env la contraseña del correo
      },
    });

    const mailOptions = {
      to: usuario.email,
      from: process.env.EMAIL_USER,
      subject: 'Restablecimiento de Contraseña',
      text: `Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para restablecerla: 
      http://localhost:3000/reset-password/${token}
      Si no solicitaste esto, ignora este correo.`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Se ha enviado un correo para restablecer la contraseña.' });

  } catch (error) {
    // Mostrar más detalles del error
    console.error('Error al enviar el correo:', error);
    res.status(500).json({ message: 'Error al enviar el correo', error: error.message });
  }
});

// Ruta para restablecer la contraseña
router.post('/reset-password/:token', async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  try {
    const usuario = await Usuario.findOne({
      where: {
        reset_password_token: token,
        reset_password_expires: { [Op.gt]: Date.now() }, // Verifica si el token no ha expirado
      },
    });

    if (!usuario) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Encriptar la nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Actualizar la contraseña y borrar el token
    usuario.password = hashedPassword;
    usuario.reset_password_token = null;
    usuario.reset_password_expires = null;
    await usuario.save();

    res.status(200).json({ message: 'Contraseña restablecida correctamente' });

  } catch (error) {
    res.status(500).json({ message: 'Error al restablecer la contraseña' });
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
        console.log('📚 [Google Login] Programa académico:', programa_academico_id);
        console.log('🏛️ [Google Login] Facultad:', facultad_id);
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

    console.log('🔐 [Google Login] Usuario autenticado. Rol:', usuario.Role.nombre_rol);

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

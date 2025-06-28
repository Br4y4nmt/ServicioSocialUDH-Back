const express = require('express');
const router = express.Router();
const Estudiantes = require('../models/Estudiantes');
const ProgramasAcademicos = require('../models/ProgramasAcademicos');
const Usuario = require('../models/Usuario');
const Facultades = require('../models/Facultades');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const axios = require('axios'); // Asegúrate de que esta línea esté presente

router.get('/perfil-estudiante/:correo', async (req, res) => {
  const { correo } = req.params;
  const codigoDesdeCorreo = correo.split('@')[0]; // Extraemos el código del correo

  try {
    // Hacer la solicitud HTTP a la API externa de UDH
    const response = await axios.get(`http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigoDesdeCorreo}`);

    const data = response.data[0];

    const nombre_completo = `${data.stu_nombres || ''} ${data.stu_apellido_paterno || ''} ${data.stu_apellido_materno || ''}`.trim();

    // Retornar los datos al frontend
    res.json({
      nombre_completo,
      dni: data.stu_dni || '',
      codigo: data.stu_codigo || '',
      facultad: data.stu_facultad || '',
      programa: data.stu_programa || '',
      correo,
    });
  } catch (error) {
    console.error('Error al obtener los datos del estudiante:', error);
    res.status(500).json({ message: 'Error al obtener los datos del estudiante' });
  }
});
router.get('/usuario/:id_usuario',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    const { id_usuario } = req.params;
    try {
      const estudiante = await Estudiantes.findOne({
        where: { id_usuario },
        include: [
          {
            model: ProgramasAcademicos,
            as: 'programa',
            attributes: ['nombre_programa']
          },
          {
            model: Facultades,
            as: 'facultad',
            attributes: ['nombre_facultad']
          }
        ]
      });

      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      res.status(200).json(estudiante);
    } catch (error) {
      console.error('Error al obtener estudiante:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });


router.post('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'alumno'),
  async (req, res) => {
    try {
      const { nombre_estudiante, dni, email, facultad, programa_academico_id, celular, id_usuario, codigo  } = req.body;
  
      if (!nombre_estudiante || !dni || !email || !facultad || !programa_academico_id || !celular || !id_usuario || !codigo) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
      }
  
      const nuevoEstudiante = await Estudiantes.create({
        nombre_estudiante,
        dni,
        email,
        codigo, // ✅ aquí el nuevo campo
        facultad_id: facultad,
        programa_academico_id,
        celular,
        id_usuario,
      });
  
      // 🔄 ACTUALIZAR el campo primera_vez a false
      const usuario = await Usuario.findByPk(id_usuario);
      if (usuario && usuario.primera_vez === true) {
        usuario.primera_vez = false;
        await usuario.save({ fields: ['primera_vez'] });
      }
  
      res.status(201).json({ message: 'Estudiante registrado exitosamente', nuevoEstudiante });
    } catch (error) {
      console.error('Error al registrar estudiante:', error);
      res.status(500).json({ message: 'Error al registrar estudiante', error });
    }
  });

// Obtener todos los estudiantes
router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const estudiantes = await Estudiantes.findAll({
      include: {
        model: ProgramasAcademicos,
        attributes: ['nombre_programa'],
      }
    });
    res.status(200).json(estudiantes);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes', error });
  }
});
// Obtener estudiante por ID
router.get('/:id_estudiante',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const estudiante = await Estudiantes.findByPk(req.params.id_estudiante, {
      include: {
        model: ProgramasAcademicos,
        attributes: ['nombre_programa'],
      }
    });

    if (estudiante) {
      res.status(200).json(estudiante);
    } else {
      res.status(404).json({ message: 'Estudiante no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante', error });
  }
});

// Actualizar estudiante
router.put('/:id_estudiante',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const estudiante = await Estudiantes.findByPk(req.params.id_estudiante);
    if (estudiante) {
      const { nombre_estudiante, programa_academico_id } = req.body;
      await estudiante.update({ nombre_estudiante, programa_academico_id });
      res.status(200).json(estudiante);
    } else {
      res.status(404).json({ message: 'Estudiante no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar estudiante:', error);
    res.status(500).json({ message: 'Error al actualizar estudiante', error });
  }
});

// Eliminar estudiante
router.delete('/:id_estudiante',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const estudiante = await Estudiantes.findByPk(req.params.id_estudiante);
    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    await estudiante.destroy();
    res.status(200).json({ message: 'Estudiante eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar estudiante:', error);
    res.status(500).json({ message: 'Error al eliminar estudiante', error });
  }
});

// Obtener id_estudiante desde id_usuario
router.get('/usuario/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const estudiante = await Estudiantes.findOne({
      where: { id_usuario: usuario_id },
    });

    if (!estudiante) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    res.status(200).json({ id_estudiante: estudiante.id_estudiante });
  } catch (error) {
    console.error('Error al buscar estudiante:', error);
    res.status(500).json({ message: 'Error al obtener estudiante' });
  }
});

// Obtener estudiantes de un programa académico específico
router.get('/programa/:programa_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor'),
  async (req, res) => {
  try {
    const estudiantes = await Estudiantes.findAll({
      where: { programa_academico_id: req.params.programa_id },
      include: {
        model: ProgramasAcademicos,
        attributes: ['nombre_programa'],
      }
    });

    if (estudiantes.length > 0) {
      res.status(200).json(estudiantes);
    } else {
      res.status(404).json({ message: 'No se encontraron estudiantes para este programa académico.' });
    }
  } catch (error) {
    console.error('Error al obtener estudiantes del programa:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes del programa', error });
  }
});
// Obtener estudiante completo por id_usuario
router.get('/datos/usuario/:usuario_id',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
    try {
      const estudiante = await Estudiantes.findOne({
        where: { id_usuario: req.params.usuario_id },
        include: [
          {
            model: ProgramasAcademicos,
            as: 'programa', // ← alias correcto
            attributes: ['nombre_programa']
          },
          {
            model: Facultades,
            as: 'facultad', // ← alias correcto
            attributes: ['nombre_facultad']
          }
        ]
      });

      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      res.status(200).json(estudiante);
    } catch (error) {
      console.error('Error al obtener datos del estudiante:', error);
      res.status(500).json({ message: 'Error al obtener datos del estudiante', error });
    }
});
router.put('/actualizar-celular-perfil/:usuario_id',
  authMiddleware,
  verificarRol('alumno', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const { usuario_id } = req.params;
      const { celular } = req.body;

      const estudiante = await Estudiantes.findOne({ where: { id_usuario: usuario_id } });

      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      await estudiante.update({ celular });

      res.status(200).json({ message: 'Celular actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar celular:', error);
      res.status(500).json({ message: 'Error al actualizar celular', error });
    }
  });

router.put('/actualizar-celular/:usuario_id',
  authMiddleware,
  verificarRol('alumno', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const { usuario_id } = req.params;
      const { celular } = req.body;

      const estudiante = await Estudiantes.findOne({ where: { id_usuario: usuario_id } });

      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      await estudiante.update({ celular });

      // 🔁 Actualizar primera_vez en tabla usuarios
      const usuario = await Usuario.findByPk(usuario_id);
      if (usuario && usuario.primera_vez === true) {
        usuario.primera_vez = false;
        await usuario.save({ fields: ['primera_vez'] });
      }

      res.status(200).json({ message: 'Celular actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar celular:', error);
      res.status(500).json({ message: 'Error al actualizar celular', error });
    }
  }
);
module.exports = router;

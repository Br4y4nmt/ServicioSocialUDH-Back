const express = require('express');
const router = express.Router();
const Estudiantes = require('../models/Estudiantes');
const ProgramasAcademicos = require('../models/ProgramasAcademicos');
const Usuario = require('../models/Usuario');
const Facultades = require('../models/Facultades');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const IntegranteGrupo = require('../models/IntegranteGrupo');


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
        codigo, 
        facultad_id: facultad,
        programa_academico_id,
        celular,
        id_usuario,
      });

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
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const estudiantes = await Estudiantes.findAll({
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

      res.status(200).json(estudiantes);
    } catch (error) {
      console.error('Error al obtener estudiantes:', error.message);
      console.error(error);
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
      const { celular, sede, modalidad } = req.body;

      const estudiante = await Estudiantes.findOne({ where: { id_usuario: usuario_id } });

      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }

      if (sede && !['HUÁNUCO', 'LEONCIO PRADO'].includes(sede)) {
        return res.status(400).json({ message: 'Sede inválida' });
      }

      if (modalidad && !['PRESENCIAL', 'SEMI-PRESENCIAL'].includes(modalidad)) {
        return res.status(400).json({ message: 'Modalidad inválida' });
      }
      const camposActualizados = {};
      if (celular) camposActualizados.celular = celular;
      if (sede !== undefined) camposActualizados.sede = sede;
      if (modalidad !== undefined) camposActualizados.modalidad = modalidad.toUpperCase();

      await estudiante.update(camposActualizados);
      const usuario = await Usuario.findByPk(usuario_id);
      if (usuario && usuario.primera_vez === true) {
        usuario.primera_vez = false;
        await usuario.save({ fields: ['primera_vez'] });
      }

      res.status(200).json({ message: 'Datos actualizados correctamente' });

    } catch (error) {
      console.error('Error al actualizar datos:', error);
      res.status(500).json({ message: 'Error al actualizar datos', error });
    }
  }
);

router.patch(
  '/:id_estudiante/estado',
  authMiddleware,
  verificarRol('gestor-udh'), 
  async (req, res) => {
    try {
      const { id_estudiante, id_integrante, estado } = req.body;

      const estadosValidos = ['ATENDIDO', 'NO_ATENDIDO'];
      const estadoFinal = String(estado || '').toUpperCase().trim();

      if (!estadosValidos.includes(estadoFinal)) {
        return res.status(400).json({ message: 'Estado inválido. Use: ATENDIDO o NO_ATENDIDO' });
      }

      if (id_integrante) {
        const integrante = await IntegranteGrupo.findByPk(id_integrante);
        if (!integrante) return res.status(404).json({ message: 'Integrante no encontrado' });

        await integrante.update({ estado: estadoFinal });

        return res.status(200).json({
          message: 'Estado del integrante actualizado correctamente',
          integrante: {
            id_integrante: integrante.id_integrante,
            trabajo_social_id: integrante.trabajo_social_id,
            correo_institucional: integrante.correo_institucional,
            estado: integrante.estado
          }
        });
      }

      if (id_estudiante) {
        const estudiante = await Estudiantes.findByPk(id_estudiante);
        if (!estudiante) return res.status(404).json({ message: 'Estudiante no encontrado' });

        await estudiante.update({ estado: estadoFinal });

        return res.status(200).json({
          message: 'Estado del estudiante actualizado correctamente',
          estudiante: {
            id_estudiante: estudiante.id_estudiante,
            estado: estudiante.estado
          }
        });
      }

      return res.status(400).json({
        message: 'Debe enviar id_estudiante o id_integrante'
      });

    } catch (error) {
      console.error('Error al cambiar estado:', error);
      return res.status(500).json({
        message: 'Error interno al cambiar estado',
        error: error.message
      });
    }
  }
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { IntegranteGrupo, TrabajoSocialSeleccionado, Usuario} = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const { getDatosAcademicosUDH } = require('../services/udhService');
router.post('/',
  authMiddleware,
  verificarRol('alumno', 'gestor-udh'),
  async (req, res) => {
  try {
    const { trabajo_social_id, correos } = req.body;

    if (!trabajo_social_id || !Array.isArray(correos)) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    const registros = await Promise.all(
      correos.map(correo => 
        IntegranteGrupo.create({
          trabajo_social_id,
          correo_institucional: correo.trim().toLowerCase()
        })
      )
    );

    res.status(201).json({ message: 'Integrantes registrados', registros });
  } catch (error) {
    console.error('Error al registrar integrantes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});
// Obtener los integrantes por ID del trabajo social
router.get('/:trabajo_social_id',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const { trabajo_social_id } = req.params;

    if (!trabajo_social_id) {
      return res.status(400).json({ message: 'Falta el ID del trabajo social' });
    }

    const integrantes = await IntegranteGrupo.findAll({
      where: { trabajo_social_id },
      attributes: ['correo_institucional'], // solo devolver el correo
    });

    res.status(200).json(integrantes);
  } catch (error) {
    console.error('Error al obtener integrantes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});
router.get('/estudiante/actual',
  authMiddleware,
  verificarRol('alumno', 'docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
  try {
    const usuario_id = req.query.usuario_id;

    if (!usuario_id) {
      return res.status(400).json({ message: 'Falta el ID del usuario' });
    }

    // Buscar el trabajo social actual del estudiante
    const trabajo = await TrabajoSocialSeleccionado.findOne({
      where: { usuario_id },
    });

    if (!trabajo) {
      return res.status(404).json({ message: 'Trabajo social no encontrado para este estudiante' });
    }

    // Buscar los integrantes del grupo usando ese ID
    const integrantes = await IntegranteGrupo.findAll({
      where: { trabajo_social_id: trabajo.id },
      attributes: ['correo_institucional'],
    });

    res.status(200).json(integrantes);
  } catch (error) {
    console.error('Error al obtener integrantes del estudiante:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


router.get('/:trabajo_social_id/enriquecido',
  authMiddleware,
  verificarRol('docente supervisor', 'gestor-udh', 'programa-academico'),
  async (req, res) => {
    try {
      const { trabajo_social_id } = req.params;

      // 1. Buscar el trabajo social
      const trabajo = await TrabajoSocialSeleccionado.findOne({
        where: { id: trabajo_social_id }
      });

      if (!trabajo) {
        return res.status(404).json({ message: 'Trabajo social no encontrado' });
      }

      // 2. Si es individual, buscar correo del usuario
      if (trabajo.tipo_servicio_social === 'individual') {
        const usuario = await Usuario.findOne({
          where: { id: trabajo.usuario_id }
        });

        if (!usuario || !usuario.correo_institucional) {
          return res.status(404).json({ message: 'Usuario no tiene correo institucional' });
        }

        const codigo = usuario.correo_institucional.split('@')[0];
        const datos = await getDatosAcademicosUDH(codigo);

        return res.json([{
          usuario_id: usuario.id,
          correo_institucional: usuario.correo_institucional,
          codigo_universitario: codigo,
          ...datos
        }]);
      }

      // 3. Si es grupal, obtener los correos de integrantes
      const integrantes = await IntegranteGrupo.findAll({
        where: { trabajo_social_id },
        attributes: ['correo_institucional']
      });

      if (!integrantes.length) {
        return res.status(404).json({ message: 'No hay integrantes registrados' });
      }

      const resultados = await Promise.all(
        integrantes.map(async (i) => {
          const correo = i.correo_institucional;
          const codigo = correo.split('@')[0];
          const datos = await getDatosAcademicosUDH(codigo);

          return {
            correo_institucional: correo,
            codigo_universitario: codigo,
            ...datos
          };
        })
      );

      res.json(resultados.filter(r => r !== null));
    } catch (error) {
      console.error('❌ Error en enriquecido:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  }
);

module.exports = router;

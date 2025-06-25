const express = require('express');
const router = express.Router();
const Facultades = require('../models/Facultades');
const Usuarios = require('../models/Usuario');
const ProgramasAcademicos = require('../models/ProgramasAcademicos');  // Importa el modelo de Programas Académicos
const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
// Crear un programa académico
router.post('/',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  const { nombre_programa, id_facultad, email, whatsapp } = req.body;

  try {
    // ✅ Asegurarse que el dni no sea cadena vacía (por si más adelante quieres usarlo)
    const dni = req.body.dni && req.body.dni.trim() !== '' ? req.body.dni.trim() : null;

    // 1. Crear primero el usuario
    const nuevoUsuario = await Usuarios.create({
      email,
      whatsapp,
      rol_id: 4,         // Rol fijo para programa académico
      dni,               // Puede ser null
      primera_vez: true
    });

    // 2. Luego crear el programa académico con el ID del usuario recién creado
    const nuevoPrograma = await ProgramasAcademicos.create({
      nombre_programa,
      id_facultad,
      email,
      usuario_id: nuevoUsuario.id_usuario
    });

    res.status(201).json({
      message: 'Programa y usuario creados exitosamente',
      programa: nuevoPrograma,
      usuario: nuevoUsuario
    });

  }catch (error) {
  console.error('Error al crear registros:', error);

  if (error.name === 'SequelizeUniqueConstraintError') {
    // extrae qué campo falló
    const campoDuplicado = error?.errors[0]?.path;
    const valor = error?.errors[0]?.value;

    return res.status(400).json({
      message: `El valor '${valor}' ya está registrado en el campo '${campoDuplicado}'`
    });
  }

  res.status(500).json({ message: 'Error en la creación de registros', error });
}
});


router.get('/',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
    try {
      const programas = await ProgramasAcademicos.findAll({
        include: {
          model: Facultades, // ✅ Sin alias
          attributes: ['id_facultad', 'nombre_facultad']
        }
      });
      res.status(200).json(programas);
    } catch (error) {
      console.error('Error al obtener programas académicos:', error);
      res.status(500).json({ message: 'Error al obtener programas académicos', error });
    }
  });

// Obtener un programa académico por ID
router.get('/:id_programa',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor'),
  async (req, res) => {
  try {
    const programa = await ProgramasAcademicos.findByPk(req.params.id_programa);
    if (programa) {
      res.status(200).json(programa);
    } else {
      res.status(404).json({ message: 'Programa académico no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener programa académico:', error);
    res.status(500).json({ message: 'Error al obtener programa académico', error });
  }
});

// Actualizar un programa académico
router.put('/:id_programa',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const programa = await ProgramasAcademicos.findByPk(req.params.id_programa);
    if (programa) {
      const { nombre_programa, id_facultad, email } = req.body;
      await programa.update({ nombre_programa, id_facultad, email });
      res.status(200).json(programa);
    } else {
      res.status(404).json({ message: 'Programa académico no encontrado' });
    }
  } catch (error) {
    console.error('Error al actualizar programa académico:', error);
    res.status(500).json({ message: 'Error al actualizar programa académico', error });
  }
});

// Eliminar un programa académico
router.delete('/:id_programa',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
  try {
    const { id_programa } = req.params;

    const programa = await ProgramasAcademicos.findByPk(id_programa);
    if (!programa) {
      return res.status(404).json({ message: 'Programa académico no encontrado' });
    }

    await programa.destroy();

    res.status(200).json({ message: 'Programa académico eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar programa académico:', error);
    res.status(500).json({ message: 'Error al eliminar programa académico', error });
  }
});
// Obtener programas académicos por facultad
router.get('/facultad/:id_facultad',
  authMiddleware,
  verificarRol('gestor-udh', 'programa-academico', 'docente supervisor', 'alumno'),
  async (req, res) => {
    try {
      const { id_facultad } = req.params;
      const programas = await ProgramasAcademicos.findAll({
        where: { id_facultad }
      });
  
      res.status(200).json(programas);
    } catch (error) {
      console.error('Error al obtener programas por facultad:', error);
      res.status(500).json({ message: 'Error al obtener programas por facultad', error });
    }
  });

module.exports = router;

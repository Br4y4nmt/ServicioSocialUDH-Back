const express = require('express');
const multer = require('multer');
const path = require('path');
const { Validacion, TrabajoComunitario, Usuario } = require('../models'); // Modelos de Sequelize
const router = express.Router();

// Configuración de Multer para guardar las imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // La carpeta donde se almacenarán las imágenes
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Nombre único para cada archivo
  }
});

const upload = multer({ storage: storage });

// Ruta para guardar la validación
router.post('/guardar', upload.single('imagen'), async (req, res) => {
  try {
    console.log('Archivo recibido:', req.file);
    console.log('Datos del cuerpo:', req.body);

    if (!req.file) {
      return res.status(400).json({ message: 'La imagen es obligatoria' });
    }

    // ✨ Nuevo: Capturamos también los nuevos campos
    const {
      id_trabajo,
      comentarios,
      estado_validacion,
      observaciones_rechazo,
      usuario_validacion,            // id del usuario (número)
      nombre_completo_validacion,     // 👈 nuevo campo
      fecha_ejecucion,
      horas_dedicadas,
      ubicacion_exacta
    } = req.body;

    const ruta_imagen = req.file.path;
    const imagen = req.file.filename;
    const fecha_validacion = new Date(); // Fecha actual automática

    console.log('Datos procesados:', {
      id_trabajo,
      imagen,
      ruta_imagen,
      fecha_validacion,
      comentarios,
      usuario_validacion,
      estado_validacion,
      observaciones_rechazo,
      fecha_ejecucion,        // ✅ Mostrar en logs
      horas_dedicadas,        // ✅ Mostrar en logs
      ubicacion_exacta        // ✅ Mostrar en logs
    });

    // Verificamos que el trabajo comunitario exista
    const trabajoComunitario = await TrabajoComunitario.findByPk(id_trabajo);
    if (!trabajoComunitario) {
      return res.status(404).json({ message: 'Trabajo comunitario no encontrado' });
    }

    // ✨ Creamos la validación incluyendo los nuevos campos
    const nuevaValidacion = await Validacion.create({
      id_trabajo,
      imagen,
      ruta_imagen,
      fecha_validacion,
      comentarios,
      usuario_validacion,
      nombre_completo_validacion, // 👈 agregar aquí
      estado_validacion,
      observaciones_rechazo: observaciones_rechazo || null,
      fecha_ejecucion,
      horas_dedicadas,
      ubicacion_exacta
    });

    res.status(201).json({ message: 'Validación guardada correctamente', data: nuevaValidacion });
  } catch (error) {
    console.error('Error al guardar la validación:', error);
    res.status(500).json({ message: 'Error al guardar la validación' });
  }
});
  // Ruta para obtener las validaciones asociadas a un trabajo comunitario
  router.get('/:id_trabajo', async (req, res) => {
    try {
      const { id_trabajo } = req.params; // Aquí obtenemos el parámetro correctamente como id_trabajo
      const validaciones = await Validacion.findAll({
        where: { id_trabajo }, // Asegúrate de que este campo se llame id_trabajo en la base de datos
      });
  
      if (!validaciones || validaciones.length === 0) {
        return res.status(404).json({ message: 'No se encontraron validaciones para este trabajo' });
      }
  
      res.json(validaciones);
    } catch (error) {
      console.error('Error al obtener las validaciones:', error);
      res.status(500).json({ message: 'Error al obtener las validaciones' });
    }
  });

// Actualizar una validación (solo observaciones o más si quieres)
router.put('/:id_validacion', async (req, res) => {
  try {
    const { id_validacion } = req.params;
    const { observaciones_rechazo } = req.body;

    const validacion = await Validacion.findByPk(id_validacion);
    if (!validacion) {
      return res.status(404).json({ message: 'Validación no encontrada' });
    }

    validacion.observaciones_rechazo = observaciones_rechazo;
    await validacion.save();

    res.json({ message: 'Observación actualizada correctamente', validacion });
  } catch (error) {
    console.error('Error al actualizar observación:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
module.exports = router;

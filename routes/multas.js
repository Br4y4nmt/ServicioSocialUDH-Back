const express = require('express');
const router = express.Router();
const Multa = require('../models/Multa');
const Usuario = require('../models/Usuario');

// Ruta para buscar multas por número de placa
router.get('/placa/:placa', async (req, res) => {
  try {
    const { placa } = req.params;

    // Buscar multas por placa y hacer el JOIN con el modelo Usuario
    const multas = await Multa.findAll({
      where: { placa },
      include: [
        {
          model: Usuario, // Asocia la tabla de usuarios
          as: 'usuario',  // Usa el alias 'usuario' que definimos en el modelo de Multa
          attributes: ['nombre', 'apellido'], // Solo devuelve el nombre y apellido del usuario
        },
      ],
    });

    if (multas.length > 0) {
      res.json(multas);
    } else {
      res.status(404).json({ message: 'No se encontraron multas para la placa proporcionada.' });
    }
  } catch (error) {
    console.error('Error al buscar multas:', error);
    res.status(500).json({ message: 'Error al buscar multas' });
  }
});

// Ruta para registrar una nueva multa
router.post('/', async (req, res) => {
  console.log('Datos recibidos:', req.body);
  try {
    const { numero_pit, placa, infraccion, calificacion, monto, estado, fecha_vencimiento, usuario_id } = req.body;

    // Crear nueva multa
    const nuevaMulta = await Multa.create({
      numero_pit,
      placa,
      tipo_infraccion: infraccion,  // Asegúrate de usar 'infraccion' como 'tipo_infraccion'
      calificacion,
      monto,
      estado,
      fecha_registro: new Date(),
      fecha_vencimiento,
      usuario_id,
    });

    res.status(201).json(nuevaMulta);
  } catch (error) {
    console.error('Error al registrar la multa:', error);
    res.status(500).json({ message: 'Error al registrar la multa' });
  }
});

// Ruta para obtener todas las multas
router.get('/', async (req, res) => {
  try {
    const multas = await Multa.findAll(); // Obtiene todas las multas de la base de datos
    res.json(multas); // Envía las multas como respuesta
  } catch (error) {
    console.error('Error al obtener las multas:', error);
    res.status(500).json({ message: 'Error al obtener las multas' });
  }
});

// Ruta para buscar multas por número de PIT
router.get('/pit/:pit', async (req, res) => {
  try {
    const { pit } = req.params;

    // Buscar multas por número de PIT y hacer el JOIN con el modelo Usuario
    const multas = await Multa.findAll({
      where: { numero_pit: pit },
      include: [
        {
          model: Usuario, // Asocia la tabla de usuarios
          as: 'usuario',  // Usa el alias 'usuario' que definimos en el modelo de Multa
          attributes: ['nombre', 'apellido'], // Solo devuelve el nombre y apellido del usuario
        },
      ],
    });

    if (multas.length > 0) {
      res.json(multas);
    } else {
      res.status(404).json({ message: 'No se encontraron multas para el número de PIT proporcionado.' });
    }
  } catch (error) {
    console.error('Error al buscar multas por PIT:', error);
    res.status(500).json({ message: 'Error al buscar multas por PIT' });
  }
});

// Ruta para obtener una multa específica por id_multa
router.get('/:id_multa', async (req, res) => {
  const { id_multa } = req.params;

  try {
    const multa = await Multa.findByPk(id_multa, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['nombre', 'apellido'], // Devuelve solo nombre y apellido del usuario
        },
      ],
    });

    if (!multa) {
      return res.status(404).json({ message: 'Multa no encontrada' });
    }

    res.json(multa);
  } catch (error) {
    console.error('Error al obtener la multa:', error);
    res.status(500).json({ message: 'Error al obtener la multa' });
  }
});

// Ruta para actualizar una multa específica
router.put('/:id_multa', async (req, res) => {
  const { id_multa } = req.params;
  const { estado } = req.body;

  try {
    // Busca la multa por su ID
    const multa = await Multa.findByPk(id_multa);
    if (!multa) {
      return res.status(404).json({ message: 'Multa no encontrada' });
    }

    // Actualiza el estado de la multa
    multa.estado = estado;
    await multa.save();

    res.status(200).json({ message: 'Multa actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar la multa:', error);
    res.status(500).json({ message: 'Error al actualizar la multa' });
  }
});

// Ruta para eliminar una multa específica
router.delete('/:id_multa', async (req, res) => {
  const { id_multa } = req.params;

  try {
    console.log('Intentando eliminar multa con id_multa:', id_multa); // Log para ver el id_multa recibido

    const result = await Multa.destroy({
      where: {
        id_multa: id_multa, // Cambiar `id` a `id_multa` para que coincida con la columna correcta en la tabla
      },
    });

    if (result) {
      res.status(200).json({ message: 'Multa eliminada correctamente' });
    } else {
      res.status(404).json({ message: 'Multa no encontrada' });
    }
  } catch (error) {
    console.error('Error al eliminar la multa:', error);
    res.status(500).json({ message: 'Error al eliminar la multa' });
  }
});

// Ruta para obtener todas las multas de un usuario específico, filtradas por calificación
router.get('/usuario/:id_usuario', async (req, res) => {
  try {
    const { id_usuario } = req.params;
    const { calificacion } = req.query; // Obtener la calificación de la consulta

    // Verificar si se proporciona la calificación
    let whereClause = {
      usuario_id: id_usuario,
    };

    if (calificacion) {
      whereClause.calificacion = calificacion;
    }

    // Busca todas las multas que pertenecen al usuario dado y cumplen con la calificación
    const multas = await Multa.findAll({
      where: whereClause,
    });

    if (multas.length > 0) {
      res.json(multas);
    } else {
      res.status(404).json({ message: 'No se encontraron multas para el usuario proporcionado.' });
    }
  } catch (error) {
    console.error('Error al obtener las multas del usuario:', error);
    res.status(500).json({ message: 'Error al obtener las multas del usuario.' });
  }
});

// Nueva Ruta para Confirmar el Pago de una Multa
router.post('/pagar/:id_multa', async (req, res) => {
  const { id_multa } = req.params;
  const { usuario_id } = req.body;

  try {
    // Buscar la multa por su ID
    const multa = await Multa.findByPk(id_multa);
    if (!multa) {
      return res.status(404).json({ message: 'Multa no encontrada' });
    }

    // Verificar si la multa ya está pagada
    if (multa.estado === 'pagada') {
      return res.status(400).json({ message: 'La multa ya ha sido pagada' });
    }

    // Buscar al usuario
    const usuario = await Usuario.findByPk(usuario_id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el monto acumulado es suficiente
    if (usuario.monto_acumulado < multa.monto) {
      return res.status(400).json({ message: 'Monto acumulado insuficiente para pagar la multa' });
    }

    // Actualizar el monto acumulado del usuario
    usuario.monto_acumulado -= multa.monto;
    await usuario.save();

    // Actualizar el estado de la multa a 'pagada'
    multa.estado = 'pagada';
    await multa.save();

    res.status(200).json({ message: 'Pago realizado con éxito', monto_acumulado: usuario.monto_acumulado });
  } catch (error) {
    console.error('Error al pagar la multa:', error);
    res.status(500).json({ message: 'Error al pagar la multa', error });
  }
});

module.exports = router;

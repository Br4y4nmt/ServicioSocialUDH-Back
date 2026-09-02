const express = require('express');
const fs = require('fs');
const path = require('path');

const authMiddleware = require('../middlewares/authMiddleware');
const verificarRol = require('../middlewares/verificarRol');
const uploadDocumento = require('../middlewares/documentosMulterConfig');
const DocumentoOficial = require('../models/DocumentoOficial');

const router = express.Router();

const eliminarArchivo = async (archivo) => {
  if (!archivo?.path) return;

  try {
    if (fs.existsSync(archivo.path)) {
      await fs.promises.unlink(archivo.path);
    }
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
  }
};

const eliminarArchivoGuardado = async (rutaArchivo) => {
  if (!rutaArchivo) return;

  try {
    const rutaFisica = path.join(
      __dirname,
      '..',
      rutaArchivo.replace(/^\/+/, '')
    );

    if (fs.existsSync(rutaFisica)) {
      await fs.promises.unlink(rutaFisica);
    }
  } catch (error) {
    console.error(
      'Error al eliminar archivo guardado:',
      error
    );
  }
};

router.get(
  '/',
  authMiddleware,
  verificarRol('alumno'),
  async (req, res) => {
    try {
      const documentos = await DocumentoOficial.findAll({
        where: {
          publicado: true,
          estado: 'VIGENTE'
        },
        attributes: [
          'id_documento',
          'titulo',
          'nombre_original',
          'ruta_archivo',
          'tipo',
          'tamano_bytes',
          'estado',
          'fecha_carga'
        ],
        order: [
          ['orden', 'ASC'],
          ['fecha_carga', 'DESC']
        ]
      });

      return res.status(200).json(documentos);
    } catch (error) {
      console.error('Error al obtener documentos oficiales:', error);

      return res.status(500).json({
        message: 'Error interno al obtener documentos oficiales',
        error: error.message
      });
    }
  }
);

router.get(
  '/admin',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const documentos = await DocumentoOficial.findAll({
        order: [
          ['orden', 'ASC'],
          ['fecha_carga', 'DESC']
        ]
      });

      return res.status(200).json(documentos);
    } catch (error) {
      console.error('Error al obtener documentos oficiales:', error);

      return res.status(500).json({
        message: 'Error interno al obtener documentos oficiales',
        error: error.message
      });
    }
  }
);

router.post(
  '/',
  authMiddleware,
  verificarRol('gestor-udh'),
  uploadDocumento.single('archivo'),
  async (req, res) => {
    try {
      const {
        titulo,
        estado = 'VIGENTE',
        publicado = 'true',
        orden = 0
      } = req.body;

      if (!titulo || !titulo.trim() || !req.file) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'Título y archivo PDF son obligatorios'
        });
      }

      if (!['VIGENTE', 'NO_VIGENTE'].includes(estado)) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'Estado no válido'
        });
      }

      const ordenNumero = Number(orden);

      if (!Number.isInteger(ordenNumero) || ordenNumero < 0) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'El orden debe ser un número entero válido'
        });
      }

      const documento = await DocumentoOficial.create({
        titulo: titulo.trim(),
        nombre_original: req.file.originalname,
        nombre_archivo: req.file.filename,
        ruta_archivo: `/uploads/documentos/${req.file.filename}`,
        tipo: 'PDF',
        mime_type: req.file.mimetype,
        tamano_bytes: req.file.size,
        estado,
        publicado:
          String(publicado).toLowerCase() === 'true' ||
          String(publicado) === '1',
        orden: ordenNumero,
        usuario_carga_id: req.user.id
      });

      return res.status(201).json({
        message: 'Documento oficial guardado correctamente',
        documento
      });
    } catch (error) {
      await eliminarArchivo(req.file);

      console.error('Error al guardar documento oficial:', error);

      return res.status(500).json({
        message: 'Error interno al guardar documento oficial',
        error: error.message
      });
    }
  }
);
router.put(
  '/:id',
  authMiddleware,
  verificarRol('gestor-udh'),
  uploadDocumento.single('archivo'),
  async (req, res) => {
    let documento = null;

    try {
      const { id } = req.params;

      const {
        titulo,
        estado,
        publicado,
        orden
      } = req.body;

      documento = await DocumentoOficial.findByPk(id);

      if (!documento) {
        await eliminarArchivo(req.file);

        return res.status(404).json({
          message: 'Documento oficial no encontrado'
        });
      }

      if (!titulo || !titulo.trim()) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'El título del documento es obligatorio'
        });
      }

      if (
        estado &&
        !['VIGENTE', 'NO_VIGENTE'].includes(estado)
      ) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'Estado no válido'
        });
      }

      const ordenNumero = Number(orden);

      if (
        !Number.isInteger(ordenNumero) ||
        ordenNumero < 0
      ) {
        await eliminarArchivo(req.file);

        return res.status(400).json({
          message: 'El orden debe ser un número entero válido'
        });
      }

      const publicadoBoolean =
        String(publicado).toLowerCase() === 'true' ||
        String(publicado) === '1';

      const rutaArchivoAnterior =
        documento.ruta_archivo;

      documento.titulo = titulo.trim();
      documento.estado = estado || documento.estado;
      documento.publicado = publicadoBoolean;
      documento.orden = ordenNumero;

      if (req.file) {
        documento.nombre_original =
          req.file.originalname;

        documento.nombre_archivo =
          req.file.filename;

        documento.ruta_archivo =
          `/uploads/documentos/${req.file.filename}`;

        documento.tipo = 'PDF';
        documento.mime_type =
          req.file.mimetype;

        documento.tamano_bytes =
          req.file.size;
      }

      await documento.save();

      if (
        req.file &&
        rutaArchivoAnterior &&
        rutaArchivoAnterior !== documento.ruta_archivo
      ) {
        await eliminarArchivoGuardado(
          rutaArchivoAnterior
        );
      }

      return res.status(200).json({
        message:
          'Documento oficial actualizado correctamente',
        documento
      });
    } catch (error) {
      await eliminarArchivo(req.file);

      console.error(
        'Error al actualizar documento oficial:',
        error
      );

      return res.status(500).json({
        message:
          'Error interno al actualizar documento oficial',
        error: error.message
      });
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  verificarRol('gestor-udh'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const documento = await DocumentoOficial.findByPk(id);

      if (!documento) {
        return res.status(404).json({
          message: 'Documento oficial no encontrado'
        });
      }

      if (documento.publicado) {
        return res.status(400).json({
          message: 'Primero debes ocultar el documento antes de eliminarlo'
        });
      }

      const rutaArchivo = documento.ruta_archivo;

      await documento.destroy();
      await eliminarArchivoGuardado(rutaArchivo);

      return res.status(200).json({
        message: 'Documento oficial eliminado correctamente'
      });
    } catch (error) {
      console.error(
        'Error al eliminar documento oficial:',
        error
      );

      return res.status(500).json({
        message: 'Error interno al eliminar documento oficial',
        error: error.message
      });
    }
  }
);

module.exports = router;
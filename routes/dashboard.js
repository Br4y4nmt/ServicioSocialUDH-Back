const express = require("express");
const router = express.Router();

const Estudiantes = require("../models/Estudiantes");
const Facultades = require("../models/Facultades");
const ProgramasAcademicos = require("../models/ProgramasAcademicos");
const TrabajoSocialSeleccionado = require("../models/TrabajoSocialSeleccionado");
const LineaDeAccion = require("../models/LineaDeAccion");
const authMiddleware = require("../middlewares/authMiddleware");
const verificarRol = require("../middlewares/verificarRol");
const { fn, col, Op } = require("sequelize");


router.get("/total-estudiantes",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const total = await Estudiantes.count();
      res.json({ total });
    } catch (error) {
      console.log("Error total estudiantes:", error);
      res.status(500).json({ message: "Error al obtener total de estudiantes" });
    }
  }
);

router.get(
  "/alumnos-por-mes",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const hoy = new Date();
      const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);

      const rows = await TrabajoSocialSeleccionado.findAll({
        attributes: [
          [fn("YEAR", col("createdAt")), "anio"],
          [fn("MONTH", col("createdAt")), "mes"],
          [fn("COUNT", col("id")), "total"],
        ],
        where: {
          estado_plan_labor_social: "aceptado",
          createdAt: {
            [Op.gte]: fechaInicio,
          },
        },
        group: [
          fn("YEAR", col("createdAt")),
          fn("MONTH", col("createdAt")),
        ],
        order: [
          [fn("YEAR", col("createdAt")), "ASC"],
          [fn("MONTH", col("createdAt")), "ASC"],
        ],
        raw: true,
      });

      res.json(
        rows.map((r) => ({
          anio: Number(r.anio),
          mes: Number(r.mes),
          total: Number(r.total),
        }))
      );
    } catch (error) {
      console.error("Error alumnos por mes:", error);
      res
        .status(500)
        .json({ message: "Error al obtener alumnos por mes" });
    }
  }
);


router.get(
  "/total-trabajos-sociales-activos",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const total = await TrabajoSocialSeleccionado.count({
        where: {
          estado_plan_labor_social: "aceptado",
        },
      });

      res.json({ total });
    } catch (error) {
      console.error("Error total trabajos sociales activos:", error);
      res.status(500).json({
        message: "Error al obtener total de trabajos sociales activos",
      });
    }
  }
);


router.get(
  "/total-certificados-finales",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const total = await TrabajoSocialSeleccionado.count({
        where: {
          certificado_final: {
            [Op.ne]: null,
          },
          estado_informe_final: "aprobado",
        },
      });

      res.json({ total });
    } catch (error) {
      console.error("Error total certificados finales:", error);
      res
        .status(500)
        .json({ message: "Error al obtener total de certificados finales" });
    }
  }
);


router.get(
  "/resumen-estudiantes",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      // Total global
      const totalEstudiantes = await Estudiantes.count();

      // Agrupar por sede
      const porSedeRaw = await Estudiantes.findAll({
        attributes: [
          "sede",
          [fn("COUNT", col("id_estudiante")), "total"],
        ],
        group: ["sede"],
        raw: true,
      });

      const porSede = porSedeRaw
        .filter((r) => r.sede !== null)
        .map((r) => ({
          sede: r.sede,
          total: Number(r.total),
        }));

      // Agrupar por modalidad
      const porModalidadRaw = await Estudiantes.findAll({
        attributes: [
          "modalidad",
          [fn("COUNT", col("id_estudiante")), "total"],
        ],
        group: ["modalidad"],
        raw: true,
      });

      const porModalidad = porModalidadRaw
        .filter((r) => r.modalidad !== null)
        .map((r) => ({
          modalidad: r.modalidad,
          total: Number(r.total),
        }));

      res.json({
        totalEstudiantes,
        porSede,
        porModalidad,
      });
    } catch (error) {
      console.error("Error resumen estudiantes:", error);
      res
        .status(500)
        .json({ message: "Error al obtener resumen de estudiantes" });
    }
  }
);


// 🆕 Últimos estudiantes (para el DataGrid del dashboard)
router.get(
  "/ultimos-estudiantes",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const estudiantes = await Estudiantes.findAll({
        include: [
          {
            model: ProgramasAcademicos,
            as: "programa",
            attributes: ["nombre_programa"],
          },
          {
            model: Facultades,
            as: "facultad",
            attributes: ["nombre_facultad"],
          },
        ],
        order: [["id_estudiante", "DESC"]], 
        limit: 10,
      });

      const resultado = estudiantes.map((e) => ({
        id: e.id_estudiante,
        codigo: e.codigo,
        estudiante: e.nombre_estudiante,
        facultad: e.facultad?.nombre_facultad || "SIN FACULTAD",
        programa: e.programa?.nombre_programa || "SIN PROGRAMA",
        estado: "ACTIVO", // default
        }));

      res.json(resultado);
    } catch (error) {
      console.error("Error obteniendo últimos estudiantes:", error);
      res
        .status(500)
        .json({ message: "Error al obtener últimos estudiantes" });
    }
  }
);



router.get(
  "/estudiantes-por-facultad",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const rows = await Estudiantes.findAll({
        attributes: [
          [col("facultad.nombre_facultad"), "facultad"],
          [fn("COUNT", col("Estudiantes.id_estudiante")), "total"],
        ],
        include: [
          {
            model: Facultades,
            as: "facultad",
            attributes: [],
          },
        ],
        group: ["facultad.id_facultad", "facultad.nombre_facultad"],
        raw: true,
      });

      const resultado = rows.map((r) => ({
        facultad: r.facultad,
        total: Number(r.total),
      }));

      res.json(resultado);
    } catch (error) {
      console.error("Error estudiantes por facultad:", error);
      res
        .status(500)
        .json({ message: "Error al obtener estudiantes por facultad" });
    }
  }
);


router.get(
  "/estudiantes-por-programa",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const rows = await Estudiantes.findAll({
        attributes: [
          [col("programa.nombre_programa"), "programa"],
          [fn("COUNT", col("Estudiantes.id_estudiante")), "total"],
        ],
        include: [
          {
            model: ProgramasAcademicos,
            as: "programa",
            attributes: [],
          },
        ],
        group: ["programa.id_programa", "programa.nombre_programa"],
        raw: true,
      });

      const resultado = rows.map((r) => ({
        programa: r.programa,
        total: Number(r.total),
      }));

      res.json(resultado);
    } catch (error) {
      console.error("Error estudiantes por programa:", error);
      res
        .status(500)
        .json({ message: "Error al obtener estudiantes por programa" });
    }
  }
);



router.get(
  "/top-programas",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const rows = await Estudiantes.findAll({
        attributes: [
          [col("programa.nombre_programa"), "programa"],
          [fn("COUNT", col("Estudiantes.id_estudiante")), "total"],
        ],
        include: [
          {
            model: ProgramasAcademicos,
            as: "programa",
            attributes: [],
          },
        ],
        group: ["programa.id_programa", "programa.nombre_programa"],
        order: [[fn("COUNT", col("Estudiantes.id_estudiante")), "DESC"]],
        limit: 5,
        raw: true,
      });

      const resultado = rows.map((r) => ({
        programa: r.programa,
        total: Number(r.total),
      }));

      res.json(resultado);
    } catch (error) {
      console.error("Error top programas:", error);
      res.status(500).json({ message: "Error al obtener top de programas" });
    }
  }
);



router.get(
  "/top-lineas-accion",
  authMiddleware,
  verificarRol("gestor-udh"),
  async (req, res) => {
    try {
      const rows = await TrabajoSocialSeleccionado.findAll({
        attributes: [
          [col("lineaAccion.nombre_linea"), "linea"],
          [fn("COUNT", col("TrabajoSocialSeleccionado.id")), "total"],
        ],
        include: [
          {
            model: LineaDeAccion,
            as: "lineaAccion",        
            attributes: [],
          },
        ],
        group: ["lineaAccion.id_linea", "lineaAccion.nombre_linea"],
        order: [[fn("COUNT", col("TrabajoSocialSeleccionado.id")), "DESC"]],
        limit: 5,
        raw: true,
      });

      const resultado = rows.map((r) => ({
        linea: r.linea,
        total: Number(r.total),
      }));

      res.json(resultado);
    } catch (error) {
      console.error("Error top líneas de acción:", error);
      res
        .status(500)
        .json({ message: "Error al obtener ranking de líneas de acción" });
    }
  }
);
module.exports = router;

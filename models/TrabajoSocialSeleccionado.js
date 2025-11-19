
const { Model, DataTypes } = require('sequelize');


const sequelize = require('../config/database');

class TrabajoSocialSeleccionado extends Model {}

TrabajoSocialSeleccionado.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  programa_academico_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  docente_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  linea_accion_id: {
  type: DataTypes.INTEGER,
  allowNull: false
 },
  labor_social_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  estado_plan_labor_social: {
    type: DataTypes.ENUM('pendiente', 'aceptado', 'rechazado'),
    defaultValue: 'pendiente'
  },
  facultad_id: { 
    type: DataTypes.INTEGER,
    allowNull: false
  },
  conformidad_plan_social: {
    type: DataTypes.ENUM('pendiente', 'aceptado', 'rechazado'),
    allowNull: true 
  },
  archivo_plan_social: { 
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo_servicio_social: {
    type: DataTypes.ENUM('individual', 'grupal'),
    allowNull: false,
    defaultValue: 'individual'
  },
  solicitud_termino: {
  type: DataTypes.ENUM('no_solicitada', 'solicitada', 'aprobada', 'rechazada'),
  allowNull: false,
  defaultValue: 'no_solicitada'
},
carta_aceptacion_pdf: { 
    type: DataTypes.STRING,
    allowNull: true
  },
  informe_final_pdf: {
  type: DataTypes.STRING,
  allowNull: true
},
estado_informe_final: {
  type: DataTypes.ENUM('pendiente', 'aprobado', 'rechazado'),
  allowNull: false,
  defaultValue: 'pendiente'
},
certificado_final: {
  type: DataTypes.STRING,
  allowNull: true,
},
carta_termino_pdf: { 
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'TrabajoSocialSeleccionado',
  tableName: 'trabajo_social_seleccionado',
  timestamps: true
});

module.exports = TrabajoSocialSeleccionado;

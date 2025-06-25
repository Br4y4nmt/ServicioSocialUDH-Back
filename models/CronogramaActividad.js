const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class CronogramaActividad extends Model {}

CronogramaActividad.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  trabajo_social_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  actividad: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  justificacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  resultados: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  observacion: {
  type: DataTypes.TEXT,
  allowNull: true
},

  estado: {
  type: DataTypes.ENUM('aprobado', 'observado', 'pendiente'),
  allowNull: true
},
fecha_fin_primero: {
  type: DataTypes.DATE,
  allowNull: true, // o false según tu lógica
},
  evidencia: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'CronogramaActividad',
  tableName: 'cronograma_actividades',
  timestamps: true
});

module.exports = CronogramaActividad;
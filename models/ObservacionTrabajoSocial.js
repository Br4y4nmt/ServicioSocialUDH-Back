const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class ObservacionTrabajoSocial extends Model {}

ObservacionTrabajoSocial.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    trabajo_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true // puede ser null si no quieres guardar el autor siempre
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      // ejemplos: 'declinar', 'revision', 'otro'
      defaultValue: 'declinar'
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'ObservacionTrabajoSocial',
    tableName: 'observaciones_trabajo_social',
    timestamps: true 
  }
);

module.exports = ObservacionTrabajoSocial;

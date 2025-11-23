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
      allowNull: true 
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
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

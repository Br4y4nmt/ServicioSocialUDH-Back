const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const LineaDeAccion = require('./LineaDeAccion'); 

class LaboresSociales extends Model {}

LaboresSociales.init({
  id_labores: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_labores: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  linea_accion_id: { 
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: LineaDeAccion,
      key: 'id_linea'
    }
  }
}, {
  sequelize,
  modelName: 'LaboresSociales',
  tableName: 'labores_sociales',
  timestamps: false,
});

module.exports = LaboresSociales;

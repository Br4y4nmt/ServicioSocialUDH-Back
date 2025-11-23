const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Facultades extends Model {}

Facultades.init({
  id_facultad: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_facultad: {
    type: DataTypes.STRING(255),
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'Facultades',
  tableName: 'facultades', 
  timestamps: false,
});

module.exports = Facultades;

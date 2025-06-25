const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class LineaDeAccion extends Model {}

LineaDeAccion.init({
  id_linea: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_linea: {
    type: DataTypes.STRING(255),
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'LineaDeAccion',
  tableName: 'linea_de_accion',
  timestamps: false,
});

module.exports = LineaDeAccion;

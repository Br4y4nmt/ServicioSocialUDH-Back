const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class CartaAceptacion extends Model {}

CartaAceptacion.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  trabajo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'trabajo_social_seleccionado',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  codigo_universitario: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  nombre_archivo_pdf: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'CartaAceptacion',
  tableName: 'cartas_aceptacion',
  timestamps: true
});

module.exports = CartaAceptacion;

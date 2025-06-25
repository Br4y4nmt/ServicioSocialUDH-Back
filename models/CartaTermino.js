const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class CartaTermino extends Model {}

CartaTermino.init({
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
  modelName: 'CartaTermino',
  tableName: 'cartas_termino',
  timestamps: true
});

module.exports = CartaTermino;

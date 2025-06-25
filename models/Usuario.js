const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Usuario extends Model {}

Usuario.init({
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  dni: {
    type: DataTypes.STRING(8),
    allowNull: true,
    unique: true,
  },
  whatsapp: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  primera_vez: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  rol_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Roles',
      key: 'id_rol',
    },
  },
}, {
  sequelize,
  modelName: 'Usuario',
  tableName: 'usuario',
  timestamps: false,
});

module.exports = Usuario;

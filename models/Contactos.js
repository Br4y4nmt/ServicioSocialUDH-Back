const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Contactos extends Model {}

Contactos.init({
  id_contacto: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  nombre_completo: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },

  correo_electronico: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },

  tipo_usuario: {
    type: DataTypes.ENUM(
      'ESTUDIANTE',
      'SUPERVISOR',
      'ADMINISTRATIVO',
      'OTRO'
    ),
    allowNull: false,
  },

  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  estado: {
    type: DataTypes.ENUM(
      'PENDIENTE',
      'ATENDIDO'
    ),
    allowNull: false,
    defaultValue: 'PENDIENTE',
  },

  fecha_registro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }

}, {
  sequelize,
  modelName: 'Contactos',
  tableName: 'contactos',
  timestamps: false,
});

module.exports = Contactos;
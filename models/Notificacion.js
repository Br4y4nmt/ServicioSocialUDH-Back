const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Notificacion extends Model {}

Notificacion.init({
  id_notificacion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fecha_envio: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  visto: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Usuario',
      key: 'id_usuario',
    },
  },
}, {
  sequelize,
  modelName: 'Notificacion',
  tableName: 'notificacion',
  timestamps: false,
});

module.exports = Notificacion;

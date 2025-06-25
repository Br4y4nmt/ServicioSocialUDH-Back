const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Roles extends Model {}

Roles.init({
  id_rol: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_rol: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'Roles',
  tableName: 'roles',  // MUY IMPORTANTE: para que apunte a la tabla correcta
  timestamps: false,   // No tienes columnas createdAt ni updatedAt
});

module.exports = Roles;

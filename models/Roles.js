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
  tableName: 'roles',  
  timestamps: false,   
});

module.exports = Roles;

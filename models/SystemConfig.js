const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class SystemConfig extends Model {}

SystemConfig.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  master_password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'SystemConfig',
  tableName: 'system_config',
  timestamps: false,
});

module.exports = SystemConfig;

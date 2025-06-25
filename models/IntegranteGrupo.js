// models/IntegranteGrupo.js
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class IntegranteGrupo extends Model {}

IntegranteGrupo.init({
  id_integrante: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  trabajo_social_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'trabajo_social_seleccionado',
      key: 'id'
    },
    onDelete: 'CASCADE' // si se elimina el trabajo social, se eliminan sus integrantes
  },
  correo_institucional: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  }
}, {
  sequelize,
  modelName: 'IntegranteGrupo',
  tableName: 'integrantes_grupo',
  timestamps: true
});

module.exports = IntegranteGrupo;

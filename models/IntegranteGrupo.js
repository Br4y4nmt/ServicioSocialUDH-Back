const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class IntegranteGrupo extends Model {}

IntegranteGrupo.init(
  {
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
      onDelete: 'CASCADE'
    },

    nombre_completo: {
      type: DataTypes.STRING(150),
      allowNull: false
    },

    dni: {
      type: DataTypes.STRING(8),
      allowNull: false,
      validate: {
        len: [8, 8],
        isNumeric: true
      }
    },

    facultad: {
      type: DataTypes.STRING(150),
      allowNull: false
    },

    programa_academico: {
      type: DataTypes.STRING(200),
      allowNull: false
    },

    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false
    },

    correo_institucional: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },

    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NO_ATENDIDO'
    }
  },
  {
    sequelize,
    modelName: 'IntegranteGrupo',
    tableName: 'integrantes_grupo',
    timestamps: true
  }
);

module.exports = IntegranteGrupo;
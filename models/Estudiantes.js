const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ProgramasAcademicos = require('./ProgramasAcademicos');
const Facultades = require('./Facultades');
class Estudiantes extends Model {}

Estudiantes.init({
  id_estudiante: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_estudiante: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  dni: {
    type: DataTypes.STRING(8),
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  codigo: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  facultad_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Facultades,
      key: 'id_facultad'
    }
  },
  programa_academico_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: ProgramasAcademicos,
      key: 'id_programa'
    }
  },
  celular: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  sede: {
  type: DataTypes.ENUM('HUÁNUCO', 'LEONCIO PRADO'),
  allowNull: true,
  defaultValue: null,
  },

  modalidad: {
    type: DataTypes.ENUM('PRESENCIAL', 'SEMI-PRESENCIAL'),
    allowNull: true,
    defaultValue: null
  },

  id_usuario: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuario',
      key: 'id_usuario'
    }
  }
}, {
  sequelize,
  modelName: 'Estudiantes',
  tableName: 'estudiantes',
  timestamps: false,
});

module.exports = Estudiantes;

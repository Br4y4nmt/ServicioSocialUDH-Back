const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const ProgramasAcademicos = require('./ProgramasAcademicos');  
const Facultades = require('./Facultades'); 

class Docentes extends Model {}

Docentes.init({
  id_docente: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre_docente: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  dni: {
    type: DataTypes.STRING(8),
    allowNull: true,
    unique: true, 
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,  
  },
  facultad_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Facultades,
      key: 'id_facultad'
    }
  },
  programa_academico_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: ProgramasAcademicos,
      key: 'id_programa'
    }
  },
  celular: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  id_usuario: { 
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuario',
      key: 'id_usuario'
    }
  },
  firma_digital: {
    type: DataTypes.STRING(255),
    allowNull: true, 
  }
}, {
  sequelize,
  modelName: 'Docentes',
  tableName: 'docentes',
  timestamps: false,
});

module.exports = Docentes;

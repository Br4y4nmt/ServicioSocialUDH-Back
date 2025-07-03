const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class CertificadoFinalMiembro extends Model {}

CertificadoFinalMiembro.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  trabajo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'trabajo_social_seleccionado',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  codigo_universitario: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  nombre_archivo_pdf: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'CertificadoFinalMiembro',
  tableName: 'certificados_final_miembros',
  timestamps: true
});

module.exports = CertificadoFinalMiembro;

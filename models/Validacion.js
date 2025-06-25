const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Verifica que la conexión esté bien configurada

class Validacion extends Model {}

Validacion.init({
  id_validacion: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  id_trabajo: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  imagen: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ruta_imagen: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fecha_validacion: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  comentarios: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha_ejecucion: { // Nuevo campo
    type: DataTypes.DATEONLY, // Solo fecha sin hora
    allowNull: true,
  },
  horas_dedicadas: { // Nuevo campo
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  ubicacion_exacta: { // Nuevo campo
    type: DataTypes.STRING,
    allowNull: false,
  },
  
  usuario_validacion: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  nombre_completo_validacion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  estado_validacion: {
    type: DataTypes.ENUM('pendiente', 'aprobado', 'rechazado'),
    defaultValue: 'pendiente',
    allowNull: false,
  },
  observaciones_rechazo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Validacion',
  tableName: 'validacion',
  timestamps: false,
});

module.exports = Validacion;

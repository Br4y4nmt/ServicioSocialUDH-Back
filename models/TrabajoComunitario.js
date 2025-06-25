const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class TrabajoComunitario extends Model {}

TrabajoComunitario.init({
  id_trabajo: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  hora_inicio: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  hora_fin: {
    type: DataTypes.TIME,
    allowNull: true,
  },
  responsable: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ubicacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  estado: {
    type: DataTypes.ENUM('disponible', 'asignado', 'completado'),
    allowNull: false,
    defaultValue: 'disponible',
  },
  id_transportista: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuario',
      key: 'id_usuario',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  multa_asociada: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'multa',
      key: 'id_multa',
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'usuario', // Nombre de la tabla asociada
        key: 'id_usuario', // Llave primaria de la tabla asociada
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
  },


  puntos: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  imagen: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2), // Nuevo campo 'monto' con dos decimales para almacenar valores monetarios
    allowNull: false,
    defaultValue: 0.00,
  },
  comprobante_pdf: {  // 🔥 AÑADIDO
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'TrabajoComunitario',
  tableName: 'trabajoComunitario',
  timestamps: false,
});


module.exports = TrabajoComunitario;

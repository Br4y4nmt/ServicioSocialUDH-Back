const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Infracciones = sequelize.define('Infracciones', {
  codigo: {
    type: DataTypes.STRING(10),
    allowNull: false,
    
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  calificacion: {
    type: DataTypes.ENUM('Leve', 'Grave', 'Muy grave'),
    allowNull: false
  },
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  sancion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  puntos: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'infracciones',  // Nombre de la tabla en la base de datos
  freezeTableName: true,  // Para evitar que Sequelize modifique el nombre de la tabla
  timestamps: false,  // No agregar campos createdAt y updatedAt
});

module.exports = Infracciones;

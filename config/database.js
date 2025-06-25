const { Sequelize } = require('sequelize');
require('dotenv').config();

// Crear la instancia de Sequelize con las variables de entorno
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,  // Deshabilitar el logging si no deseas que se muestren las consultas SQL
});

// Sincronizar la base de datos
sequelize.sync()  // Sin alter: true
  .then(() => {
    console.log('La base de datos ha sido sincronizada correctamente.');
  })
  .catch((error) => {
    console.error('Error al sincronizar la base de datos:', error);
  });


module.exports = sequelize;

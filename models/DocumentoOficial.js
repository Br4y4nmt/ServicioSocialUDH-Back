const { Model, DataTypes } = require('sequelize');

const sequelize = require('../config/database');

class DocumentoOficial extends Model {}

DocumentoOficial.init({

	id_documento: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},

	titulo: {
		type: DataTypes.STRING(255),
		allowNull: false,
	},

	nombre_original: {
		type: DataTypes.STRING(255),
		allowNull: false,
	},

	nombre_archivo: {
		type: DataTypes.STRING(255),
		allowNull: false,
		unique: true,
	},

	ruta_archivo: {
		type: DataTypes.STRING(500),
		allowNull: false,
	},

	tipo: {
		type: DataTypes.STRING(20),
		allowNull: false,
		defaultValue: 'PDF',
	},

	mime_type: {
		type: DataTypes.STRING(100),
		allowNull: false,
		defaultValue: 'application/pdf',
	},

	tamano_bytes: {
		type: DataTypes.BIGINT,
		allowNull: true,
	},

	estado: {
		type: DataTypes.ENUM(
			'VIGENTE',
			'NO_VIGENTE'
		),
		allowNull: false,
		defaultValue: 'VIGENTE',
	},

	publicado: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true,
	},

	orden: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0,
	},

	usuario_carga_id: {
		type: DataTypes.INTEGER,
		allowNull: false,

		references: {
			model: 'usuario',
			key: 'id_usuario',
		},
	},

}, {
	sequelize,
	modelName: 'DocumentoOficial',
	tableName: 'documentos_oficiales',
	timestamps: true,
	createdAt: 'fecha_carga',
	updatedAt: 'fecha_actualizacion',
	indexes: [
		{
			fields: ['estado'],
		},
		{
			fields: ['publicado'],
		},
		{
			fields: ['orden'],
		},
	],
});

module.exports = DocumentoOficial;
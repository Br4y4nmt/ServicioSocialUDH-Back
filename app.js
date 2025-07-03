require('dotenv').config(); // Cargar variables de entorno desde el archivo .env

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');  // Importa cors
const path = require('path');
const sequelize = require('./config/database');

// Modelos
const Roles = require('./models/Roles');
const Usuario = require('./models/Usuario');
const Notificacion = require('./models/Notificacion');
const CartaAceptacion = require('./models/CartaAceptacion');
const CartaTermino = require('./models/CartaTermino');
const LineaDeAccion = require('./models/LineaDeAccion');
const CertificadoFinalMiembro = require('./models/CertificadoFinalMiembro');
const ProgramasAcademicos = require('./models/ProgramasAcademicos');
const Estudiantes = require('./models/Estudiantes');
const CronogramaActividad = require('./models/CronogramaActividad');
const Docentes = require('./models/Docentes');
const LaboresSociales = require('./models/LaboresSociales');
const TrabajoSocialSeleccionado = require('./models/TrabajoSocialSeleccionado');
const IntegranteGrupo = require('./models/IntegranteGrupo');
const Facultades = require('./models/Facultades');
const app = express();

// Configuración de CORS
const corsOptions = {
  origin: 'https://servicio-social.sistemasudh.com', 
  //origin: 'http://localhost:3000', // O la URL de tu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH'],  // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'],  // Encabezados permitidos
  credentials: true,  // Permite el envío de cookies y autenticación
};
app.use(cors(corsOptions));  // Usa esta configuración de CORS


app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': ["'self'", 'https://servicio-social.sistemasudh.com'],
      },
    },
  })
);
// Middleware para parsear JSON en las solicitudes
app.use(express.json());

// Servir la carpeta de archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*'); 
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Rutas
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);


const facultadesRoutes = require('./routes/facultades');  
app.use('/api/facultades', facultadesRoutes);

const lineaDeAccionRoutes = require('./routes/lineaDeAccion');
app.use('/api/lineas', lineaDeAccionRoutes);


const programasRoutes = require('./routes/programas');
app.use('/api/programas', programasRoutes);

const docentesRoutes = require('./routes/docentes');
app.use('/api/docentes', docentesRoutes);

const usuariosRoutes = require('./routes/usuarios');
app.use('/api/usuarios', usuariosRoutes);

const certificadosFinalMiembrosRoutes = require('./routes/certificadosFinalMiembros');
app.use('/api/certificados-final', certificadosFinalMiembrosRoutes);


const cartasAceptacionRoutes = require('./routes/cartasAceptacion');
app.use('/api/cartas-aceptacion', cartasAceptacionRoutes);


const cartasTerminoRoutes = require('./routes/cartasTermino'); // ✅ correcto
app.use('/api/cartas-termino', cartasTerminoRoutes);


const cronogramaRoutes = require('./routes/cronograma');
app.use('/api/cronograma', cronogramaRoutes);

const integrantesGrupoRoutes = require('./routes/integrantesGrupo');
app.use('/api/integrantes', integrantesGrupoRoutes);


const laboresSocialesRoutes = require('./routes/laboresSociales');
app.use('/api/labores', laboresSocialesRoutes);


const estudiantesRoutes = require('./routes/estudiantes');
app.use('/api/estudiantes', estudiantesRoutes);


const trabajoSocialSeleccionadoRoutes = require('./routes/trabajoSocialSeleccionadoRoutes');
app.use('/api/trabajo-social', trabajoSocialSeleccionadoRoutes);


const syncDatabase = async () => {
  try {
    
    await Roles.sync();
    await Usuario.sync();
    await Notificacion.sync();
    await ProgramasAcademicos.sync();
    await Docentes.sync();
    await LaboresSociales.sync();
    await TrabajoSocialSeleccionado.sync();
    await Facultades.sync();
    await CertificadoFinalMiembro.sync();
    await CronogramaActividad.sync();
    await IntegranteGrupo.sync();
    await Estudiantes.sync();
    console.log('Base de datos sincronizada correctamente');
    
    // Iniciar el servidor
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });

  } catch (error) {
    console.error('Error al sincronizar la base de datos:', error);
  }
};

syncDatabase();

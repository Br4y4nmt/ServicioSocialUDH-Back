require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');

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
const ObservacionTrabajoSocial = require('./models/ObservacionTrabajoSocial');
const LaboresSociales = require('./models/LaboresSociales');
const TrabajoSocialSeleccionado = require('./models/TrabajoSocialSeleccionado');
const IntegranteGrupo = require('./models/IntegranteGrupo');
const Facultades = require('./models/Facultades');
const SystemConfig = require('./models/SystemConfig');

const app = express();

const corsOptions = {
  //origin: 'http://localhost:3000',
  origin: 'https://serviciosocial.udh.edu.pe',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': ["'self'", 'https://serviciosocial.udh.edu.pe'],
        //'frame-ancestors': ["'self'", 'http://localhost:3000'],
      },
    },
  })
);

app.use(express.json());

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/system-config', require('./routes/systemConfig'));
app.use('/api/facultades', require('./routes/facultades'));
app.use('/api/lineas', require('./routes/lineaDeAccion'));
app.use('/api/programas', require('./routes/programas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/docentes', require('./routes/docentes'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/certificados-final', require('./routes/certificadosFinalMiembros'));
app.use('/api/admin', require('./routes/impersonate'));
app.use('/api/cartas-aceptacion', require('./routes/cartasAceptacion'));
app.use('/api/cartas-termino', require('./routes/cartasTermino'));
app.use('/api/cronograma', require('./routes/cronograma'));
app.use('/api/integrantes', require('./routes/integrantesGrupo'));
app.use('/api/labores', require('./routes/laboresSociales'));
app.use('/api/estudiantes', require('./routes/estudiantes'));
app.use('/api/trabajo-social', require('./routes/trabajoSocialSeleccionadoRoutes'));

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a la base de datos exitosa');

    await Roles.sync();
    await TrabajoSocialSeleccionado.sync();
    await Usuario.sync();
    await SystemConfig.sync();
    await Notificacion.sync();
    await ProgramasAcademicos.sync();
    await Docentes.sync();
    await ObservacionTrabajoSocial.sync();
    await LaboresSociales.sync();
    await Facultades.sync();
    await CertificadoFinalMiembro.sync();
    await CronogramaActividad.sync();
    await IntegranteGrupo.sync();
    await Estudiantes.sync();

    console.log('Base de datos sincronizada correctamente');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
  }
};

startServer();
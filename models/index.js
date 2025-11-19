const ProgramasAcademicos = require('./ProgramasAcademicos');
const Docentes = require('./Docentes');
const LaboresSociales = require('./LaboresSociales');
const Usuario = require('./Usuario');
const Roles = require('./Roles');
const CertificadoFinalMiembro = require('./CertificadoFinalMiembro');
const TrabajoSocialSeleccionado = require('./TrabajoSocialSeleccionado');
const Notificacion = require('./Notificacion');
const LineaDeAccion = require('./LineaDeAccion'); 
const CartaTermino = require('./CartaTermino'); 
const Facultades = require('./Facultades');
const CartaAceptacion = require('./CartaAceptacion'); 
const Estudiantes = require('./Estudiantes');
const CronogramaActividad = require('./CronogramaActividad');
const IntegranteGrupo = require('./IntegranteGrupo'); 
const ObservacionTrabajoSocial = require('./ObservacionTrabajoSocial');


Roles.hasMany(Usuario, { foreignKey: 'rol_id' });
Usuario.belongsTo(Roles, { foreignKey: 'rol_id' });

LineaDeAccion.hasMany(LaboresSociales, { foreignKey: 'linea_accion_id' });
LaboresSociales.belongsTo(LineaDeAccion, {
  foreignKey: 'linea_accion_id',
  as: 'LineaAccion' 
});

Usuario.hasMany(TrabajoSocialSeleccionado, { foreignKey: 'usuario_id' });
TrabajoSocialSeleccionado.belongsTo(Usuario, { foreignKey: 'usuario_id' });

TrabajoSocialSeleccionado.hasMany(CartaAceptacion, {
  foreignKey: 'trabajo_id',
  as: 'cartas'
});

CartaAceptacion.belongsTo(TrabajoSocialSeleccionado, {
  foreignKey: 'trabajo_id',
  as: 'trabajo'
});

ProgramasAcademicos.hasMany(TrabajoSocialSeleccionado, { foreignKey: 'programa_academico_id' });
TrabajoSocialSeleccionado.belongsTo(ProgramasAcademicos, { foreignKey: 'programa_academico_id' });

Docentes.hasMany(TrabajoSocialSeleccionado, { foreignKey: 'docente_id' });
TrabajoSocialSeleccionado.belongsTo(Docentes, { foreignKey: 'docente_id' });

LaboresSociales.hasMany(TrabajoSocialSeleccionado, { foreignKey: 'labor_social_id' });
TrabajoSocialSeleccionado.belongsTo(LaboresSociales, { foreignKey: 'labor_social_id' });

ProgramasAcademicos.hasMany(Docentes, { foreignKey: 'programa_academico_id' });
Docentes.belongsTo(ProgramasAcademicos, { foreignKey: 'programa_academico_id' });

TrabajoSocialSeleccionado.hasMany(CertificadoFinalMiembro, {
  foreignKey: 'trabajo_id',
  as: 'certificadosFinales'
});

CertificadoFinalMiembro.belongsTo(TrabajoSocialSeleccionado, {
  foreignKey: 'trabajo_id',
  as: 'trabajo'
});

TrabajoSocialSeleccionado.belongsTo(LineaDeAccion, {
  foreignKey: 'linea_accion_id',
  as: 'lineaAccion'
});

LineaDeAccion.hasMany(TrabajoSocialSeleccionado, {
  foreignKey: 'linea_accion_id',
  as: 'trabajosSociales'
});

Usuario.hasMany(Notificacion, { foreignKey: 'usuario_id' });
Notificacion.belongsTo(Usuario, { foreignKey: 'usuario_id' });
TrabajoSocialSeleccionado.hasMany(CronogramaActividad, { foreignKey: 'trabajo_social_id', as: 'cronograma' });
CronogramaActividad.belongsTo(TrabajoSocialSeleccionado, { foreignKey: 'trabajo_social_id', as: 'trabajoSocial' });
Facultades.hasMany(ProgramasAcademicos, { foreignKey: 'id_facultad' });
ProgramasAcademicos.belongsTo(Facultades, { foreignKey: 'id_facultad' });

TrabajoSocialSeleccionado.belongsTo(Facultades, {
  foreignKey: 'facultad_id',
  as: 'Facultad'  
});
Facultades.hasMany(TrabajoSocialSeleccionado, { foreignKey: 'facultad_id' });
Estudiantes.belongsTo(Facultades, {
  foreignKey: 'facultad_id',
  as: 'facultad'
});
Facultades.hasMany(Estudiantes, { foreignKey: 'facultad_id' });
ProgramasAcademicos.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Usuario.hasOne(ProgramasAcademicos, { foreignKey: 'usuario_id' });
Estudiantes.belongsTo(Usuario, { foreignKey: 'id_usuario' });
Usuario.hasMany(Estudiantes, { foreignKey: 'id_usuario' });

Estudiantes.belongsTo(ProgramasAcademicos, {
  foreignKey: 'programa_academico_id',
  as: 'programa'
});
ProgramasAcademicos.hasMany(Estudiantes, { foreignKey: 'programa_academico_id' });

TrabajoSocialSeleccionado.belongsTo(Estudiantes, {
  foreignKey: 'usuario_id',
  targetKey: 'id_usuario'
});

Estudiantes.hasMany(TrabajoSocialSeleccionado, {
  foreignKey: 'usuario_id',
  sourceKey: 'id_usuario'
});

Docentes.belongsTo(Facultades, {
  foreignKey: 'facultad_id',
  as: 'Facultade'
});
Facultades.hasMany(Docentes, {
  foreignKey: 'facultad_id',
  as: 'docentes'
});

Docentes.belongsTo(Usuario, { foreignKey: 'id_usuario' });
Usuario.hasMany(Docentes, { foreignKey: 'id_usuario' });

Docentes.belongsTo(ProgramasAcademicos, {
  foreignKey: 'programa_academico_id',
  as: 'ProgramaDelDocente'
});
ProgramasAcademicos.hasMany(Docentes, {
  foreignKey: 'programa_academico_id',
  as: 'docentes'
});
// 🔹 Un trabajo social puede tener muchas observaciones
TrabajoSocialSeleccionado.hasMany(ObservacionTrabajoSocial, {
  foreignKey: 'trabajo_id',
  as: 'observaciones'
});

// 🔹 Cada observación pertenece a un trabajo social
ObservacionTrabajoSocial.belongsTo(TrabajoSocialSeleccionado, {
  foreignKey: 'trabajo_id',
  as: 'trabajo'
});

// (Opcional, pero útil) Relación con Usuario (autor de la observación)
Usuario.hasMany(ObservacionTrabajoSocial, {
  foreignKey: 'usuario_id',
  as: 'observaciones'
});

ObservacionTrabajoSocial.belongsTo(Usuario, {
  foreignKey: 'usuario_id',
  as: 'autor'
});
TrabajoSocialSeleccionado.hasMany(IntegranteGrupo, { foreignKey: 'trabajo_social_id', as: 'integrantes' });
IntegranteGrupo.belongsTo(TrabajoSocialSeleccionado, { foreignKey: 'trabajo_social_id', as: 'trabajoSocial' });

module.exports = {
  Usuario,
  ProgramasAcademicos,
  Estudiantes,
  Docentes,
  LaboresSociales,
  Roles,
  TrabajoSocialSeleccionado,
  CronogramaActividad,
  Notificacion,
  Facultades,
  IntegranteGrupo,
  LineaDeAccion,
  CartaAceptacion,
  CartaTermino,
  ObservacionTrabajoSocial,
  CertificadoFinalMiembro
};

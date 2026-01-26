const axios = require('axios');

const getDatosAcademicosUDH = async (codigo) => {
  const url = `http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigo}`;

  try {
    const { data } = await axios.get(url, { timeout: 5000 });

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No se encontraron datos');
    }

    const info = data[0] || {};

    const nombres = (info.stu_nombres || '').trim();
    const apPat = (info.stu_apellido_paterno || '').trim();
    const apMat = (info.stu_apellido_materno || '').trim();
    const nombre_completo = `${nombres} ${apPat} ${apMat}`.trim() || null;
    const firstNonEmpty = (...vals) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return null;
    };

    return {
      nombre_completo,
      facultad: firstNonEmpty(info.stu_facultad, info.facultad),
      programa: firstNonEmpty(info.stu_programa, info.programa),
      dni: firstNonEmpty(info.stu_dni, info.dni),
      codigo: firstNonEmpty(info.stu_codigo, info.codigo, codigo),
      email: firstNonEmpty(
        info.stu_correo_institucional,
        info.stu_email,
        info.email
      ),

      celular: firstNonEmpty(
        info.stu_celular,
        info.stu_telefono,
        info.celular
      ),

      sede: firstNonEmpty(info.stu_sede, info.sede),
      modalidad: firstNonEmpty(info.stu_modalidad, info.modalidad),
      ciclo: firstNonEmpty(info.stu_ciclo, info.ciclo),
      estado: firstNonEmpty(info.stu_estado, info.estado),
      raw: info
    };
  } catch (error) {
    console.error(`Error con código ${codigo}:`, error.message);
    return null;
  }
};

module.exports = { getDatosAcademicosUDH };

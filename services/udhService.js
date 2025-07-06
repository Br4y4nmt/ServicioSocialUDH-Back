const axios = require('axios');

const getDatosAcademicosUDH = async (codigo) => {
  const url = `http://www.udh.edu.pe/websauh/secretaria_general/gradosytitulos/datos_estudiante_json.aspx?_c_3456=${codigo}`;

  try {
    const { data } = await axios.get(url, { timeout: 5000 });

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No se encontraron datos');
    }

    const info = data[0];

    return {
      nombre_completo: `${info.stu_nombres} ${info.stu_apellido_paterno} ${info.stu_apellido_materno}`,
      facultad: info.stu_facultad,
      programa: info.stu_programa
    };
  } catch (error) {
    console.error(`❌ Error con código ${codigo}:`, error.message);
    return null; 
  }
};

module.exports = { getDatosAcademicosUDH };

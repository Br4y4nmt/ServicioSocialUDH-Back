const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configuración del almacenamiento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'evidencias');
  
      // Verifica si el directorio existe, si no lo crea
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
  
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  });
  

const upload = multer({ storage: storage });

module.exports = upload;

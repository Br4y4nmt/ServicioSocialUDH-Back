const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const SystemConfig = require('../models/SystemConfig');

(async () => {
  try {
    await sequelize.authenticate();

    const plainPassword = "serviciosocial2025"; 
    const hash = await bcrypt.hash(plainPassword, 10);

    await SystemConfig.create({
      master_password_hash: hash
    });

    console.log("✅ Clave maestra insertada con éxito");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error insertando clave maestra:", err);
    process.exit(1);
  }
})();

const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({
	destination: function (req, file, cb) {

		const dir = path.join(
			__dirname,
			'..',
			'uploads',
			'documentos'
		);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, {
				recursive: true
			});
		}
		cb(null, dir);
	},
	filename: function (req, file, cb) {
		const unique =
			Date.now() +
			'-' +
			Math.round(Math.random() * 1e9);
		cb(null, unique + '.pdf');
	}
});

const fileFilter = (req, file, cb) => {
	const extension = path
		.extname(file.originalname)
		.toLowerCase();
	if (
		file.mimetype !== 'application/pdf' ||
		extension !== '.pdf'
	) {
		return cb(
			new Error('Solo se permiten archivos PDF'),
			false
		);
	}
	cb(null, true);
};

const uploadDocumento = multer({
	storage,
	fileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024
	}
});

module.exports = uploadDocumento;
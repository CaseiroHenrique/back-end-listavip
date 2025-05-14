
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { connect } = require('../config/database');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    const fileTypes = /png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Error: Somente arquivos PNG são permitidos!');
    }
};

const upload = multer({ storage, fileFilter });

router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Nenhum arquivo enviado!' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ message: 'Upload bem-sucedido', imageUrl: filePath });
});

router.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

module.exports = router;

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { connect } = require('./config/database'); 
const router = express.Router();

const imagesDir = path.join(__dirname, 'images');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

router.post('/product/:id/upload-image', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const image = req.file;

    if (!image) {
        return res.status(400).json({ status: 'failed', msg: 'Nenhuma imagem enviada.' });
    }

    try {
        const connection = await connect();
        await connection.query('UPDATE product_list SET image_path = ? WHERE id = ?', [image.filename, id]);
        await connection.end();

        res.json({ status: 'success', message: 'Imagem enviada com sucesso.', imagePath: `/images/${image.filename}` });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ status: 'failed', msg: error.message });
    }
});

module.exports = {
    router,
    imagesDir
};

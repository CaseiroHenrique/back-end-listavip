// routes/Upload.js
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();

// Storage em /uploads (pasta na raiz do projeto)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ storage });

// POST /api/upload
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Nenhum arquivo enviado!' });
  }
  // Retorna o caminho que agora será servido por app.use('/uploads', ...)
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ message: 'Upload bem-sucedido', imageUrl });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

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

// agora aceitamos multipart/form-data com campo 'event_image'
router.post('/create-event', upload.single('event_image'), async (req, res) => {
  const {
    company_id,
    event_name,
    event_date,
    event_time,
    event_description,
    event_type,
    event_location,
    max_capacity,
    category,
    event_color,
    additional_images,
    attractions,
    tickets,
    social_links,
    event_batch,
    guest_list
  } = req.body;

  // Monta a URL da imagem (ou usa a que vier no body, se não mandaram arquivo)
  const event_image_url = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body.event_image_url || null);

  if (!company_id || !event_name || !event_date || !event_type) {
    return res.status(400).json({
      message: 'company_id, event_name, event_date e event_type são obrigatórios.'
    });
  }

  try {
    const pool = await connect();
    const insertQuery = `
      INSERT INTO events (
        company_id,
        event_name,
        event_date,
        event_time,
        event_description,
        event_type,
        event_location,
        max_capacity,
        category,
        event_color,
        event_image_url,
        additional_images,
        attractions,
        tickets,
        social_links,
        event_batch,
        guest_list,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const params = [
      company_id,
      event_name,
      event_date,
      event_time || null,
      event_description || null,
      event_type,
      event_location || null,
      max_capacity || null,
      category || null,
      event_color || '#E1FF01',
      event_image_url,
      additional_images ? JSON.stringify(additional_images) : null,
      attractions ? JSON.stringify(attractions) : null,
      tickets ? JSON.stringify(tickets) : null,
      social_links ? JSON.stringify(social_links) : null,
      event_batch || 'inactive',
      guest_list || 'inactive'
    ];

    const [result] = await pool.query(insertQuery, params);
    res.status(201).json({
      message: 'Evento criado com sucesso!',
      eventId: result.insertId,
      imageUrl: event_image_url
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao criar o evento.' });
  }
});


// GET /api/event/:event_id
router.get('/event/:event_id', async (req, res) => {
  const { event_id } = req.params;
  if (!event_id) {
    return res.status(400).json({ message: 'O ID do evento é obrigatório.' });
  }

  try {
    const pool = await connect();

    const [rows] = await pool.query(
      `SELECT
         id,
         company_id,
         event_name,
         event_date,
         event_time,
         event_description,
         event_type,
         event_location,
         max_capacity,
         category,
         event_color,
         event_image_url,
         additional_images,
         attractions,
         tickets,
         social_links,
         event_batch,
         guest_list,
         confirmed_participants,
         view_count,
         created_at,
         updated_at
       FROM events
       WHERE id = ?`,
      [event_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const event = rows[0];
    // converte JSON strings em objetos/arrays
    event.additional_images = event.additional_images ? JSON.parse(event.additional_images) : [];
    event.attractions       = event.attractions       ? JSON.parse(event.attractions)       : [];
    event.tickets           = event.tickets           ? JSON.parse(event.tickets)           : {};
    event.social_links      = event.social_links      ? JSON.parse(event.social_links)      : {};

    res.status(200).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar o evento.' });
  }
});

// PUT /api/event/:event_id
router.put('/event/:event_id', async (req, res) => {
  const { event_id } = req.params;
  const {
    event_name,
    event_date,
    event_time,
    event_description,
    event_type,
    event_location,
    max_capacity,
    category,
    event_color,
    event_image_url,
    additional_images,
    attractions,
    tickets,
    social_links,
    event_batch,
    guest_list
  } = req.body;

  if (!event_id || !event_name || !event_date || !event_type) {
    return res.status(400).json({ message: 'event_id, event_name, event_date e event_type são obrigatórios.' });
  }

  try {
    const pool = await connect();

    const updateQuery = `
      UPDATE events SET
        event_name         = ?,
        event_date         = ?,
        event_time         = ?,
        event_description  = ?,
        event_type         = ?,
        event_location     = ?,
        max_capacity       = ?,
        category           = ?,
        event_color        = ?,
        event_image_url    = ?,
        additional_images  = ?,
        attractions        = ?,
        tickets            = ?,
        social_links       = ?,
        event_batch        = ?,
        guest_list         = ?,
        updated_at         = NOW()
      WHERE id = ?
    `;

    const params = [
      event_name,
      event_date,
      event_time || null,
      event_description || null,
      event_type,
      event_location || null,
      max_capacity || null,
      category || null,
      event_color || '#E1FF01',
      event_image_url || null,
      additional_images ? JSON.stringify(additional_images) : null,
      attractions       ? JSON.stringify(attractions)       : null,
      tickets           ? JSON.stringify(tickets)           : null,
      social_links      ? JSON.stringify(social_links)      : null,
      event_batch   || 'inactive',
      guest_list    || 'inactive',
      event_id
    ];

    const [result] = await pool.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    res.status(200).json({ message: 'Evento atualizado com sucesso!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao atualizar o evento.' });
  }
});

module.exports = router;

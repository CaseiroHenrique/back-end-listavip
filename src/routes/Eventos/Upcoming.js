const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');


router.get('/upcoming-events', async (req, res) => {
  console.log('📣 GET /upcoming-events recebido — query:', req.query);
  const db = req.db;
  const limit = parseInt(req.query.limit, 10) || 3;

  try {
    // seleciona eventos cuja data >= hoje, ordenados pela data mais próxima
    const [rows] = await db.query(
      `SELECT
         id,
         event_name AS title,
         event_description AS description,
         event_image_url AS image,
         event_date,
         event_time
       FROM events
       WHERE event_date >= CURDATE()
       ORDER BY event_date ASC
       LIMIT ?`,
      [limit]
    );

    res.json({ upcoming: rows });
  } catch (err) {
    console.error('Erro ao buscar upcoming-events:', err);
    res.status(500).json({ message: 'Erro interno' });
  }
});



module.exports = router;
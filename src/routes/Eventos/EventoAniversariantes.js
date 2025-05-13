const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/create-birthday', async (req, res) => {
    const { company_id, event_id, name, whatsapp } = req.body;

    if (!company_id || !event_id || !name || !whatsapp) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    const generateToken = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 5; i++) {
            token += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return token;
    };

    const token = generateToken();

    try {
        const pool = await connect();

        const [result] = await pool.query(
            `INSERT INTO birthdays (company_id, event_id, name, whatsapp, token, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [company_id, event_id, name, whatsapp, token]
        );

        res.status(201).json({ message: 'Aniversariante criado com sucesso!', birthdayId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar o aniversariante.' });
    }
});

router.get('/birthday-details/:id', async (req, res) => {
    const { id } = req.params;
    const companyId = req.headers['companyid']; // Pegando o companyId do cabeçalho

    if (!companyId) {
        return res.status(400).json({ message: 'Company ID não fornecido.' });
    }

    try {
        const pool = await connect();

        const [rows] = await pool.query(
            `SELECT 
            (SELECT COUNT(*) FROM event_participations ep WHERE ep.token_aniversary = b.token) AS guests_count,
            (SELECT COUNT(*) FROM event_participations ep 
             WHERE ep.token_aniversary = b.token 
               AND (ep.status = 'Confirmado' OR ep.status = 'Pagamento Antecipado')
            ) AS confirmed_guests,
            b.token, 
            c.fantasy_name 
         FROM birthdays b 
         JOIN companies c ON c.id = b.company_id
         WHERE b.id = ? AND c.id = ?`,
            [id, companyId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Aniversariante ou empresa não encontrados.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar os detalhes do aniversariante.' });
    }
});


router.get('/list-events/:company_id', async (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ message: 'O ID da empresa é obrigatório.' });
  }

  try {
    const pool = await connect();

    const [events] = await pool.query(
      `SELECT 
         id,
         event_name      AS title,
         event_image_url AS image,
         event_date      AS date
       FROM events
       WHERE company_id = ?
       ORDER BY event_date DESC`,
      [company_id]
    );

    if (events.length === 0) {
      return res.status(404).json({ message: 'Nenhum evento encontrado para esta empresa.' });
    }

    // Se quiser convertê-los em objetos mais amigáveis ao front:
    const formatted = events.map(evt => ({
      id: evt.id,
      title: evt.title,
      image: evt.image,    // pode ser null ou URL
      date: evt.date       // string YYYY-MM-DD
    }));

    res.status(200).json({ events: formatted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar os eventos.' });
  }
});

router.get('/list-birthdays/:company_id', async (req, res) => {
    const { company_id } = req.params;

    if (!company_id) {
        return res.status(400).json({ message: 'O ID da empresa é obrigatório.' });
    }

    try {
        const pool = await connect();

        const [birthdays] = await pool.query(
            `SELECT 
                b.id, 
                b.company_id, 
                b.event_id, 
                b.name, 
                b.whatsapp, 
                b.created_at, 
                b.updated_at,
                e.event_image_url,  -- Pegamos a imagem do evento
                e.event_date        -- Pegamos a data do evento
            FROM birthdays b
            JOIN events e ON b.event_id = e.id
            WHERE b.company_id = ?
             ORDER BY event_date DESC`,
            [company_id]
        );

        if (birthdays.length === 0) {
            return res.status(404).json({ message: 'Nenhum aniversariante encontrado para esta empresa.' });
        }

        res.status(200).json({ birthdays });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar os aniversariantes.' });
    }
});




module.exports = router;
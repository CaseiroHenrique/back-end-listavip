const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/create-event', async (req, res) => {
    const {
        company_id, event_name, event_date, event_type, category, ticket_price_men,
        ticket_price_women, event_color, event_image_url, attractions, // Adiciona as atrações aqui
        event_batch, guest_list // Novas colunas
    } = req.body;

    if (!company_id || !event_name || !event_date || !event_type) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const pool = await connect();

        const [result] = await pool.query(
            `INSERT INTO events (company_id, event_name, event_date, event_type, category,
                ticket_price_men, ticket_price_women, event_color, event_image_url, attractions, 
                event_batch, guest_list, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                company_id,
                event_name,
                event_date,
                event_type,
                category || null,
                ticket_price_men || 0,
                ticket_price_women || 0,
                event_color || '#E1FF01',
                event_image_url || null,
                attractions ? attractions.join(', ') : null,  // Salva as atrações como uma string separada por vírgulas
                event_batch || 'inactive', // Adiciona o valor de event_batch, padrão 'inactive'
                guest_list || 'inactive' // Adiciona o valor de guest_list, padrão 'inactive'
            ]
        );

        res.status(201).json({ message: 'Evento criado com sucesso!', eventId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao criar o evento.' });
    }
});

router.get('/event/:event_id', async (req, res) => {
    const { event_id } = req.params;

    if (!event_id) {
        return res.status(400).json({ message: 'O ID do evento é obrigatório.' });
    }

    try {
        const pool = await connect();

        const [eventData] = await pool.query(
            `SELECT id, company_id, event_name, event_date, event_type, category, ticket_price_men,
                    ticket_price_women, event_color, event_image_url, attractions, event_batch, guest_list 
             FROM events 
             WHERE id = ?`,
            [event_id]
        );

        if (eventData.length === 0) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }

        const event = eventData[0];
        res.status(200).json(event);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao buscar o evento.' });
    }
});

router.put('/event/:event_id', async (req, res) => {
    const { event_id } = req.params;
    const {
        event_name, event_date, event_type, category, ticket_price_men,
        ticket_price_women, event_color, event_image_url, attractions, 
        event_batch, guest_list
    } = req.body;

    if (!event_id || !event_name || !event_date || !event_type) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const pool = await connect();

        const formattedAttractions = Array.isArray(attractions)
            ? attractions.join(', ')
            : attractions || null;

        const [result] = await pool.query(
            `UPDATE events 
             SET event_name = ?, event_date = ?, event_type = ?, category = ?, 
                 ticket_price_men = ?, ticket_price_women = ?, event_color = ?, 
                 event_image_url = ?, attractions = ?, event_batch = ?, guest_list = ?, 
                 updated_at = NOW()
             WHERE id = ?`,
            [
                event_name,
                event_date,
                event_type,
                category || null,
                ticket_price_men || 0,
                ticket_price_women || 0,
                event_color || '#E1FF01',
                event_image_url || null,
                formattedAttractions,
                event_batch || 'inactive',
                guest_list || 'inactive',
                event_id
            ]
        );

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

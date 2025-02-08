const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/list-events-by-fantasy-name-aniversary', async (req, res) => {
    const { fantasy_name, token } = req.body;

    if (!fantasy_name) {
        return res.status(400).json({ message: 'Nome fantasia é obrigatório.' });
    }

    if (!token) {
        return res.status(400).json({ message: 'Token é obrigatório.' });
    }

    try {
        const pool = await connect();

        const [company] = await pool.query(
            `SELECT id, background_color, logo_url, background_url, blur_effect 
             FROM companies 
             WHERE fantasy_name = ?`,
            [fantasy_name]
        );

        if (company.length === 0) {
            return res.status(404).json({ message: 'Nenhuma empresa encontrada com esse nome fantasia.' });
        }

        const company_id = company[0].id;
        const companyDetails = {
            background_color: company[0].background_color,
            logo_url: company[0].logo_url,
            background_url: company[0].background_url,
            blur_effect: company[0].blur_effect,
        };

        const [events] = await pool.query(
            `SELECT 
                 e.id, 
                 e.company_id, 
                 e.event_name, 
                 e.event_date, 
                 e.event_type, 
                 e.category, 
                 e.attractions, 
                 e.ticket_price_men, 
                 e.ticket_price_women, 
                 e.event_color, 
                 e.event_image_url, 
                 e.created_at, 
                 e.updated_at, 
                 e.event_batch, 
                 e.guest_list, 
                 b.name AS birthday_name, 
                 b.whatsapp AS birthday_whatsapp, 
                 b.guests_count, 
                 b.confirmed_guests
             FROM events e
             INNER JOIN birthdays b ON e.id = b.event_id
             WHERE e.company_id = ? 
               AND e.event_date >= CURDATE() 
               AND b.token = ?`,
            [company_id, token]
        );



        if (events.length === 0) {
            return res.status(404).json({ message: 'Nenhum evento futuro encontrado para essa empresa.' });
        }

        res.status(200).json({
            company: companyDetails,
            events: events,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar os eventos.' });
    }
});


module.exports = router;
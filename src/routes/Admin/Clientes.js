const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database'); 

router.get('/company-info', async (req, res) => {
    try {
        const pool = await connect();

        // Consultar informações de todas as empresas, incluindo contagem de eventos
        const [companiesData] = await pool.query(`
            SELECT 
                c.id,
                c.fantasy_name,
                c.created_at AS registration_date,
                c.subscription_status AS status,
                c.subscription_end AS last_payment,
                (SELECT COUNT(*) FROM events e WHERE e.company_id = c.id) AS event_count
            FROM 
                companies c
        `);

        res.status(200).json(companiesData);

    } catch (error) {
        console.error("Erro ao buscar informações das empresas", error);
        res.status(500).json({ message: "Erro ao buscar informações das empresas." });
    }
});

module.exports = router;

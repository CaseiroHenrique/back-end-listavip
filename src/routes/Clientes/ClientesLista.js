
const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.get('/clients-list', async (req, res) => {
    const { company_id } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'company_id é obrigatório' });
    }

    try {
        const pool = await connect();

        const [clients] = await pool.query(
            'SELECT id, name, phone, gender, visits_count, last_visit FROM clients WHERE company_id = ?',
            [company_id]
        );

        res.json(clients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao listar clientes' });
    }
});

module.exports = router;

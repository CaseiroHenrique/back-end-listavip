const express = require('express');
const router = express.Router();
const { connect } = require('../config/database');

router.post('/increment-view', async (req, res) => {
    const { event_id } = req.body;
    if (!event_id) {
        return res.status(400).json({ message: 'Event ID é obrigatório.' });
    }

    try {
        const pool = await connect();

        await pool.query(
            `UPDATE events SET view_count = view_count + 1 WHERE id = ?`,
            [event_id]
        );

        res.status(200).json({ message: 'Visualização contabilizada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao atualizar a contagem de visualizações.' });
    }
});

module.exports = router;
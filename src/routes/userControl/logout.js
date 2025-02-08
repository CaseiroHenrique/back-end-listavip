const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { connect } = require('../../config/database'); // Conexão com o banco

router.post('/logout', async (req, res) => {
    const { sessionToken } = req.body;

    try {
        const pool = await connect();

        await pool.query(
            'UPDATE users SET session_token = NULL, session_expiry = NULL WHERE session_token = ?',
            [sessionToken]
        );

        res.json({ message: 'Logout bem-sucedido' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;

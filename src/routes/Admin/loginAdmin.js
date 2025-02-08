const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { connect } = require('../../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'wJ00hsoylzVcDfsoU9MuC6FMOqg2-XI0ZkpvHQ43uro';

router.post('/login-admin', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const pool = await connect();

        const [rows] = await pool.query(
            `SELECT * FROM admin_users WHERE username = ?`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET);

        res.status(200).json({ message: 'Login realizado com sucesso.', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao realizar o login.' });
    }
});

module.exports = router;

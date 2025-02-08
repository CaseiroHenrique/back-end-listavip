const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { connect } = require('../../config/database');

const jwtSecret = 'q9sM4Yj$NkF8&xZP3v6T!cH9QpL7jRf';

router.post('/reconnect', async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await connect();

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const dbUser = users[0];

        const isPasswordValid = await bcrypt.compare(password, dbUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        const sessionToken = jwt.sign({ userId: dbUser.id }, jwtSecret, { expiresIn: '1h' });

        await pool.query(
            'UPDATE users SET session_token = ?, session_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
            [sessionToken, dbUser.id]
        );

        res.json({ message: 'Usuário desconectado e reconectado', sessionToken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;

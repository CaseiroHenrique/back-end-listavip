const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { connect } = require('../../config/database'); 

router.post('/register', async (req, res) => {

    const { full_name, email, password } = req.body;

    try {
        const pool = await connect();

        const [userExists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(400).json({ message: 'Email já está em uso' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
            [full_name, email, hashedPassword]
        );

        res.status(201).json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;

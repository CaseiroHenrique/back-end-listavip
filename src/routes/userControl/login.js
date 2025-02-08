const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { connect } = require('../../config/database');

const jwtSecret = 'q9sM4Yj$NkF8&xZP3v6T!cH9QpL7jRf';

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await connect();

        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const dbUser = users[0];

        if (dbUser.role === 'Promoter') {
            return res.status(403).json({ message: 'Acesso negado para promoters nesta rota.' });
        }

        const isPasswordValid = await bcrypt.compare(password, dbUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        const [companies] = await pool.query('SELECT * FROM companies WHERE id = ?', [dbUser.company_id]);
        if (companies.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada.' });
        }

        const company = companies[0];
        if (company.subscription_status !== 'active' || new Date(company.subscription_end) < new Date()) {
            return res.status(403).json({ message: 'A empresa do usuário não possui uma assinatura ativa.' });
        }

        const sessionToken = jwt.sign({ userId: dbUser.id }, jwtSecret, { expiresIn: '1h' });
        await pool.query(
            'UPDATE users SET session_token = ?, session_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
            [sessionToken, dbUser.id]
        );

        res.json({
            message: 'Login bem-sucedido',
            sessionToken,
            full_name: dbUser.full_name,
            company_id: dbUser.company_id,
            role: dbUser.role,
            company_name: company.fantasy_name,
            subscription_status: company.subscription_status,
            subscription_end: company.subscription_end
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;

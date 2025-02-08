const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { connect } = require('../../config/database');

const jwtSecret = 'q9sM4Yj$NkF8&xZP3v6T!cH9QpL7jRf';

router.post('/login-promoter', async (req, res) => {
    const { email, password, fantasy_name } = req.body;

    try {
        const pool = await connect();

        const [promoters] = await pool.query('SELECT * FROM promoters WHERE email = ?', [email]);
        if (promoters.length === 0) {
            return res.status(404).json({ message: 'Promoter não encontrado' });
        }

        const dbPromoter = promoters[0];

        if (dbPromoter.status !== 'accepted') {
            return res.status(403).json({ message: 'Acesso negado. Promoter ainda não foi aprovado.' });
        }

        const isPasswordValid = await bcrypt.compare(password, dbPromoter.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        const [companies] = await pool.query('SELECT * FROM companies WHERE id = ? AND fantasy_name = ?', [dbPromoter.company_id, fantasy_name]);
        if (companies.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada.' });
        }

        const company = companies[0];

        if (company.subscription_status !== 'active' || new Date(company.subscription_end) < new Date()) {
            return res.status(403).json({ message: 'A empresa não possui uma assinatura ativa.' });
        }

        const sessionToken = jwt.sign({ promoterId: dbPromoter.id }, jwtSecret, { expiresIn: '1h' });
        await pool.query(
            'UPDATE promoters SET session_token = ?, session_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
            [sessionToken, dbPromoter.id]
        );

        res.json({
            message: 'Login de promoter bem-sucedido',
            sessionToken,
            full_name: dbPromoter.full_name,
            company_id: dbPromoter.company_id,
            company_name: company.fantasy_name,
            subscription_status: company.subscription_status,
            subscription_end: company.subscription_end,
            promoterId: dbPromoter.id // Inclui o ID do promoter
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor' });
    }
});

module.exports = router;

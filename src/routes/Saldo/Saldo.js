const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.get('/participations/total-revenue', async (req, res) => {
    const { company_id, month, year } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'company_id é obrigatório' });
    }

    try {
        const pool = await connect();

        // Consulta informações da empresa
        const [[company]] = await pool.query(
            `SELECT balance, withdraw_requests_rejected, withdraw_requests_approved, withdraw_requests_total 
             FROM companies 
             WHERE id = ?`,
            [company_id]
        );

        if (!company) {
            return res.status(404).json({ message: 'Empresa não encontrada.' });
        }

        // Consulta de informações sobre eventos
        const [events] = await pool.query(
            'SELECT id, ticket_price_men, ticket_price_women FROM events WHERE company_id = ?',
            [company_id]
        );

        if (events.length === 0) {
            return res.status(404).json({ message: 'Nenhum evento encontrado para o company_id fornecido.' });
        }

        let totalRevenueMen = 0;
        let totalRevenueWomen = 0;

        // Calcula o total de receita
        for (const event of events) {
            const [participations] = await pool.query(
                `SELECT c.gender
                 FROM event_participations ep
                 JOIN clients c ON ep.client_id = c.id
                 WHERE ep.event_id = ? AND ep.status = 'Pagamento Antecipado'`,
                [event.id]
            );

            participations.forEach(participation => {
                if (participation.gender === 'male') {
                    totalRevenueMen += parseFloat(event.ticket_price_men);
                } else if (participation.gender === 'female') {
                    totalRevenueWomen += parseFloat(event.ticket_price_women);
                }
            });
        }

        const totalRevenue = (totalRevenueMen + totalRevenueWomen).toFixed(2);

        // Filtro para o mês e ano, se forem fornecidos
        let filterDateQuery = '';
        const filterParams = [company_id];

        if (year) {
            filterDateQuery += ' AND YEAR(wr.request_date) = ?';
            filterParams.push(year);
        }

        if (month) {
            filterDateQuery += ' AND MONTH(wr.request_date) = ?';
            filterParams.push(month);
        }

        const [withdrawRequests] = await pool.query(
            `SELECT wr.amount, wr.status, wr.request_date, u.full_name AS user_name 
     FROM withdraw_requests wr
     JOIN users u ON wr.user_id = u.id
     WHERE wr.company_id = ? ${filterDateQuery}
     ORDER BY wr.request_date DESC`,
            filterParams
        );

        res.json({
            totalRevenue: {
                men: totalRevenueMen.toFixed(2),
                women: totalRevenueWomen.toFixed(2),
                total: totalRevenue
            },
            balance: (company.balance !== null ? parseFloat(company.balance) : 0).toFixed(2),
            withdrawStats: {
                total_requests: company.withdraw_requests_total ?? 0,
                total_rejected: company.withdraw_requests_rejected ?? 0,
                total_accepted: company.withdraw_requests_approved ?? 0
            },
            withdrawRequests: withdrawRequests.map(request => ({
                user_name: request.user_name,
                amount: parseFloat(request.amount).toFixed(2),
                status: request.status,
                request_date: request.request_date
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao calcular o faturamento total' });
    }
});

router.get('/user-info', async (req, res) => {
    const { session_token, company_id } = req.query;

    if (!session_token || !company_id) {
        return res.status(400).json({ message: 'session_token e company_id são obrigatórios' });
    }

    try {
        const pool = await connect();

        const [users] = await pool.query(
            `SELECT full_name, chave_pix, company_id FROM users WHERE session_token = ?`,
            [session_token]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const user = users[0];

        if (user.company_id !== parseInt(company_id, 10)) {
            return res.status(403).json({ message: 'Acesso negado: company_id não corresponde.' });
        }

        res.json({
            full_name: user.full_name,
            chave_pix: user.chave_pix,
            company_id: user.company_id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao buscar informações do usuário' });
    }
});

router.post('/set-pix-key', async (req, res) => {
    const { session_token, company_id, chave_pix } = req.body;

    if (!session_token || !company_id || !chave_pix) {
        return res.status(400).json({ message: 'session_token, company_id e chave_pix são obrigatórios' });
    }

    try {
        const pool = await connect();

        const [users] = await pool.query(
            `SELECT id, company_id FROM users WHERE session_token = ?`,
            [session_token]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const user = users[0];

        if (user.company_id !== parseInt(company_id, 10)) {
            return res.status(403).json({ message: 'Acesso negado: company_id não corresponde.' });
        }

        await pool.query(
            `UPDATE users SET chave_pix = ? WHERE id = ?`,
            [chave_pix, user.id]
        );

        res.json({ message: 'Chave PIX definida com sucesso!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao definir a chave PIX' });
    }
});

router.post('/create-withdrawal', async (req, res) => {
    const { session_token, company_id, amount } = req.body;

    if (!session_token || !company_id || !amount) {
        return res.status(400).json({ message: 'session_token, company_id e amount são obrigatórios' });
    }

    try {
        const pool = await connect();

        const [users] = await pool.query(
            `SELECT id FROM users WHERE session_token = ? AND company_id = ?`,
            [session_token, company_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado ou empresa não autorizada.' });
        }

        const user_id = users[0].id;

        const [[company]] = await pool.query(
            `SELECT balance, withdraw_requests_total FROM companies WHERE id = ?`,
            [company_id]
        );

        if (!company) {
            return res.status(404).json({ message: 'Empresa não encontrada.' });
        }

        if (parseFloat(company.balance) < parseFloat(amount)) {
            return res.status(400).json({ message: 'Saldo insuficiente para o saque solicitado.' });
        }

        await pool.query(
            `UPDATE companies 
             SET balance = balance - ?, withdraw_requests_total = withdraw_requests_total + 1 
             WHERE id = ?`,
            [parseFloat(amount), company_id]
        );

        await pool.query(
            `INSERT INTO withdraw_requests (user_id, amount, status, request_date, company_id) 
             VALUES (?, ?, 'pending', NOW(), ?)`,
            [user_id, parseFloat(amount), company_id]
        );

        res.json({ message: 'Solicitação de saque criada com sucesso.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao processar a solicitação de saque.' });
    }
});


module.exports = router;

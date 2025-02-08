const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.get('/payment-method-metrics', async (req, res) => {
    try {
        const pool = await connect();
        const { month, year } = req.query;

        const [metricsData] = await pool.query(`
            SELECT 
                u.payment_method, 
                COUNT(*) AS count,
                COALESCE(SUM(t.transaction_value), 0) AS total_revenue
            FROM 
                users u
            LEFT JOIN 
                transaction_history t ON u.id = t.user_id
            WHERE 
                u.payment_method IN ('Cartão de crédito', 'Pix')
                AND MONTH(t.transaction_date) = ?
                AND YEAR(t.transaction_date) = ?
            GROUP BY 
                u.payment_method
        `, [month, year]);

        const result = {
            'Cartão de crédito': {
                count: 0,
                total_revenue: 0.00
            },
            'Pix': {
                count: 0,
                total_revenue: 0.00
            }
        };

        metricsData.forEach(row => {
            result[row.payment_method].count = row.count;
            result[row.payment_method].total_revenue = row.total_revenue;
        });

        res.status(200).json(result);
    } catch (error) {
        console.error("Erro ao buscar métricas de métodos de pagamento", error);
        res.status(500).json({ message: "Erro ao buscar métricas de métodos de pagamento." });
    }
});

router.get('/client-metrics', async (req, res) => {
    try {
        const pool = await connect();
        const { month, year } = req.query;

        const currentDate = new Date();

        const [totalClientsData] = await pool.query(`
            SELECT 
                COUNT(*) AS total_clients 
            FROM 
                users
        `);

        const [activeClientsData] = await pool.query(`
            SELECT 
                COUNT(*) AS active_clients 
            FROM 
                users 
            WHERE 
                subscription_start IS NOT NULL 
                AND subscription_end IS NOT NULL
                AND subscription_start <= ? 
                AND subscription_end >= ?
        `, [currentDate, currentDate]);

        const [nonRenewedClientsData] = await pool.query(`
            SELECT 
                COUNT(*) AS non_renewed_clients 
            FROM 
                users 
            WHERE 
                subscription_end IS NOT NULL 
                AND MONTH(subscription_end) = ? 
                AND YEAR(subscription_end) = ?
                AND subscription_end < ?
        `, [month, year, currentDate]);

        const result = [
            { metric: "Quantidade de Clientes", quantity: totalClientsData[0].total_clients },
            { metric: "Clientes Ativos", quantity: activeClientsData[0].active_clients },
            { metric: "Clientes Não Renovados", quantity: nonRenewedClientsData[0].non_renewed_clients }
        ];

        res.status(200).json(result);
    } catch (error) {
        console.error("Erro ao buscar métricas de clientes", error);
        res.status(500).json({ message: "Erro ao buscar métricas de clientes." });
    }
});

router.get('/event-metrics', async (req, res) => {
    try {
        const pool = await connect();
        const { month, year } = req.query;

        const [totalEventsData] = await pool.query(`
            SELECT COUNT(*) AS total_events
            FROM events
            WHERE MONTH(event_date) = ? AND YEAR(event_date) = ?
        `, [month, year]);

        const [completedEventsData] = await pool.query(`
            SELECT COUNT(*) AS completed_events
            FROM events
            WHERE event_date < NOW()
            AND MONTH(event_date) = ? AND YEAR(event_date) = ?
        `, [month, year]);

        const [ongoingEventsData] = await pool.query(`
            SELECT COUNT(*) AS ongoing_events
            FROM events
            WHERE event_date >= NOW()
            AND MONTH(event_date) = ? AND YEAR(event_date) = ?
        `, [month, year]);

        const result = [
            { metric: "Total de Eventos Realizados", quantity: totalEventsData[0].total_events },
            { metric: "Eventos Concluídos com Sucesso", quantity: completedEventsData[0].completed_events },
            { metric: "Eventos em Andamento", quantity: ongoingEventsData[0].ongoing_events }
        ];

        res.status(200).json(result);
    } catch (error) {
        console.error("Erro ao buscar métricas de eventos", error);
        res.status(500).json({ message: "Erro ao buscar métricas de eventos." });
    }
});

module.exports = router;

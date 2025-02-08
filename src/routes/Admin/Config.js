const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

// Rota para buscar configurações
// Rota para buscar configurações
router.get('/config', async (req, res) => {
    try {
        const pool = await connect();
        const [configData] = await pool.query(`
            SELECT 
                mercado_pago_access_token AS accessToken,
                mercado_pago_client_id AS clientId,
                mercado_pago_client_secret AS clientSecret,
                service_fee AS serviceFee,
                plans
            FROM 
                config
            LIMIT 1
        `);

        if (!configData.length) {
            return res.status(404).json({ message: "Configurações não encontradas." });
        }

        // Parsear os planos para retornar como JSON
        const config = configData[0];
        const plans = config.plans ? JSON.parse(config.plans) : {};

        // Renomear chaves para o frontend
        const normalizedPlansConfig = {
            basic: plans["basic"] || plans["básico"],
            intermediate: plans["intermediate"] || plans["intermediário"],
            corporate: plans["corporate"] || plans["corporativo"]
        };

        res.status(200).json({
            accessToken: config.accessToken,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            serviceFee: config.serviceFee,
            plansConfig: normalizedPlansConfig
        });
    } catch (error) {
        console.error("Erro ao buscar configurações", error);
        res.status(500).json({ message: "Erro ao buscar configurações." });
    }
});

// Rota para buscar somente os planos
router.get('/plans', async (req, res) => {
    try {
        const pool = await connect();
        const [configData] = await pool.query(`
            SELECT plans FROM config LIMIT 1
        `);

        if (!configData.length) {
            return res.status(404).json({ message: "Planos não encontrados." });
        }

        const plans = configData[0].plans ? JSON.parse(configData[0].plans) : {};

        const normalizedPlans = {
            basic: plans["basic"] || plans["básico"],
            intermediate: plans["intermediate"] || plans["intermediário"],
            corporate: plans["corporate"] || plans["corporativo"]
        };

        res.status(200).json(normalizedPlans);
    } catch (error) {
        console.error("Erro ao buscar planos", error);
        res.status(500).json({ message: "Erro ao buscar planos." });
    }
});


// Rota para atualizar configurações
router.post('/config', async (req, res) => {
    const { accessToken, clientId, clientSecret, serviceFee, plansConfig } = req.body;

    try {
        const pool = await connect();

        // Atualizar as configurações no banco
        await pool.query(`
            UPDATE config
            SET 
                mercado_pago_access_token = ?,
                mercado_pago_client_id = ?,
                mercado_pago_client_secret = ?,
                service_fee = ?,
                plans = ?
            WHERE 
                id = 1
        `, [accessToken, clientId, clientSecret, serviceFee, JSON.stringify(plansConfig)]);

        res.status(200).json({ message: "Configurações atualizadas com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar configurações", error);
        res.status(500).json({ message: "Erro ao atualizar configurações." });
    }
});

module.exports = router;
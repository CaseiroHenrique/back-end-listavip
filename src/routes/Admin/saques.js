const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.get('/financial-data', async (req, res) => {
    const { mes, ano } = req.query;
    const mesAtual = mes || new Date().getMonth() + 1;
    const anoAtual = ano || new Date().getFullYear(); 

    try {
        const pool = await connect();

        const [solicitacoesTotais] = await pool.query(`
            SELECT 
                COUNT(*) AS total_solicitacoes,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS solicitacoes_pendentes,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS solicitacoes_aprovadas,
                SUM(amount) AS valor_total_solicitacoes
            FROM 
                withdraw_requests
            WHERE 
                MONTH(request_date) = ? AND YEAR(request_date) = ?
        `, [mesAtual, anoAtual]);

        const [listaSolicitacoes] = await pool.query(`
            SELECT 
                w.id AS id,  -- Adicione esta linha
                u.full_name AS nome_usuario,
                w.amount AS valor_requisicao,
                w.status AS status_requisicao,
                w.request_date AS data_solicitacao
            FROM 
                withdraw_requests w
            JOIN 
                users u ON w.user_id = u.id
            WHERE 
                MONTH(w.request_date) = ? AND YEAR(w.request_date) = ?
        `, [mesAtual, anoAtual]);
        

        const [faturamentoDiario] = await pool.query(`
            SELECT 
                DAY(request_date) AS dia,
                SUM(amount) AS valor_faturado
            FROM 
                withdraw_requests
            WHERE 
                MONTH(request_date) = ? AND YEAR(request_date) = ?
            GROUP BY 
                DAY(request_date)
            ORDER BY 
                dia
        `, [mesAtual, anoAtual]);

        res.status(200).json({
            solicitacoesTotais: solicitacoesTotais[0],
            listaSolicitacoes,
            faturamentoDiario
        });
    } catch (error) {
        console.error("Erro ao buscar dados financeiros", error);
        res.status(500).json({ message: "Erro ao buscar dados financeiros" });
    }
});

router.patch('/reject-withdraw-request/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connect();

        const [result] = await pool.query(`
            UPDATE withdraw_requests
            SET status = 'rejected'
            WHERE id = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Solicitação de saque não encontrada." });
        }

        res.status(200).json({ message: "Solicitação de saque recusada com sucesso." });
    } catch (error) {
        console.error("Erro ao recusar solicitação de saque", error);
        res.status(500).json({ message: "Erro ao recusar solicitação de saque" });
    }
});

module.exports = router;

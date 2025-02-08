const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const configureMercadoPago = async () => {
    const pool = await connect();
    const [config] = await pool.query(`SELECT * FROM config LIMIT 1`);
    if (config.length > 0) {
        const accessToken = config[0].mercado_pago_access_token;
        return new MercadoPagoConfig({ accessToken });
    } else {
        throw new Error("Configuração do Mercado Pago não encontrada.");
    }
};

router.patch('/approve-withdraw-request/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connect();
        const mpClient = await configureMercadoPago();
        const paymentClient = new Payment(mpClient);

        const [withdrawRequest] = await pool.query(`
            SELECT w.amount, u.email, u.cpf
            FROM withdraw_requests w
            JOIN users u ON w.user_id = u.id
            WHERE w.id = ? AND w.status = 'pending'
        `, [id]);

        if (withdrawRequest.length === 0) {
            return res.status(404).json({ message: "Solicitação de saque não encontrada ou já processada." });
        }

        const { amount, email, cpf } = withdrawRequest[0];
        const sanitizedCPF = cpf.replace(/\D/g, '');

        const paymentData = {
            transaction_amount: parseFloat(amount),
            payment_method_id: 'pix',
            payer: {
                email: email,
                identification: {
                    type: "CPF",
                    number: sanitizedCPF
                }
            }
        };

        const paymentResponse = await paymentClient.create({ body: paymentData });

        await pool.query(`
                UPDATE withdraw_requests
                SET status = 'accepted'
                WHERE id = ?
            `, [id]);

        res.status(200).json({
            message: "Solicitação de saque processada com sucesso.",
        });

    } catch (error) {
        console.error("Erro ao aprovar solicitação de saque", error);
        res.status(500).json({ message: "Erro ao aprovar solicitação de saque" });
    }
});

module.exports = router;

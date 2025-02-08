const express = require('express');
const axios = require('axios');
const router = express.Router();
const { connect } = require('../../config/database'); 

router.post('/payments/credit-card', async (req, res) => {
    const { token, transaction_amount, installments, payment_method_id, email, doc_type, doc_number } = req.body;

    try {
        const pool = await connect();

        const [config] = await pool.query('SELECT mercado_pago_access_token FROM config LIMIT 1');
        if (config.length === 0) {
            return res.status(500).json({ message: 'Configuração do Mercado Pago não encontrada' });
        }

        const accessToken = config[0].mercado_pago_access_token;

        const response = await axios.post(
            'https://api.mercadopago.com/v1/payments',
            {
                token,
                transaction_amount,
                installments,
                payment_method_id,
                payer: {
                    email,
                    identification: {
                        type: doc_type,
                        number: doc_number,
                    },
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        res.status(200).json(response.data);
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Erro ao processar o pagamento', error: error.response ? error.response.data : error.message });
    }
});

router.get('/payments/status/:id', async (req, res) => {
  const { id } = req.params;

  try {
      const pool = await connect();

      const [config] = await pool.query('SELECT mercado_pago_access_token FROM config LIMIT 1');
      if (config.length === 0) {
          return res.status(500).json({ message: 'Configuração do Mercado Pago não encontrada' });
      }

      const accessToken = config[0].mercado_pago_access_token;

      const response = await axios.get(`https://api.mercadopago.com/v1/payments/${id}`, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
          },
      });

      res.status(200).json(response.data);
  } catch (error) {
      console.error(error.response ? error.response.data : error.message);
      res.status(500).json({ message: 'Erro ao buscar o status do pagamento', error: error.response ? error.response.data : error.message });
  }
});

module.exports = router;

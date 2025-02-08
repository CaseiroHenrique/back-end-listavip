const express = require('express');
const axios = require('axios');
const router = express.Router();
const QRCode = require('qrcode');
const db = require('../config/database');

router.post('/generate-qrcodeticket', async (req, res) => {
  const { name, cpf, phone, gender, email, ticketPriceMen, ticketPriceWomen, eventName } = req.body;

  if (!name || !cpf || !email || !ticketPriceMen || !ticketPriceWomen || !eventName) {
    return res.status(400).json({ error: "Dados insuficientes para gerar QR Code." });
  }

  try {
    const sanitizedCpf = cpf.replace(/\D/g, '');

    const ticketPrice = gender.toLowerCase() === 'masculino' ? ticketPriceMen : ticketPriceWomen;

    const connection = await db.connect();
    const [config] = await connection.query('SELECT * FROM config LIMIT 1');

    if (!config || config.length === 0) {
      connection.end();
      return res.status(500).json({ error: "Configurações de pagamento não encontradas." });
    }

    const accessToken = config[0].mercado_pago_access_token;

    const paymentData = {
      transaction_amount: parseFloat(ticketPrice),
      description: `Pagamento do evento ${eventName}`,
      payment_method_id: "pix",
      payer: {
        email,
        identification: {
          type: "CPF",
          number: sanitizedCpf,
        },
      },
    };

    const response = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      paymentData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const payment = response.data;

    if (payment.point_of_interaction) {
      const qrCodeBase64 = payment.point_of_interaction.transaction_data.qr_code_base64;
      const qrCode = payment.point_of_interaction.transaction_data.qr_code;

      await connection.query(
        `INSERT INTO payment_tempclient (payment_id, client_data, event_name, status)
         VALUES (?, ?, ?, ?)`,
        [payment.id, JSON.stringify({ name, cpf, phone, gender, email }), eventName, payment.status]
      );

      connection.end();

      return res.status(200).json({
        qrCode: `data:image/png;base64,${qrCodeBase64}`,
        pixCopyPaste: qrCode,
        paymentId: payment.id,
        status: payment.status,
      });
    }

    connection.end();
    res.status(500).json({ error: "Falha ao gerar QR Code." });
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.cause?.some(c => c.code === 2067)) {
      return res.status(400).json({
        error: "O CPF fornecido é inválido. Por favor, verifique os dados e tente novamente."
      });
    }

    console.error("Erro ao criar pagamento Mercado Pago", error.response?.data || error);
    res.status(500).json({ error: "Erro interno ao processar pagamento." });
  }
});


router.post('/increment-guest-count', async (req, res) => {
  const { tokenaniversario } = req.body;

  if (!tokenaniversario) {
    return res.status(400).json({ error: "Token do aniversário é obrigatório." });
  }

  try {
    const connection = await db.connect();

    // Verificar se existe um registro na tabela `birthdays` com o token fornecido
    const [birthdayResult] = await connection.query(
      `SELECT id, guests_count FROM birthdays WHERE token = ? LIMIT 1`,
      [tokenaniversario]
    );

    if (birthdayResult.length === 0) {
      connection.end();
      return res.status(404).json({ error: "Aniversário não encontrado para o token fornecido." });
    }

    // Incrementar o valor da coluna `guests_count`
    const updatedGuestsCount = birthdayResult[0].guests_count + 1;

    await connection.query(
      `UPDATE birthdays SET guests_count = ? WHERE token = ?`,
      [updatedGuestsCount, tokenaniversario]
    );

    connection.end();

    return res.status(200).json({
      message: "Contagem de convidados incrementada com sucesso.",
      updatedGuestsCount,
    });
  } catch (error) {
    console.error("Erro ao incrementar contagem de convidados:", error);
    res.status(500).json({ error: "Erro interno ao processar a requisição." });
  }
});

router.post('/check-participation-by-cpf', async (req, res) => {
  const { cpf, eventName } = req.body;

  if (!cpf || !eventName) {
    return res.status(400).json({ error: "Dados insuficientes para verificação." });
  }

  try {
    const sanitizedCpf = cpf;

    const connection = await db.connect();

    const [eventRows] = await connection.query(
      `SELECT id FROM events WHERE event_name = ? ORDER BY event_date DESC LIMIT 1`,
      [eventName]
    );

    if (!eventRows || eventRows.length === 0) {
      console.log("Evento não encontrado.");
      connection.end();
      return res.status(404).json({ error: "Evento não encontrado." });
    }

    const eventId = eventRows[0].id;

    const [clientRows] = await connection.query(
      `SELECT id FROM clients WHERE cpf = ? LIMIT 1`,
      [sanitizedCpf]
    );

    if (!clientRows || clientRows.length === 0) {
      connection.end();
      return res.status(200).json({ message: "Cliente não registrado para este evento." });
    }

    const clientId = clientRows[0].id;

    const [participationRows] = await connection.query(
      `SELECT id FROM event_participations WHERE client_id = ? AND event_id = ? LIMIT 1`,
      [clientId, eventId]
    );

    connection.end();

    if (participationRows && participationRows.length > 0) {
      return res.status(409).json({ message: "Permitido apenas uma compra por CPF." });
    } else {
      console.log("Cliente não registrado para este evento.");
      return res.status(200).json({ message: "Cliente não registrado para este evento." });
    }
  } catch (error) {
    console.error("Erro ao verificar participação:", error);
    return res.status(500).json({ error: "Erro interno ao processar a requisição." });
  }
});


router.get('/payment-statusticket/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  const { token, tokenaniversario } = req.query; // Capturar os tokens da URL, se disponíveis

  if (!paymentId) {
    return res.status(400).json({ error: "ID de pagamento não fornecido." });
  }

  try {
    const connection = await db.connect();

    // Recuperar informações da tabela payment_tempclient
    const [paymentTempData] = await connection.query(
      `SELECT * FROM payment_tempclient WHERE payment_id = ? LIMIT 1`,
      [paymentId]
    );

    if (paymentTempData.length === 0) {
      connection.end();
      return res.status(404).json({ error: "Dados do pagamento não encontrados." });
    }

    const tempData = paymentTempData[0];
    const clientData = JSON.parse(tempData.client_data);
    const { event_name } = tempData;

    const [config] = await connection.query('SELECT mercado_pago_access_token FROM config LIMIT 1');
    const accessToken = config[0].mercado_pago_access_token;

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment = response.data;

    if (payment.status === "approved") {
      const [eventResult] = await connection.query(
        `SELECT id, company_id FROM events WHERE event_name = ? LIMIT 1`,
        [event_name]
      );

      if (eventResult.length === 0) {
        connection.end();
        return res.status(404).json({ message: 'Evento não encontrado.' });
      }

      const event_id = eventResult[0].id;
      const company_id = eventResult[0].company_id;

      const [existingClient] = await connection.query(
        `SELECT id, visits_count FROM clients WHERE company_id = ? AND cpf = ?`,
        [company_id, clientData.cpf]
      );

      let clientId;

      if (existingClient.length > 0) {
        clientId = existingClient[0].id;

        const [existingParticipation] = await connection.query(
          `SELECT id FROM event_participations WHERE client_id = ? AND event_id = ? LIMIT 1`,
          [clientId, event_id]
        );

        if (existingParticipation.length > 0) {
          connection.end();
          return res.status(409).json({ message: 'O cliente já está registrado como participante deste evento.' });
        }

        const updatedVisitsCount = existingClient[0].visits_count + 1;
        await connection.query(
          `UPDATE clients SET visits_count = ?, last_visit = NOW(), updated_at = NOW() WHERE id = ?`,
          [updatedVisitsCount, clientId]
        );
      } else {
        const [result] = await connection.query(
          `INSERT INTO clients (company_id, name, cpf, phone, email, gender, visits_count, last_visit, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
          [company_id, clientData.name, clientData.cpf, clientData.phone, clientData.email, clientData.gender]
        );

        clientId = result.insertId;
      }

      let promoterId = 0; // Valor padrão

      if (token) {

        const [promoterResult] = await connection.query(
          `SELECT id FROM promoters WHERE token = ? LIMIT 1`,
          [token]
        );

        if (promoterResult.length > 0) {
          promoterId = promoterResult[0].id;
        } else {
          console.warn("Token inválido fornecido ou promoter não encontrado:", token);
        }
      } else {
        console.warn("Nenhum token fornecido.");
      }

      // Inserir na tabela event_participations com promoter_id definido
      await connection.query(
        `INSERT INTO event_participations (client_id, event_id, participation_date, status, promoter_id)
           VALUES (?, ?, NOW(), ?, ?)`,
        [clientId, event_id, "Pagamento Antecipado", promoterId]
      );

      // Atualizar o saldo da empresa
      const transactionAmount = parseFloat(payment.transaction_amount.toFixed(2));
      await connection.query(
        `UPDATE companies SET balance = balance + ? WHERE id = ?`,
        [transactionAmount, company_id]
      );

      // Verificar e atualizar a tabela birthdays se tokenaniversario estiver presente
      if (tokenaniversario) {
        const [birthdayResult] = await connection.query(
          `SELECT id, confirmed_guests FROM birthdays WHERE token = ? LIMIT 1`,
          [tokenaniversario]
        );

        if (birthdayResult.length > 0) {
          const updatedConfirmedGuests = birthdayResult[0].confirmed_guests + 1;

          await connection.query(
            `UPDATE birthdays SET confirmed_guests = ? WHERE token = ?`,
            [updatedConfirmedGuests, tokenaniversario]
          );

        } else {
          console.warn(`Nenhum aniversário encontrado para o tokenaniversario: ${tokenaniversario}`);
        }
      }

      const qrData = `https://back-end-listavip-production.up.railway.app/api/validate-entry?client_id=${clientId}&event_id=${event_id}`;
      const qrCodeImage = await QRCode.toDataURL(qrData);

      // Remover os dados temporários
      await connection.query(`DELETE FROM payment_tempclient WHERE payment_id = ?`, [paymentId]);

      connection.end();

      return res.status(200).json({
        message: "Pagamento aprovado",
        qrCodeUrl: qrData,
        qrCodeImage,
        clientName: clientData.name,
        clientCPF: clientData.cpf,
        clientGender: clientData.gender,
        ticketPrice: transactionAmount.toFixed(2).replace('.', ','),
        eventName: event_name,
      });
    }

    connection.end();
    return res.status(200).json({ status: payment.status });
  } catch (error) {
    console.error("Erro ao verificar status do pagamento", error.response?.data || error);
    res.status(500).json({ error: "Erro interno ao verificar status do pagamento." });
  }
});

router.get('/validate-entry', async (req, res) => {
  const { client_id, event_id } = req.query;

  if (!client_id || !event_id) {
    return res.status(400).json({ message: "Parâmetros inválidos." });
  }

  try {
    const connection = await db.connect();

    const [participation] = await connection.query(
      `SELECT status, validated FROM event_participations 
       WHERE client_id = ? AND event_id = ? LIMIT 1`,
      [client_id, event_id]
    );

    if (participation.length === 0) {
      connection.end();
      return res.status(404).json({ message: "Participação não encontrada." });
    }

    const { status, validated } = participation[0];

    if (validated === 1) {
      connection.end();
      return res.status(200).json({ message: "QR Code já foi utilizado para entrada.", status: "QR Code já utilizado" });
    }

    let newStatus = status;
    if (status === "Reservado") {
      newStatus = "Confirmado";
    }

    await connection.query(
      `UPDATE event_participations SET validated = 1, status = ?, updated_at = NOW() 
       WHERE client_id = ? AND event_id = ?`,
      [newStatus, client_id, event_id]
    );

    connection.end();

    return res.status(200).json({ message: newStatus, status: newStatus });
  } catch (error) {
    console.error("Erro ao validar entrada:", error);
    return res.status(500).json({ message: "Erro ao validar entrada.", status: "Erro ao validar entrada" });
  }
});


module.exports = router;
const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');
const QRCode = require('qrcode');

router.post('/add-client', async (req, res) => {
    const { name, cpf, phone, email, gender, event_name, token, tokenaniversario } = req.body;

    if (!name || !cpf || !phone || !gender || !event_name) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    try {
        const pool = await connect();

        const [eventResult] = await pool.query(
            `SELECT id, company_id, event_color, ticket_price_men, ticket_price_women 
         FROM events WHERE event_name = ? LIMIT 1`,
            [event_name]
        );

        if (eventResult.length === 0) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }

        const event_id = eventResult[0].id;
        const company_id = eventResult[0].company_id;
        const fillColor = eventResult[0].event_color;
        const ticketPrice = gender === 'Masculino'
            ? eventResult[0].ticket_price_men
            : eventResult[0].ticket_price_women;
        const formattedTicketPrice = (Number(ticketPrice) || 0)
            .toFixed(2)
            .replace('.', ',');

        let promoterId = 0;
        if (token) {
            const [promoterResult] = await pool.query(
                `SELECT id FROM promoters WHERE token = ? LIMIT 1`,
                [token]
            );
            if (promoterResult.length > 0) {
                promoterId = promoterResult[0].id;
            }
        }

        const [existingClient] = await pool.query(
            `SELECT id, visits_count FROM clients WHERE company_id = ? AND cpf = ?`,
            [company_id, cpf]
        );

        let clientId;

        if (existingClient.length > 0) {
            clientId = existingClient[0].id;

            const [existingParticipation] = await pool.query(
                `SELECT id FROM event_participations WHERE client_id = ? AND event_id = ? LIMIT 1`,
                [clientId, event_id]
            );

            if (existingParticipation.length > 0) {
                return res.status(409).json({ message: 'O cliente já está registrado como participante deste evento.' });
            }

            const updatedVisitsCount = existingClient[0].visits_count;
            await pool.query(
                `UPDATE clients SET visits_count = ?, last_visit = NOW(), updated_at = NOW() WHERE id = ?`,
                [updatedVisitsCount, clientId]
            );
        } else {
            const [result] = await pool.query(
                `INSERT INTO clients (company_id, name, cpf, phone, email, gender, visits_count, last_visit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
                [company_id, name, cpf, phone, email, gender]
            );

            clientId = result.insertId;
        }

        // Inserir apenas uma vez na tabela event_participations
        if (tokenaniversario) {
            await pool.query(
                `INSERT INTO event_participations (client_id, event_id, participation_date, promoter_id, token_aniversary)
           VALUES (?, ?, NOW(), ?, ?)`,
                [clientId, event_id, promoterId, tokenaniversario]
            );
        } else {
            await pool.query(
                `INSERT INTO event_participations (client_id, event_id, participation_date, promoter_id)
           VALUES (?, ?, NOW(), ?)`,
                [clientId, event_id, promoterId]
            );
        }

        const qrData = `https://listavip-back-end-production.up.railway.app/api/validate-entry?client_id=${clientId}&event_id=${event_id}`;
        const qrCodeImage = await QRCode.toDataURL(qrData);

        return res.status(201).json({
            message: 'Cliente criado com sucesso!',
            clientId,
            eventId: event_id,
            status: 'Confirmado',
            qrCodeUrl: qrData,
            qrCodeImage
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao salvar o cliente.' });
    }
});




module.exports = router;

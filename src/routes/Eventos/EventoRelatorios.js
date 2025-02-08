const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');
const moment = require('moment');

router.post('/event-info', async (req, res) => {
  const { company_id, event_id } = req.body;

  if (!company_id || !event_id) {
    return res.status(400).json({ message: 'company_id e event_id são obrigatórios.' });
  }

  try {
    const pool = await connect();

    const [eventData] = await pool.query(
      `SELECT event_name, category, event_date, created_at, ticket_price_men, ticket_price_women
       FROM events 
       WHERE id = ? AND company_id = ?`,
      [event_id, company_id]
    );

    if (eventData.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }

    const event = eventData[0];
    const currentTime = moment();
    const hourlyData = [];
    let intervalStart = moment(event.created_at);

    while (intervalStart.isBefore(currentTime)) {
      const intervalEnd = intervalStart.clone().add(1, 'hour');

      const [participations] = await pool.query(
        `SELECT c.gender, COUNT(*) as count
         FROM event_participations ep
         JOIN clients c ON ep.client_id = c.id
         WHERE ep.event_id = ? 
           AND (ep.status = 'Confirmado' OR ep.status = 'Pagamento Antecipado')
           AND ep.participation_date >= ? 
           AND ep.participation_date < ?
         GROUP BY c.gender`,
        [event_id, intervalStart.format('YYYY-MM-DD HH:mm:ss'), intervalEnd.format('YYYY-MM-DD HH:mm:ss')]
      );

      let menCount = 0;
      let womenCount = 0;

      participations.forEach(participation => {
        if (participation.gender === 'male') {
          menCount = participation.count;
        } else if (participation.gender === 'female') {
          womenCount = participation.count;
        }
      });

      hourlyData.push({
        time: intervalStart.format('YYYY-MM-DD HH:mm:ss'),
        men: menCount,
        women: womenCount,
      });

      intervalStart.add(1, 'hour');
    }

    let totalRevenueMen = 0;
    let totalRevenueWomen = 0;
    let totalParticipants = 0;

    const [allParticipations] = await pool.query(
      `SELECT c.gender, ep.status
       FROM event_participations ep
       JOIN clients c ON ep.client_id = c.id
       WHERE ep.event_id = ? 
         AND (ep.status = 'Confirmado' OR ep.status = 'Pagamento Antecipado')`,
      [event_id]
    );

    allParticipations.forEach(participation => {
      if (participation.status === 'Pagamento Antecipado') {
        if (participation.gender === 'male') {
          totalRevenueMen += parseFloat(event.ticket_price_men);
        } else if (participation.gender === 'female') {
          totalRevenueWomen += parseFloat(event.ticket_price_women);
        }
      }
      totalParticipants += 1;
    });

    const totalRevenue = totalRevenueMen + totalRevenueWomen;

    res.status(200).json({
      event_name: event.event_name,
      category: event.category,
      event_date: event.event_date,
      revenue_men: totalRevenueMen.toFixed(2),
      revenue_women: totalRevenueWomen.toFixed(2),
      total_revenue: totalRevenue.toFixed(2),
      total_participants: totalParticipants,
      hourly_data: hourlyData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao buscar informações do evento.' });
  }
});

const axios = require('axios');

const WHATSAPP_API_URL = "https://app.whatsgw.com.br/api/WhatsGw/Send";
const API_KEY = "80d9f34e-82a5-45c7-b628-4d05a7f74f3d";
const ADMIN_PHONE = "5519986082719";

router.post('/send-message', async (req, res) => {
  console.log("Rota /send-message acionada");
  const { name, email, phone, message } = req.body;
  console.log("Dados recebidos:", req.body);

  if (!name || !email || !phone || !message) {
    console.log("Validação falhou: campo(s) obrigatório(s) ausentes");
    return res.status(400).json({
      message: 'Todos os campos (name, email, phone, message) são obrigatórios.'
    });
  }

  try {
    const userMessagePayload = {
      apikey: API_KEY,
      phone_number: ADMIN_PHONE,
      contact_phone_number: `55${phone.replace(/\D/g, '')}`,
      message_custom_id: "user-message",
      message_type: "text",
      message_body: `Olá ${name}, recebemos sua mensagem e logo um atendente entrará em contato com você!`
    };

    console.log("Enviando mensagem para o usuário com o payload:", userMessagePayload);
    const userResponse = await axios.post(
      WHATSAPP_API_URL,
      userMessagePayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Resposta do envio da mensagem para o usuário:", userResponse.data);

    const adminMessagePayload = {
      apikey: API_KEY,
      phone_number: ADMIN_PHONE,
      contact_phone_number: "5519987272715",
      message_custom_id: "admin-message",
      message_type: "text",
      message_body: `📩 *Novo contato recebido!*\n\n👤 *Nome:* ${name}\n📧 *E-mail:* ${email}\n📞 *Telefone:* ${phone}\n💬 *Mensagem:* ${message}`
    };

    console.log("Enviando mensagem para o admin com o payload:", adminMessagePayload);
    const adminResponse = await axios.post(
      WHATSAPP_API_URL,
      adminMessagePayload,
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Resposta do envio da mensagem para o admin:", adminResponse.data);

    res.status(200).json({ message: "Mensagens enviadas com sucesso." });
  } catch (error) {
    console.error(
      "Erro ao enviar mensagens:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ message: "Erro ao enviar mensagens." });
  }
});


module.exports = router;

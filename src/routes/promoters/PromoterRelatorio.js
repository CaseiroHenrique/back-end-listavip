const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/promoter-info', async (req, res) => {
    const { company_id, promoter_id, month, year } = req.body;
  
    if (!company_id || !promoter_id || !month || !year) {
      return res.status(400).json({ message: 'company_id, promoter_id, month e year são obrigatórios.' });
    }
  
    try {
      const pool = await connect();
  
      const [promoterData] = await pool.query(
        `SELECT full_name, created_at 
         FROM promoters 
         WHERE id = ? AND company_id = ?`,
        [promoter_id, company_id]
      );
  
      if (promoterData.length === 0) {
        return res.status(404).json({ message: 'Promotor não encontrado.' });
      }
  
      const promoter = promoterData[0];
  
      const [events] = await pool.query(
        `SELECT e.id AS event_id, e.event_name, e.category, e.event_date
         FROM event_participations ep
         JOIN events e ON ep.event_id = e.id
         WHERE ep.promoter_id = ?
           AND (ep.status = 'Confirmado' OR ep.status = 'Pagamento Antecipado')
           AND MONTH(ep.participation_date) = ?
           AND YEAR(ep.participation_date) = ?`,
        [promoter_id, month, year]
      );
  
      // Query para vendas: considerando apenas participações com status 'Pagamento Antecipado'
      const [participations] = await pool.query(
        `SELECT ep.client_id, ep.event_id, ep.status, ep.participation_date
         FROM event_participations ep
         WHERE ep.promoter_id = ?
           AND ep.status = 'Pagamento Antecipado'
           AND MONTH(ep.participation_date) = ?
           AND YEAR(ep.participation_date) = ?`,
        [promoter_id, month, year]
      );
  
      let totalIngressosVendidos = 0;
      let totalVendas = 0;
      const dailyConfirmations = {};
      const today = new Date().toISOString().split('T')[0];
  
      for (const participation of participations) {
        const day = participation.participation_date.getDate();
  
        // Obter o gênero do cliente
        const [clientData] = await pool.query(
          `SELECT gender FROM clients WHERE id = ?`,
          [participation.client_id]
        );
  
        if (clientData.length === 0) continue;
        const { gender } = clientData[0];
  
        // Obter o preço do ingresso com base no gênero
        const [eventData] = await pool.query(
          `SELECT ticket_price_men, ticket_price_women FROM events WHERE id = ?`,
          [participation.event_id]
        );
  
        if (eventData.length === 0) continue;
        const { ticket_price_men, ticket_price_women } = eventData[0];
  
        const ticketPrice = gender === 'male' ? parseFloat(ticket_price_men) : parseFloat(ticket_price_women);
        totalVendas += ticketPrice;
        totalIngressosVendidos += 1;
  
        if (!dailyConfirmations[day]) {
          dailyConfirmations[day] = { men: 0, women: 0 };
        }
  
        dailyConfirmations[day][gender === 'male' ? 'men' : 'women'] += 1;
      }
  
      const dailyData = Object.keys(dailyConfirmations).map(day => ({
        day: `${day}/${month}/${year}`,
        men: dailyConfirmations[day].men,
        women: dailyConfirmations[day].women,
      }));
  
      const totalDiasComVendas = Object.keys(dailyConfirmations).length;
      const mediaVendasDiarias = totalDiasComVendas ? (totalIngressosVendidos / totalDiasComVendas).toFixed(2) : 0;
  
      // Nova query para contar participações com status 'Confirmado' ou 'Pagamento Antecipado'
      const [confirmedResult] = await pool.query(
        `SELECT COUNT(*) AS confirmedCount
         FROM event_participations
         WHERE promoter_id = ?
           AND (status = 'Confirmado' OR status = 'Pagamento Antecipado')
           AND MONTH(participation_date) = ?
           AND YEAR(participation_date) = ?`,
        [promoter_id, month, year]
      );
      const total_presencas_confirmadas = confirmedResult[0].confirmedCount;
  
      res.status(200).json({
        nome: promoter.full_name,
        created_at: promoter.created_at,
        media_vendas_diarias: mediaVendasDiarias,
        total_ingressos_vendidos: totalIngressosVendidos,
        total_vendas: totalVendas.toFixed(2),
        total_presencas_confirmadas,
        eventos: events,
        daily_data: dailyData,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erro ao buscar informações do promotor.' });
    }
  });
  


module.exports = router;

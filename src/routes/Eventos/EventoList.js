const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/list-events', async (req, res) => {
    const { company_id } = req.body;

    if (!company_id) {
        return res.status(400).json({ message: 'ID da empresa é obrigatório.' });
    }

    try {
        const pool = await connect();

        const [events] = await pool.query(
            `SELECT id, company_id, event_name, event_date, event_type, category, 
                    ticket_price_men, ticket_price_women, event_color, event_image_url, created_at, updated_at
             FROM events
             WHERE company_id = ?
             ORDER BY 
                 CASE 
                     WHEN event_date >= CURDATE() THEN 0  -- Eventos futuros e atuais
                     ELSE 1  -- Eventos passados
                 END,
                 event_date ASC`, // Ordena eventos futuros por data ascendente, seguidos dos eventos passados
            [company_id]
        );

        if (events.length === 0) {
            return res.status(404).json({ message: 'Nenhum evento encontrado para essa empresa.' });
        }

        res.status(200).json(events);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar os eventos.' });
    }
});



router.post('/list-events-by-fantasy-name', async (req, res) => {
    const { fantasy_name, event_id } = req.body;

    if (!fantasy_name && !event_id) {
        return res.status(400).json({ message: 'Nome fantasia ou ID do evento são obrigatórios.' });
    }

    try {
        const pool = await connect();

        let company_id = null;
        let companyDetails = null;

        if (event_id) {
            // Obtendo o company_id com base no event_id
            const [event] = await pool.query(
                `SELECT company_id 
                 FROM events 
                 WHERE id = ?`,
                [event_id]
            );

            if (event.length === 0) {
                return res.status(404).json({ message: 'Nenhum evento encontrado com o ID fornecido.' });
            }

            company_id = event[0].company_id;
        }

        if (fantasy_name || company_id) {
            // Obtendo os detalhes da empresa com base no fantasy_name ou company_id
            const [company] = await pool.query(
                `SELECT id, background_color, logo_url, background_url, blur_effect 
                 FROM companies 
                 WHERE ${fantasy_name ? 'fantasy_name = ?' : 'id = ?'}`,
                [fantasy_name || company_id]
            );

            if (company.length === 0) {
                return res.status(404).json({ message: 'Nenhuma empresa encontrada com os critérios fornecidos.' });
            }

            company_id = company[0].id;
            companyDetails = {
                background_color: company[0].background_color,
                logo_url: company[0].logo_url,
                background_url: company[0].background_url,
                blur_effect: company[0].blur_effect,
            };
        }

        let query = `
            SELECT id, company_id, event_name, event_date, event_type, category, attractions, 
                   ticket_price_men, ticket_price_women, event_color, event_image_url, created_at, updated_at, event_batch, guest_list
            FROM events
            WHERE event_date >= CURDATE()`;
        let params = [];

        if (event_id) {
            query += ` AND id = ?`;
            params.push(event_id);
        } else if (company_id) {
            query += ` AND company_id = ? AND event_type = 'Publico'`;
            params.push(company_id);
        } else {
            return res.status(400).json({ message: 'Parâmetros insuficientes para listar eventos.' });
        }

        const [events] = await pool.query(query, params);

        if (events.length === 0) {
            return res.status(404).json({ message: 'Nenhum evento encontrado para os critérios fornecidos.' });
        }

        res.status(200).json({
            company: companyDetails || null,
            events: events,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao listar os eventos.' });
    }
});


router.post('/event-sales', async (req, res) => {
  const { company_id, event_id } = req.body;
  if (!company_id || !event_id) {
    return res.status(400).json({ message: 'company_id e event_id são obrigatórios.' });
  }
  try {
    const pool = await connect();

    const [eventData] = await pool.query(
      `SELECT event_name, ticket_price_men, ticket_price_women 
       FROM events 
       WHERE id = ? AND company_id = ?`,
      [event_id, company_id]
    );
    if (eventData.length === 0) {
      return res.status(404).json({ message: 'Evento não encontrado.' });
    }
    const event = eventData[0];

    const [companyData] = await pool.query(
      `SELECT fantasy_name 
       FROM companies 
       WHERE id = ?`,
      [company_id]
    );
    if (companyData.length === 0) {
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }
    const company = companyData[0];

    const [participations] = await pool.query(
      `SELECT client_id, participation_date, promoter_id, status, validated
       FROM event_participations 
       WHERE event_id = ?
       ORDER BY participation_date DESC`,
      [event_id]
    );

    let totalSales = 0;
    let dailySales = 0;
    let totalValidatedSales = 0;
    let confirmedParticipants = 0;
    const today = new Date().toISOString().split('T')[0];
    const participantDetails = [];

    for (const participation of participations) {
      const clientId = participation.client_id;
      const [clientData] = await pool.query(
        `SELECT name, phone, gender 
         FROM clients 
         WHERE id = ?`,
        [clientId]
      );
      if (clientData.length === 0) continue;
      const client = clientData[0];
      const ticketPrice = client.gender === 'male' ? event.ticket_price_men : event.ticket_price_women;
      const price = ticketPrice ? parseFloat(ticketPrice) : 0;
      const participationDate = participation.participation_date.toISOString().split('T')[0];

      if (participation.status === 'Pagamento Antecipado') {
        totalSales += price;
        if (participationDate === today) {
          dailySales += price;
        }
        totalValidatedSales++;
      }

      if (participation.status === 'Pagamento Antecipado' || participation.status === 'Confirmado') {
        confirmedParticipants++;
      }

      let promoterName = "";
      if (participation.promoter_id) {
        const [promoterData] = await pool.query(
          `SELECT full_name 
           FROM promoters 
           WHERE id = ?`,
          [participation.promoter_id]
        );
        if (promoterData.length > 0) {
          promoterName = promoterData[0].full_name;
        }
      }

      participantDetails.push({
        full_name: client.name,
        telefone: client.phone,
        promoter_name: promoterName,
        gender: client.gender,
        status: participation.status
      });
    }

    res.status(200).json({
      event_name: event.event_name,
      company_name: company.fantasy_name,
      confirmed_participants: confirmedParticipants,
      total_sales: totalSales.toFixed(2),
      daily_sales: dailySales.toFixed(2),
      total_validated_sales: totalValidatedSales,
      participants: participantDetails
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erro ao calcular vendas do evento.' });
  }
});


  
router.delete('/event/:event_id', async (req, res) => {
    const { event_id } = req.params;

    if (!event_id) {
        return res.status(400).json({ message: 'O event_id é obrigatório.' });
    }

    try {
        const pool = await connect();

        // Deletar participações relacionadas ao evento
        await pool.query(
            `DELETE FROM event_participations 
             WHERE event_id = ?`,
            [event_id]
        );

        // Deletar o evento da tabela events
        const [result] = await pool.query(
            `DELETE FROM events 
             WHERE id = ?`,
            [event_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }

        res.status(200).json({ message: 'Evento e suas participações foram excluídos com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao deletar evento.' });
    }
});


module.exports = router;
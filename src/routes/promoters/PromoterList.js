const express = require('express');
const router = express.Router();
const { connect } = require('../../config/database');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
        user: 'contato@conexaocode.com',
        pass: '#Henrique1312'
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendEmail = async (to, subject, htmlContent) => {
    try {
        await transporter.sendMail({
            from: '"Conexão Code" <contato@conexaocode.com>',
            to,
            subject,
            html: htmlContent
        });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
};

const generateEmailContent = (companyName, status) => {
    const companyNameUrl = encodeURIComponent(companyName);
    const loginUrl = `http://localhost:1234/login/promoter/${companyNameUrl}`;

    return `
        <div style="width: 100%; font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <img src="https://cdn.discordapp.com/attachments/1232894603498229773/1301056924485156926/logob.png?ex=6723172f&is=6721c5af&hm=243aaadf769643c1c0adaff41f4e3f9719e0a1ca6f06489caf3aa3882b061dbd&" alt="Logo" style="width: 120px; height: auto;" />
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <h1 style="color: #333333; font-size: 24px; margin: 0;">${status === 'aprovado' ? 'Aprovação de Cadastro' : 'Recusa de Cadastro'}</h1>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 10px 30px;">
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                            ${status === 'aprovado'
            ? `Parabéns! Seu cadastro para a empresa ${companyName} foi aprovado. Você agora está autorizado a participar dos eventos como promoter.`
            : `Lamentamos informar que seu cadastro para a empresa ${companyName} foi recusado. Se precisar de mais informações, entre em contato conosco.`
        }
                        </p>
                    </td>
                </tr>
                ${status === 'aprovado' ? `
                <tr>
                    <td align="center" style="padding: 20px;">
                        <a href="${loginUrl}" style="background-color: #28a745; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px; display: inline-block;">
                            Acessar Login
                        </a>
                    </td>
                </tr>
                ` : ''}
                <tr>
                    <td align="center" style="padding: 20px;">
                        <p style="color: #999999; font-size: 12px;">
                            Obrigado por utilizar nossa plataforma.
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

const generateDeleteEmailContent = (companyName) => {
    return `
        <div style="width: 100%; font-family: Arial, sans-serif; padding: 20px; box-sizing: border-box;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <img src="https://cdn.discordapp.com/attachments/1232894603498229773/1301056924485156926/logob.png?ex=6723172f&is=6721c5af&hm=243aaadf769643c1c0adaff41f4e3f9719e0a1ca6f06489caf3aa3882b061dbd&" alt="Logo" style="width: 120px; height: auto;" />
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <h1 style="color: #333333; font-size: 24px; margin: 0;">Remoção de Cadastro</h1>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 10px 30px;">
                        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
                            Informamos que você foi removido como promoter da empresa ${companyName}. Se tiver alguma dúvida, entre em contato conosco.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td align="center" style="padding: 20px;">
                        <p style="color: #999999; font-size: 12px;">
                            Obrigado pelo serviço prestado.
                        </p>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

router.delete('/:id/delete', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connect();

        const [promoterResults] = await pool.query('SELECT email, company_id FROM promoters WHERE id = ?', [id]);
        if (promoterResults.length === 0) {
            return res.status(404).json({ message: 'Promoter não encontrado' });
        }
        const promoter = promoterResults[0];

        const [companyResults] = await pool.query('SELECT fantasy_name FROM companies WHERE id = ?', [promoter.company_id]);
        if (companyResults.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }
        const companyName = companyResults[0].fantasy_name;

        await pool.query('DELETE FROM promoters WHERE id = ?', [id]);

        const emailContent = generateDeleteEmailContent(companyName);

        res.json({ message: 'Promoter deletado com sucesso' });
        await sendEmail(promoter.email, 'Remoção de Cadastro', emailContent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao deletar promoter' });
    }
});


router.get('/promoters-list', async (req, res) => {
    const { company_id } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'company_id é obrigatório' });
    }

    try {
        const pool = await connect();

        // Obter o nome da empresa
        const [companyResults] = await pool.query('SELECT fantasy_name FROM companies WHERE id = ?', [company_id]);
        if (companyResults.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }
        const companyName = companyResults[0].fantasy_name;

        // Obter os promoters da empresa
        const [promoters] = await pool.query(
            'SELECT id, full_name, email, created_at, token FROM promoters WHERE company_id = ? AND status = "accepted"',
            [company_id]
        );

        // Iterar sobre os promoters e calcular total de vendas e receita gerada
        const promotersWithStats = await Promise.all(promoters.map(async promoter => {
            // Buscar participações do mês atual com status "Pagamento Antecipado"
            const [participations] = await pool.query(
                `SELECT client_id, event_id 
                 FROM event_participations 
                 WHERE promoter_id = ? AND status = "Pagamento Antecipado" 
                 AND MONTH(participation_date) = MONTH(CURRENT_DATE()) 
                 AND YEAR(participation_date) = YEAR(CURRENT_DATE())`,
                [promoter.id]
            );

            const totalSales = participations.length;

            let revenueGenerated = 0;

            for (const participation of participations) {
                const { client_id, event_id } = participation;

                const [client] = await pool.query(
                    'SELECT gender FROM clients WHERE id = ?',
                    [client_id]
                );

                if (client.length > 0) {
                    const gender = client[0].gender;

                    const [event] = await pool.query(
                        'SELECT ticket_price_men, ticket_price_women FROM events WHERE id = ?',
                        [event_id]
                    );

                    if (event.length > 0) {
                        const ticketPrice = gender === 'male' 
                            ? event[0].ticket_price_men 
                            : event[0].ticket_price_women;

                        revenueGenerated += parseFloat(ticketPrice);
                    }
                }
            }

            return {
                ...promoter,
                companyName,
                total_sales: totalSales,
                revenue_generated: revenueGenerated
            };
        }));

        res.json(promotersWithStats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao listar promoters' });
    }
});


router.get('/promoters', async (req, res) => {
    const { company_id } = req.query;

    if (!company_id) {
        return res.status(400).json({ message: 'company_id é obrigatório' });
    }

    try {
        const pool = await connect();

        const [promoters] = await pool.query(
            'SELECT id, full_name, email, created_at FROM promoters WHERE company_id = ? and status = "pending"',
            [company_id]
        );

        res.json(promoters);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao listar promoters' });
    }
});

router.post('/:id/approve', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connect();

        const [promoterResults] = await pool.query('SELECT email, company_id FROM promoters WHERE id = ?', [id]);
        if (promoterResults.length === 0) {
            return res.status(404).json({ message: 'Promoter não encontrado' });
        }
        const promoter = promoterResults[0];

        const [companyResults] = await pool.query('SELECT fantasy_name FROM companies WHERE id = ?', [promoter.company_id]);
        if (companyResults.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }
        const companyName = companyResults[0].fantasy_name;

        await pool.query('UPDATE promoters SET status = ? WHERE id = ?', ['accepted', id]);

        const emailContent = generateEmailContent(companyName, 'aprovado');

        res.json({ message: 'Promoter aprovado com sucesso' });
        await sendEmail(promoter.email, 'Aprovação de Cadastro', emailContent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao aprovar promoter' });
    }
});

router.post('/:id/reject', async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await connect();

        const [promoterResults] = await pool.query('SELECT email, company_id FROM promoters WHERE id = ?', [id]);
        if (promoterResults.length === 0) {
            return res.status(404).json({ message: 'Promoter não encontrado' });
        }
        const promoter = promoterResults[0];

        const [companyResults] = await pool.query('SELECT fantasy_name FROM companies WHERE id = ?', [promoter.company_id]);
        if (companyResults.length === 0) {
            return res.status(404).json({ message: 'Empresa não encontrada' });
        }
        const companyName = companyResults[0].fantasy_name;

        await pool.query('UPDATE promoters SET status = ? WHERE id = ?', ['rejected', id]);

        const emailContent = generateEmailContent(companyName, 'recusado');

        res.json({ message: 'Promoter recusado com sucesso' });
        await sendEmail(promoter.email, 'Recusa de Cadastro', emailContent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro no servidor ao recusar promoter' });
    }
});

module.exports = router;

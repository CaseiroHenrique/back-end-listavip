const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();
const { connect } = require('../../config/database');

router.post('/help', async (req, res) => {
    const { primeiroNome, sobrenome, email, phoneNumber, mensagem } = req.body;

    try {
        const pool = await connect();

        const [result] = await pool.query(
            'INSERT INTO help_requests (primeiro_nome, sobrenome, email, telefone, mensagem) VALUES (?, ?, ?, ?, ?)',
            [primeiroNome, sobrenome, email, phoneNumber, mensagem]
        );

        const requestId = result.insertId;

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

        await transporter.sendMail({
            from: 'contato@conexaocode.com',
            to: email,
            subject: 'Recebemos sua mensagem!',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #333;">Olá, ${primeiroNome}!</h2>
                    <p style="color: #555;">
                        Agradecemos por entrar em contato. Recebemos sua mensagem e entraremos em contato o mais breve possível.
                    </p>
                    <p style="color: #555;">
                        Mensagem enviada: <strong>${mensagem}</strong>
                    </p>
                    <p style="color: #999; font-size: 12px;">
                        Este é um e-mail automático. Por favor, não responda.
                    </p>
                </div>
            `
        });

        await transporter.sendMail({
            from: 'contato@conexaocode.com',
            to: 'caseiro.henrique@gmail.com',
            subject: 'Nova mensagem recebida via formulário de ajuda',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #333;">Nova Mensagem Recebida</h2>
                    <p style="color: #555;">Detalhes da mensagem enviada:</p>
                    <ul style="color: #555;">
                        <li><strong>Primeiro Nome:</strong> ${primeiroNome}</li>
                        <li><strong>Sobrenome:</strong> ${sobrenome}</li>
                        <li><strong>Email:</strong> ${email}</li>
                        <li><strong>Telefone:</strong> ${phoneNumber}</li>
                        <li><strong>Mensagem:</strong> ${mensagem}</li>
                    </ul>
                    <p style="color: #999; font-size: 12px;">
                        Este e-mail foi enviado automaticamente pelo sistema.
                    </p>
                </div>
            `
        });

        res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
    } catch (error) {
        console.error('Erro ao processar o formulário de ajuda:', error);
        res.status(500).json({ message: 'Erro no servidor. Tente novamente mais tarde.' });
    }
});

module.exports = router;
